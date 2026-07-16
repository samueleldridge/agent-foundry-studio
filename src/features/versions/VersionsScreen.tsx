/**
 * Versions — commit history, per-artifact version state (pins), diff view
 * between refs, and the dry-run-first rollback dialog (docs/52's
 * trustworthy-rollback property with a UI on it).
 */
import { useState } from "react";
import { useParams } from "react-router";
import {
  CheckIcon,
  GitCompareIcon,
  GitBranchIcon,
  UndoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDiff, useRollback, useVersions } from "@/api/hooks/useVersions";
import type {
  ArtifactVersions,
  CommitModel,
  RollbackResponse,
} from "@/api/types";
import { DiffView } from "@/components/DiffView";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function ArtifactPinRows({
  title,
  artifacts,
  onRollback,
}: {
  title: string;
  artifacts: ArtifactVersions[];
  onRollback: (artifact: ArtifactVersions, toVersion: string) => void;
}) {
  if (artifacts.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">
        {artifacts.map((artifact) => (
          <div
            key={`${artifact.kind}-${artifact.name}`}
            className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 text-sm"
          >
            <span className="font-medium">{artifact.name}</span>
            {artifact.ref && (
              <code className="text-xs text-muted-foreground">{artifact.ref}</code>
            )}
            <span className="ml-auto flex items-center gap-1">
              {(artifact.versions ?? []).map((version) => {
                const pinned = version === artifact.pinned;
                return pinned ? (
                  <Badge key={version} className="font-mono">
                    <CheckIcon aria-hidden /> {version}
                  </Badge>
                ) : (
                  <Button
                    key={version}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 font-mono text-xs"
                    onClick={() => onRollback(artifact, version)}
                    aria-label={`Roll ${artifact.name} to ${version}`}
                  >
                    <UndoIcon aria-hidden /> {version}
                  </Button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RollbackTarget {
  artifact: ArtifactVersions;
  toVersion: string;
}

function RollbackDialog({
  project,
  target,
  onClose,
}: {
  project: string;
  target: RollbackTarget | null;
  onClose: () => void;
}) {
  const rollback = useRollback(project);
  const [plan, setPlan] = useState<RollbackResponse | null>(null);
  const [force, setForce] = useState(false);

  const body = target
    ? {
        tool: target.artifact.kind === "tool" ? target.artifact.name : null,
        prompt: target.artifact.kind === "prompt" ? target.artifact.name : null,
        to: target.toVersion,
        force,
      }
    : null;

  const runDryRun = () => {
    if (!body) return;
    rollback.mutate(
      { ...body, dry_run: true },
      {
        onSuccess: setPlan,
        onError: (err) => toast.error(`Dry run failed: ${err.message}`),
      },
    );
  };

  const confirm = () => {
    if (!body) return;
    rollback.mutate(
      { ...body, dry_run: false },
      {
        onSuccess: (res) => {
          toast.success(
            `Rolled back — commit ${res.commit_sha?.slice(0, 8) ?? "n/a"}`,
            { description: res.plan },
          );
          close();
        },
        onError: (err) => toast.error(`Rollback failed: ${err.message}`),
      },
    );
  };

  const close = () => {
    setPlan(null);
    setForce(false);
    onClose();
  };

  const checksFailed = (plan?.checks ?? []).some((c) => !c.ok);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Rollback {target?.artifact.name} → {target?.toVersion}
          </DialogTitle>
          <DialogDescription>
            Dry-run first: preview the plan and pre-flight checks, then confirm.
          </DialogDescription>
        </DialogHeader>

        {plan === null ? (
          <p className="text-sm text-muted-foreground">
            Run the dry-run preview to see what this rollback would change.
          </p>
        ) : (
          <div className="space-y-3">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-card p-3 font-mono text-xs">
              {plan.plan}
            </pre>
            <div className="space-y-1" aria-label="Pre-flight checks">
              {(plan.checks ?? []).map((check) => (
                <div
                  key={check.name}
                  className="flex items-start gap-2 text-sm"
                >
                  {check.ok ? (
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                  ) : (
                    <XIcon className="mt-0.5 size-4 shrink-0 text-fail" aria-hidden />
                  )}
                  <div>
                    <span className={cn("font-medium", !check.ok && "text-fail")}>
                      {check.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {check.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {(plan.notes ?? []).length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {(plan.notes ?? []).map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
            {checksFailed && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="accent-[var(--fail)]"
                />
                Force past failing checks (bypass is audited)
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={runDryRun}
            disabled={rollback.isPending}
          >
            {rollback.isPending && plan === null ? "Previewing…" : "Dry run"}
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={plan === null || rollback.isPending || (checksFailed && !force)}
          >
            Confirm rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionsScreen() {
  const { name = "" } = useParams();
  const { data, isLoading, error } = useVersions(name);
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null);
  const [ref1, setRef1] = useState<string | null>(null);
  const [ref2, setRef2] = useState<string | null>(null);
  const diff = useDiff(name, ref1, ref2);

  const commits: CommitModel[] = data?.commits ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${name} · versions`}
        description={`Branch ${data?.branch ?? "…"} — commits, per-artifact pins, diff, rollback.`}
      />

      {error ? (
        <ErrorState error={error} title="Could not load versions" />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-muted-foreground" aria-hidden />
                Commits
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 space-y-1 overflow-y-auto">
              {commits.map((commit) => (
                <div
                  key={commit.sha}
                  className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <code className="mt-0.5 shrink-0 font-mono text-xs text-primary">
                    {commit.short_sha}
                  </code>
                  <div className="min-w-0">
                    <p className="truncate">{commit.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {commit.author} · {formatRelativeTime(commit.date)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifact pins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ArtifactPinRows
                title="Tools"
                artifacts={data.tools ?? []}
                onRollback={(artifact, toVersion) =>
                  setRollbackTarget({ artifact, toVersion })
                }
              />
              <ArtifactPinRows
                title="Prompts"
                artifacts={data.prompts ?? []}
                onRollback={(artifact, toVersion) =>
                  setRollbackTarget({ artifact, toVersion })
                }
              />
              <ArtifactPinRows
                title="Connections"
                artifacts={data.connections ?? []}
                onRollback={(artifact, toVersion) =>
                  setRollbackTarget({ artifact, toVersion })
                }
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GitCompareIcon className="size-4 text-muted-foreground" aria-hidden />
                Diff
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={ref1 ?? ""} onValueChange={setRef1}>
                  <SelectTrigger className="w-56" aria-label="Base ref">
                    <SelectValue placeholder="base ref" />
                  </SelectTrigger>
                  <SelectContent>
                    {commits.map((c) => (
                      <SelectItem key={c.sha} value={c.short_sha}>
                        {c.short_sha} — {c.subject.slice(0, 40)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">→</span>
                <Select value={ref2 ?? ""} onValueChange={setRef2}>
                  <SelectTrigger className="w-56" aria-label="Compare ref">
                    <SelectValue placeholder="compare ref" />
                  </SelectTrigger>
                  <SelectContent>
                    {commits.map((c) => (
                      <SelectItem key={c.sha} value={c.short_sha}>
                        {c.short_sha} — {c.subject.slice(0, 40)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!ref1 || !ref2 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Pick two refs to compare.
                </p>
              ) : diff.error ? (
                <ErrorState error={diff.error} title="Diff failed" />
              ) : diff.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (diff.data?.files ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No changes between {ref1} and {ref2} in this project.
                </p>
              ) : (
                <div className="space-y-3">
                  {(diff.data?.files ?? []).map((file) => (
                    <div key={file.path}>
                      <p className="mb-1 font-mono text-xs text-muted-foreground">
                        {file.path}
                      </p>
                      <DiffView hunks={file.hunks} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <RollbackDialog
        project={name}
        target={rollbackTarget}
        onClose={() => setRollbackTarget(null)}
      />
    </div>
  );
}
