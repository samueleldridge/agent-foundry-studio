/**
 * "Draft with AI" eval wizard (docs/72 § Eval assistant).
 *
 * describe → clarifying questions (suggested answers as placeholders,
 * every question skippable) → draft → REVIEW: drafted case table
 * (id / input / expected with jump-to-line into the YAML) + the YAML in
 * the server-validated CodeMirror editor → explicit "Save eval set".
 *
 * The draft never touches disk server-side; the save goes through the
 * existing config-write route (validate → commit) — the human owns the
 * expected values. "Regenerate" re-drafts with tweaked answers.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  SaveIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAssistDraft, useAssistQuestions, fetchBaseHash } from "@/api/hooks/useEvalAssist";
import { useSaveFile, useValidate } from "@/api/hooks/useConfigs";
import type {
  EvalAssistCase,
  EvalAssistDraftResponse,
  EvalAssistQuestion,
  ValidationResult,
} from "@/api/types";
import { CodeEditor } from "@/components/CodeEditor";
import { ErrorState } from "@/components/ErrorState";
import { IssuesPanel } from "@/features/configs/ConfigEditorScreen";
import { ForgeModelField } from "@/features/forge/ModelSelect";
import { useModelCatalog } from "@/features/forge/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Step = "describe" | "questions" | "review";

const VALIDATE_DEBOUNCE_MS = 300;
const CASE_COUNT_MIN = 1;
const CASE_COUNT_MAX = 50;
const CASE_COUNT_DEFAULT = 10;

/** Typed case counts are clamped to the wizard's bounds. */
function clampCaseCount(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return CASE_COUNT_DEFAULT;
  return Math.min(CASE_COUNT_MAX, Math.max(CASE_COUNT_MIN, n));
}

