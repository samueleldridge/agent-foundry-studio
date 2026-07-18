/**
 * Evals — history for the project, launch dialog (runs as a background
 * task; polled until terminal), links into per-run detail.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConicalIcon, PlayIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { useEvals, useLaunchEval, useTask } from "@/api/hooks/useEvals";
import type { EvalRunRow } from "@/api/types";
import { EvalDraftWizard } from "./EvalDraftWizard";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelativeTime, formatScore } from "@/lib/format";

function LaunchEvalDialog({
  project,
  open,
  onOpenChange,
}: {
  project: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const launch = useLaunchEval();
  const [evalSet, setEvalSet] = useState("");
  const [failUnder, setFailUnder] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = useTask(taskId, taskId !== null);

  const running =
    taskId !== null &&
    task.data?.status !== "completed" &&
    task.data?.status !== "failed";

  const submit = () => {
    launch.mutate(
      {
        scope: "project",
        target: project,
        eval_set: evalSet.trim() || null,
        fail_under: failUnder.trim() ? Number(failUnder) : null,
      },
      {
        onSuccess: (res) => {
          setTaskId(res.task_id);
          toast.success("Eval launched", { description: `task ${res.task_id}` });
        },
        onError: (err) => toast.error(`Launch failed: ${err.message}`),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTaskId(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run eval</DialogTitle>
          <DialogDescription>
            Runs the project eval set as a background task; results land in the
            history below when the task completes.
          </DialogDescription>
        </DialogHeader>
        {taskId === null ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="eval-set">Eval set (optional — project default)</Label>
              <Input
                id="eval-set"
                value={evalSet}
                onChange={(e) => setEvalSet(e.target.value)}
                placeholder="evals/greeting.yaml"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fail-under">Fail under (optional)</Label>
              <Input
                id="fail-under"
                value={failUnder}
                onChange={(e) => setFailUnder(e.target.value)}
                placeholder="0.9"
                inputMode="decimal"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              Task <code className="font-mono text-xs">{taskId}</code>
              <StatusBadge status={task.data?.status ?? "running"} />
            </p>
            {task.data?.error != null && (
              <p className="text-xs text-fail">{String(task.data.error)}</p>
            )}
            {task.data?.status === "completed" && (
              <p className="text-xs text-muted-foreground">
                Done — the run appears in the history below.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {taskId === null && (
            <Button onClick={submit} disabled={launch.isPending}>
              <PlayIcon aria-hidden />
              {launch.isPending ? "Launching…" : "Launch"}
            </Button>
          )}
          {running && (
            <Button disabled>
              <StatusBadge status="running" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EvalsScreen() {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useEvals(name);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const columns = useMemo<ColumnDef<EvalRunRow, unknown>[]>(
    () => [
      {
        accessorKey: "eval_name",
        header: "Eval",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.eval_name}</span>
        ),
      },
      {
        accessorKey: "passed",
        header: "Result",
        cell: ({ row }) => (
          <StatusBadge status={row.original.passed ? "passed" : "failed"} />
        ),
      },
      {
        accessorKey: "score",
        header: "Score",
        cell: ({ row }) => (
          <span className="font-mono">
            {formatScore(row.original.score)}
            <span className="text-muted-foreground">
              {" "}
              / {formatScore(row.original.threshold)}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "target_ref",
        header: "Target",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.target_ref}
          </Badge>
        ),
      },
      {
        accessorKey: "completed_at",
        header: "Completed",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.completed_at)}
          </span>
        ),
      },
      {
        accessorKey: "eval_run_id",
        header: "Run id",
        cell: ({ row }) => (
          <code className="font-mono text-xs">{row.original.eval_run_id}</code>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${name} · evals`}
        description="Eval runs for this project; click a row for per-case detail."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDraftOpen(true)}>
              <WandSparklesIcon aria-hidden /> Draft with AI
            </Button>
            <Button onClick={() => setLaunchOpen(true)}>
              <PlayIcon aria-hidden /> Run eval
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} title="Could not load eval history" />
      ) : !isLoading && (data ?? []).length === 0 ? (
        <EmptyState
          icon={FlaskConicalIcon}
          title="No eval runs yet"
          description="Launch an eval to score this project against its eval set."
          action={
            <Button onClick={() => setLaunchOpen(true)}>
              <PlayIcon aria-hidden /> Run eval
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onRowClick={(row) =>
            void navigate(`/projects/${name}/evals/${row.eval_run_id}`)
          }
        />
      )}

      <LaunchEvalDialog
        project={name}
        open={launchOpen}
        onOpenChange={setLaunchOpen}
      />
      <EvalDraftWizard
        project={name}
        open={draftOpen}
        onOpenChange={setDraftOpen}
      />
    </div>
  );
}
