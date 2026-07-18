/**
 * Config editor — file tree + CodeMirror + server-side validation.
 *
 * The frontend performs NO validation of its own: content is debounced to
 * POST /validate and the returned ValidationIssues render as inline editor
 * diagnostics (line/column) plus a panel (pointer + message + hint).
 * Save = validate → write → commit; the commit sha surfaces as a toast.
 * 409 stale-content answers with an explicit reload-and-merge flow.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileTextIcon,
  LockIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import {
  useFileContent,
  useFileTree,
  useSaveFile,
  useValidate,
} from "@/api/hooks/useConfigs";
import type {
  FileContent,
  FileEntry,
  ValidationIssue,
  ValidationResult,
} from "@/api/types";
import { CodeEditor, type EditorLanguage } from "@/components/CodeEditor";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const VALIDATE_DEBOUNCE_MS = 500;

function languageFor(kind: string): EditorLanguage {
  if (kind === "prompt") return "markdown";
  if (kind === "python") return "python";
  return "yaml";
}

function FileTreePanel({
  files,
  selected,
  onSelect,
}: {
  files: FileEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <nav
      aria-label="Config files"
      className="max-h-[70vh] w-64 shrink-0 space-y-0.5 overflow-y-auto rounded-lg border bg-card p-2"
    >
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onSelect(file.path)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
            selected === file.path && "bg-accent font-medium",
          )}
        >
          {file.editable ? (
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
          <Badge variant="muted" className="text-[10px]">
            {file.kind}
          </Badge>
        </button>
      ))}
    </nav>
  );
}

export function IssuesPanel({ result }: { result: ValidationResult | null }) {
  if (result === null) return null;
  if (result.ok) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
        <CheckCircle2Icon className="size-4" aria-hidden />
        Valid — schema <code className="font-mono text-xs">{result.kind}</code>
      </div>
    );
  }
  return (
    <div
      className="space-y-1.5 rounded-lg border border-fail/40 bg-fail/5 p-3"
      role="alert"
      aria-label="Validation issues"
    >
      {(result.issues ?? []).map((issue: ValidationIssue, i: number) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <AlertTriangleIcon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              issue.severity === "error" ? "text-fail" : "text-warn",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="whitespace-pre-wrap break-words">{issue.message}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {issue.pointer ?? "—"}
              {issue.line != null && ` · line ${issue.line}`}
              {issue.column != null && `, col ${issue.column}`}
            </p>
            {issue.hint && (
              <p className="mt-0.5 text-xs italic text-muted-foreground">
                {issue.hint}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Per-file editor pane. Mounted with a key of path+content_hash so all
 * editing state (content, dirty, validation) resets naturally when a
 * different file — or a reloaded version of the same file — arrives.
 */