function compact(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function CaseTable({
  cases,
  onJump,
}: {
  cases: EvalAssistCase[];
  onJump: (line: number) => void;
}) {
  if (cases.length === 0) return null;
  return (
    <div className="max-h-48 overflow-auto rounded-lg border">
      <table className="w-full text-xs" data-slot="draft-case-table">
        <thead className="sticky top-0 bg-muted/80 text-left">
          <tr>
            <th className="px-2 py-1.5 font-medium">Case</th>
            <th className="px-2 py-1.5 font-medium">Input</th>
            <th className="px-2 py-1.5 font-medium">Expected</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((row) => (
            <tr key={row.id} className="border-t align-top">
              <td className="px-2 py-1.5">
                {row.line != null ? (
                  <button
                    type="button"
                    className="font-mono text-primary underline-offset-2 hover:underline"
                    onClick={() => onJump(row.line as number)}
                    aria-label={`Jump to case ${row.id}`}
                  >
                    {row.id}
                  </button>
                ) : (
                  <span className="font-mono">{row.id}</span>
                )}
              </td>
              <td className="px-2 py-1.5 font-mono">{compact(row.input)}</td>
              <td className="px-2 py-1.5 font-mono">
                {compact(row.expected)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvalDraftWizard({
  project,
  open,
  onOpenChange,
  initialDescription = "",
  suggestedPath,
  onSaved,
}: {
  project: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled from the forge form's description when present. */
  initialDescription?: string;
  /** Override the server's suggested save path (e.g. the starter-eval
   * path a fresh project scaffolded). */
  suggestedPath?: string;
  onSaved?: (path: string) => void;
}) {
  const questionsMutation = useAssistQuestions();
  const draftMutation = useAssistDraft();
  const validate = useValidate(project);
  const save = useSaveFile(project);

  const catalog = useModelCatalog();
  const [pickedModel, setPickedModel] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const selectedModel =
    pickedModel !== "" ? pickedModel : catalog.defaultBinding;
  const modelForSubmit = customMode
    ? customModel.trim() || null
    : selectedModel || null;
  const generateBlocked = catalog.ready && !catalog.hasAnyKey && !customMode;

  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState(initialDescription);
  const [caseCount, setCaseCount] = useState("10");
  const [questions, setQuestions] = useState<EvalAssistQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<EvalAssistDraftResponse | null>(null);
  const [yamlText, setYamlText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [scrollTo, setScrollTo] = useState<{ line: number } | null>(null);

  const savePath = suggestedPath ?? draft?.suggested_path ?? `evals/${project}.yaml`;

  const askQuestions = () => {
    questionsMutation.mutate(
      { project, description, model: modelForSubmit },
      {
        onSuccess: (res) => {
          setQuestions(res.questions ?? []);
          setStep("questions");
        },
      },
    );
  };

  const runDraft = () => {
    draftMutation.mutate(
      {
        project,
        description,
        model: modelForSubmit,
        case_count: clampCaseCount(caseCount),
        answers: questions
          .map((q) => ({ id: q.id, answer: (answers[q.id] ?? "").trim() }))
          .filter((a) => a.answer !== ""),
      },
      {
        onSuccess: (res) => {
          setDraft(res);
          setYamlText(res.yaml);
          setValidation(res.validation);
          setStep("review");
        },
      },
    );
  };

  // Debounced server validation with a monotonic sequence guard: a burst
  // of keystrokes fires one request, and a slow response for an older
  // edit can never overwrite the verdict for a newer one.
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateSeq = useRef(0);
  useEffect(
    () => () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    },
    [],
  );
  const revalidate = (content: string) => {
    setYamlText(content);
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(() => {
      const seq = ++validateSeq.current;
      validate.mutate(
        { path: savePath, content },
        {
          onSuccess: (result) => {
            if (seq === validateSeq.current) setValidation(result);
          },
        },
      );
    }, VALIDATE_DEBOUNCE_MS);
  };

  const doSave = () => {
    void (async () => {
      // fetchBaseHash rethrows non-404 failures (auth/network/5xx) so a
      // broken lookup can't masquerade as a fresh save.
      let baseHash: string | null;
      try {
        baseHash = await fetchBaseHash(project, savePath);
      } catch (err) {
        toast.error(
          `Save failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
      save.mutate(
        { path: savePath, content: yamlText, base_hash: baseHash },
        {
          onSuccess: (result) => {
            toast.success(`Eval set committed ${result.commit_sha.slice(0, 8)}`, {
              description: result.commit_message,
            });
            onSaved?.(savePath);
            onOpenChange(false);
          },
          onError: (err) => toast.error(`Save failed: ${err.message}`),
        },
      );
    })();
  };

  const saveBlocked =
    save.isPending ||
    yamlText.trim() === "" ||
    (validation !== null && !validation.ok);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparklesIcon className="size-4" aria-hidden />
            Draft eval set with AI — {project}
          </DialogTitle>
          <DialogDescription>
            The assistant asks clarifying questions, then drafts a complete
            eval set. Nothing is saved until you review and commit it — you
            own every expected value.
          </DialogDescription>
        </DialogHeader>

        {step === "describe" && (
          <div className="space-y-3" data-slot="wizard-describe">
            <div className="space-y-1.5">
              <Label htmlFor="assist-description">
                What must the agent do?
              </Label>
              <Textarea
                id="assist-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the requirement: inputs, the behaviour under test, what a correct output looks like."
                rows={4}
              />
            </div>
            <ForgeModelField
              catalog={catalog}
              value={selectedModel}
              onValueChange={setPickedModel}
              customMode={customMode}
              onCustomModeChange={setCustomMode}
              customValue={customModel}
              onCustomValueChange={setCustomModel}
              label="Assistant model"
              idPrefix="assist-model"
            />
            <Button
              onClick={askQuestions}
              disabled={
                questionsMutation.isPending ||
                description.trim() === "" ||
                generateBlocked
              }
            >
              <SparklesIcon aria-hidden />
              {questionsMutation.isPending
                ? "Asking…"
                : "Ask clarifying questions"}
            </Button>
            {questionsMutation.error && (
              <ErrorState
                error={questionsMutation.error}
                title="Could not generate questions"
              />
            )}
          </div>
        )}

        {step === "questions" && (
          <div className="space-y-3" data-slot="wizard-questions">
            <p className="text-xs text-muted-foreground">
              Answer what you can — every question is skippable (leave it
              blank). Suggested answers show as placeholders.
            </p>
            {questions.map((q) => (
              <div key={q.id} className="space-y-1">
                <Label htmlFor={`assist-q-${q.id}`}>{q.question}</Label>
                {q.why && (
                  <p className="text-xs text-muted-foreground">{q.why}</p>
                )}
                <Input
                  id={`assist-q-${q.id}`}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  placeholder={q.suggested_answer ?? "(skip)"}
                />
              </div>
            ))}
            <div className="flex items-end gap-3">
              <div className="w-28 space-y-1.5">
                <Label htmlFor="assist-case-count">Cases</Label>
                <Input
                  id="assist-case-count"
                  type="number"
                  min={CASE_COUNT_MIN}
                  max={CASE_COUNT_MAX}
                  value={caseCount}
                  onChange={(e) => setCaseCount(e.target.value)}
                  onBlur={() => setCaseCount(String(clampCaseCount(caseCount)))}
                />
              </div>
              <Button onClick={runDraft} disabled={draftMutation.isPending}>
                <SparklesIcon aria-hidden />
                {draftMutation.isPending ? "Drafting…" : "Draft eval set"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("describe")}
                disabled={draftMutation.isPending}
              >
                <ArrowLeftIcon aria-hidden /> Back
              </Button>
            </div>
            {draftMutation.error && (
              <ErrorState
                error={draftMutation.error}
                title="Could not draft the eval set"
              />
            )}
          </div>
        )}

        {step === "review" && draft && (
          <div className="space-y-3" data-slot="wizard-review">
            {(draft.notes ?? []).length > 0 && (
              <ul className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                {(draft.notes ?? []).map((note, i) => (
                  <li key={i}>• {note}</li>
                ))}
              </ul>
            )}
            <CaseTable
              cases={draft.cases ?? []}
              onJump={(line) => setScrollTo({ line })}
            />
            <div className="h-64 overflow-hidden rounded-lg border">
              <CodeEditor
                value={yamlText}
                language="yaml"
                onChange={revalidate}
                issues={
                  validation && !validation.ok ? (validation.issues ?? []) : []
                }
                scrollTo={scrollTo}
                className="h-full"
                aria-label="Drafted eval YAML"
              />
            </div>
            <IssuesPanel result={validation} />
            <p className="text-xs text-muted-foreground">
              Review every <code className="font-mono">expected</code> value —
              the eval is YOUR contract; the forge optimises toward it and may
              not modify it. Saving commits{" "}
              <code className="font-mono">{savePath}</code>.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={doSave}
                disabled={saveBlocked}
                aria-label="Save eval set"
              >
                <SaveIcon aria-hidden />
                {save.isPending ? "Saving…" : "Save eval set"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("questions")}
                disabled={draftMutation.isPending}
              >
                <RefreshCwIcon aria-hidden /> Regenerate with tweaked answers
              </Button>
              {validation && !validation.ok && (
                <Badge variant="warn">fix validation issues to save</Badge>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
