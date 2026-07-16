/**
 * Data-panel widgets: project-health, runs-feed, doctor-panel,
 * catalog-browser, approvals-inbox, versions-panel.
 */
import { useState } from "react";
import { Link } from "react-router";
import {
  GitBranchIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  UndoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/api/client";
import { useApprovals, useResumeRun, useRuns } from "@/api/hooks/useRuns";
import { useCatalog } from "@/api/hooks/useCatalog";
import { useDoctor } from "@/api/hooks/useDoctor";
import { useProjects } from "@/api/hooks/useProjects";
import { useVersions } from "@/api/hooks/useVersions";
import type { RollbackResponse } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, formatScore } from "@/lib/format";
import type { WidgetProps } from "./types";

/** Shared "config needed" placeholder for project-scoped widgets. */
export function ConfigNeeded({ field }: { field: string }) {
  return (
    <p className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
      Configure this widget — set “{field}” from its settings menu.
    </p>
  );
}

export function WidgetLoading() {
  return (
    <div className="space-y-2 p-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

export function ProjectHealthWidget({ config }: WidgetProps) {
  const projects = useProjects();
  const name = config.project ?? "";
  if (!name) return <ConfigNeeded field="project" />;
  if (projects.error) return <ErrorState error={projects.error} className="m-2" />;
  if (projects.isLoading) return <WidgetLoading />;
  const project = (projects.data ?? []).find((p) => p.name === name);
  if (!project) {
    return <EmptyState title={`Project “${name}” not found`} className="m-2 border-0" />;
  }
  return (
    <div className="space-y-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <StatusBadge status={project.healthy ? "healthy" : "unhealthy"} />
        <span className="text-xs text-muted-foreground">{project.health_detail}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Branch</dt>
        <dd className="flex items-center gap-1 font-mono">
          <GitBranchIcon className="size-3" aria-hidden />
          {project.branch}
        </dd>
        <dt className="text-muted-foreground">Last eval score</dt>
        <dd className="font-mono">
          {project.last_eval_score == null ? "—" : formatScore(project.last_eval_score)}
        </dd>
        <dt className="text-muted-foreground">Agents / tools</dt>
        <dd className="font-mono">
          {project.agent_count} / {project.tool_count}
        </dd>
        <dt className="text-muted-foreground">Last commit</dt>
        <dd className="truncate font-mono" title={project.last_commit_subject ?? ""}>
          {project.last_commit}
        </dd>
      </dl>
    </div>
  );
}

export function RunsFeedWidget({ config }: WidgetProps) {
  const runs = useRuns(config.project ? { project: config.project } : {});
  const limit = Number(config.limit ?? "8") || 8;
  if (runs.error) return <ErrorState error={runs.error} className="m-2" />;
  if (runs.isLoading) return <WidgetLoading />;
  const rows = (runs.data ?? []).slice(0, limit);
  if (rows.length === 0) {
    return <EmptyState title="No runs yet" className="m-2 h-[calc(100%-1rem)] border-0" />;
  }
  return (
    <div className="space-y-1 overflow-y-auto p-2">
      {rows.map((run) => (
        <Link
          key={run.run_id}
          to={`/projects/${run.project}/runs/${run.run_id}`}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60"
        >
          <StatusBadge status={run.status} />
          <span className="truncate font-mono">{run.run_id}</span>
          <span className="ml-auto shrink-0 text-muted-foreground">
            {formatRelativeTime(run.started_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function DoctorWidget(_: WidgetProps) {
  const doctor = useDoctor();
  if (doctor.error) return <ErrorState error={doctor.error} className="m-2" />;
  if (doctor.isLoading) return <WidgetLoading />;
  const checks = doctor.data?.checks ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-2">
        <StatusBadge status={doctor.data?.ok ? "ok" : "fail"} />
        <Button
          variant="ghost"
          size="sm"
          disabled={doctor.isFetching}
          onClick={() => void doctor.refetch()}
        >
          <RefreshCwIcon aria-hidden /> Re-run
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {checks.map((check) => (
          <div key={check.check} className="flex items-start gap-2 px-2 py-0.5 text-xs">
            <StatusBadge status={check.status} />
            <div className="min-w-0">
              <p className="font-medium">{check.check}</p>
              <p className="truncate text-muted-foreground" title={check.detail}>
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CatalogBrowserWidget({ config }: WidgetProps) {
  const kind = config.kind ?? "tools";
  const catalog = useCatalog(kind);
  const [search, setSearch] = useState("");
  if (catalog.error) return <ErrorState error={catalog.error} className="m-2" />;
  if (catalog.isLoading) return <WidgetLoading />;
  const entries = (catalog.data ?? []).filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${kind}…`}
          className="h-8 pl-7 text-xs"
          aria-label="Search catalog"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {entries.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">No {kind} found.</p>
        )}
        {entries.map((entry) => (
          <Link
            key={entry.name}
            to="/catalog"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/60"
          >
            <span className="truncate font-mono">{entry.name}</span>
            <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
              {entry.latest ?? "—"}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ApprovalsInboxWidget({ config }: WidgetProps) {
  const approvals = useApprovals(config.project || undefined);
  const resume = useResumeRun();
  if (approvals.error) return <ErrorState error={approvals.error} className="m-2" />;
  if (approvals.isLoading) return <WidgetLoading />;
  const items = approvals.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title="No pending approvals"
        className="m-2 h-[calc(100%-1rem)] border-0"
      />
    );
  }
  return (
    <div className="space-y-1.5 overflow-y-auto p-2">
      {items.map((item) => (
        <div
          key={`${item.run_id}:${item.approval_id}`}
          className="rounded-md border px-2 py-1.5 text-xs"
        >
          <p className="truncate font-medium" title={item.prompt}>
            {item.prompt || item.approval_id}
          </p>
          <p className="mt-0.5 truncate text-muted-foreground">
            {item.project} · <span className="font-mono">{item.run_id}</span>
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={resume.isPending}
              onClick={() =>
                resume.mutate({
                  runId: item.run_id,
                  body: {
                    approval_id: item.approval_id,
                    decision: "approved",
                    reason: null,
                  },
                })
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={resume.isPending}
              onClick={() => {
                const reason = window.prompt("Reason for rejection?");
                if (reason === null || reason.trim() === "") return;
                resume.mutate({
                  runId: item.run_id,
                  body: {
                    approval_id: item.approval_id,
                    decision: "rejected",
                    reason: reason.trim(),
                  },
                });
              }}
            >
              Reject…
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VersionsPanelWidget({ config }: WidgetProps) {
  const name = config.project ?? "";
  const versions = useVersions(name);
  const [busySha, setBusySha] = useState<string | null>(null);
  if (!name) return <ConfigNeeded field="project" />;
  if (versions.error) return <ErrorState error={versions.error} className="m-2" />;
  if (versions.isLoading) return <WidgetLoading />;
  const commits = (versions.data?.commits ?? []).slice(0, 8);

  const dryRun = (sha: string) => {
    setBusySha(sha);
    apiPost<RollbackResponse>(`/api/projects/${name}/rollback`, {
      to: sha,
      force: false,
      dry_run: true,
    })
      .then((plan) => {
        toast.info(`Rollback dry-run to ${sha.slice(0, 8)}`, {
          description: plan.plan,
        });
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Rollback dry-run failed");
      })
      .finally(() => setBusySha(null));
  };

  return (
    <div className="space-y-1 overflow-y-auto p-2">
      {commits.length === 0 && (
        <p className="p-2 text-xs text-muted-foreground">No commits.</p>
      )}
      {commits.map((commit) => (
        <div key={commit.sha} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs">
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            {commit.short_sha}
          </span>
          <span className="min-w-0 truncate" title={commit.subject}>
            {commit.subject}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 shrink-0 px-1.5 text-[11px]"
            disabled={busySha !== null}
            onClick={() => dryRun(commit.sha)}
            title="Preview a rollback to this commit (dry-run)"
          >
            <UndoIcon aria-hidden />
            {busySha === commit.sha ? "…" : "dry-run"}
          </Button>
        </div>
      ))}
    </div>
  );
}