function EditorPane({
  project,
  file,
  onReloadRequested,
}: {
  project: string;
  file: FileContent;
  onReloadRequested: () => void;
}) {
  const navigate = useNavigate();
  const validate = useValidate(project);
  const save = useSaveFile(project);

  const [content, setContent] = useState<string>(file.content);
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [pythonEditable, setPythonEditable] = useState(false);
  const [staleServerContent, setStaleServerContent] = useState<string | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runValidation = useCallback(
    (value: string) => {
      validate.mutate(
        { path: file.path, content: value },
        { onSuccess: (result) => setValidation(result) },
      );
    },
    [validate, file.path],
  );

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setDirty(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => runValidation(value),
        VALIDATE_DEBOUNCE_MS,
      );
    },
    [runValidation],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const language = languageFor(file.kind);
  const readOnly = !file.editable || (language === "python" && !pythonEditable);
  const saveBlocked =
    !dirty ||
    readOnly ||
    (validation !== null && !validation.ok) ||
    save.isPending;

  const doSave = () => {
    save.mutate(
      { path: file.path, content, base_hash: file.content_hash },
      {
        onSuccess: (result) => {
          setDirty(false);
          setValidation(null);
          setStaleServerContent(null);
          toast.success(`Committed ${result.commit_sha.slice(0, 8)}`, {
            description: result.commit_message,
            action: {
              label: "View versions",
              onClick: () => void navigate(`/projects/${project}/versions`),
            },
          });
          onReloadRequested();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 422) {
            // Save-time validation failure: the body IS the ValidationResult.
            const payload = err.payload as ValidationResult | undefined;
            if (payload && Array.isArray(payload.issues)) {
              setValidation(payload);
              toast.error("Save refused: validation failed");
              return;
            }
          }
          if (err instanceof ApiError && err.status === 409) {
            const server = err.envelope.context["server_content"];
            setStaleServerContent(typeof server === "string" ? server : "");
            return;
          }
          toast.error(`Save failed: ${err.message}`);
        },
      },
    );
  };

  const issues = validation && !validation.ok ? (validation.issues ?? []) : [];

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {file.path}
          {dirty && (
            <Badge variant="warn" className="ml-2">
              unsaved
            </Badge>
          )}
          {validate.isPending && (
            <span className="ml-2 text-muted-foreground">validating…</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {language === "python" && file.editable && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Allow python edits
              <Switch
                checked={pythonEditable}
                onCheckedChange={setPythonEditable}
                aria-label="Allow python edits"
              />
            </label>
          )}
          <Button onClick={doSave} disabled={saveBlocked} aria-label="Save file">
            <SaveIcon aria-hidden />
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {language === "python" && pythonEditable && (
        <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn-foreground dark:text-warn">
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
          Python files are code — validation is import-based, not
          schema-based. Edit with care.
        </div>
      )}

      {content.includes("model_binding") && (
        <p className="text-xs text-muted-foreground" data-slot="model-binding-hint">
          Editing a <code className="font-mono">model_binding</code>?{" "}
          <Link to="/providers" className="text-primary hover:underline">
            Browse providers &amp; models
          </Link>{" "}
          for model ids, context windows, pricing — and to add the
          provider&apos;s API key.
        </p>
      )}

      <div className="h-[52vh] overflow-hidden rounded-lg border">
        <CodeEditor
          value={content}
          language={language}
          onChange={handleChange}
          readOnly={readOnly}
          issues={issues}
          className="h-full"
          aria-label={`Editor for ${file.path}`}
        />
      </div>

      <IssuesPanel result={validation} />

      <Dialog
        open={staleServerContent !== null}
        onOpenChange={(open) => !open && setStaleServerContent(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>File changed on disk</DialogTitle>
            <DialogDescription>
              {file.path} was modified since the editor loaded it (another
              session or a forge run). Review the server content, then reload
              and re-apply your edit — saves never silently overwrite.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-72 overflow-auto rounded-lg border bg-card p-3 font-mono text-xs">
            {staleServerContent}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaleServerContent(null)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setStaleServerContent(null);
                onReloadRequested();
              }}
            >
              Reload server content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ConfigEditorScreen() {
  const { name = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPath = searchParams.get("file");

  const {
    data: tree,
    isLoading: treeLoading,
    error: treeError,
  } = useFileTree(name);
  const {
    data: file,
    isLoading: fileLoading,
    error: fileError,
    refetch: refetchFile,
  } = useFileContent(name, selectedPath);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${name} · configs`}
        description="Server-validated editing; every save is a commit."
      />

      {treeError ? (
        <ErrorState error={treeError} title="Could not load file tree" />
      ) : (
        <div className="flex gap-4">
          {treeLoading ? (
            <Skeleton className="h-96 w-64 shrink-0" />
          ) : (
            <FileTreePanel
              files={tree?.files ?? []}
              selected={selectedPath}
              onSelect={(path) => setSearchParams({ file: path })}
            />
          )}

          <div className="min-w-0 flex-1 space-y-3">
            {!selectedPath ? (
              <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Select a config file to edit.
              </div>
            ) : fileError ? (
              <ErrorState error={fileError} title={`Could not load ${selectedPath}`} />
            ) : fileLoading || !file ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <EditorPane
                key={`${file.path}:${file.content_hash}`}
                project={name}
                file={file}
                onReloadRequested={() => void refetchFile()}
              />
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Commits land as{" "}
        <code className="font-mono">studio({name}): edit &lt;path&gt;</code> —
        see{" "}
        <Link
          className="text-primary hover:underline"
          to={`/projects/${name}/versions`}
        >
          versions
        </Link>
        .
      </p>
    </div>
  );
}
