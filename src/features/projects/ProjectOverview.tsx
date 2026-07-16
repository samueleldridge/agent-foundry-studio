import { Link, useParams } from "react-router";
import {
  CableIcon,
  FileCode2Icon,
  FlaskConicalIcon,
  GitBranchIcon,
  HistoryIcon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react";
import { useProject } from "@/api/hooks/useProjects";
import { useRuns } from "@/api/hooks/useRuns";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCost, formatRelativeTime } from "@/lib/format";

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-44" />
      <Skeleton className="h-44" />
      <Skeleton className="h-44 col-span-2" />
    </div>
  );
}

export function ProjectOverview() {
  const { name = "" } = useParams();
  const { data: project, isLoading, error } = useProject(name);
  const { data: runs } = useRuns({ project: name });

  // The generated types mark defaulted fields optional; normalize once.
  const tools = project?.tools ?? {};
  const connections = project?.connections ?? {};
  const guardrails = (project?.guardrails ?? {}) as Record<string, unknown>;
  const agents = project?.agents ?? [];

  if (error) {
    return <ErrorState error={error} title={`Could not load ${name}`} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={name}
        description={project?.description ?? undefined}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={`/projects/${name}/configs`}>
                <FileCode2Icon aria-hidden /> Edit configs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${name}/evals`}>
                <FlaskConicalIcon aria-hidden /> Evals
              </Link>
            </Button>
          </>
        }
      />

      {isLoading || !project ? (
        <OverviewSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon className="size-4 text-muted-foreground" aria-hidden />
                System
              </CardTitle>
              <Badge variant="secondary" className="font-mono">
                {project.system_version}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flow pattern</span>
                <span className="font-medium">{project.flow_pattern}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guardrails</span>
                <span className="font-mono text-xs">
                  iter ≤ {String(guardrails.max_iterations ?? "—")} · hops ≤{" "}
                  {String(guardrails.max_hops ?? "—")}
                  {guardrails.max_cost_usd != null &&
                    ` · ${formatCost(Number(guardrails.max_cost_usd))}`}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Tool pins</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {Object.entries(tools).map(([alias, ref]) => (
                    <Badge key={alias} variant="outline" className="font-mono">
                      {alias} → {ref}
                    </Badge>
                  ))}
                  {Object.keys(tools).length === 0 && (
                    <span className="text-muted-foreground">none</span>
                  )}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Connections</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {Object.entries(connections).map(([alias, ref]) => (
                    <Badge key={alias} variant="outline" className="font-mono">
                      <CableIcon aria-hidden />
                      {alias} → {ref}
                    </Badge>
                  ))}
                  {Object.keys(connections).length === 0 && (
                    <span className="text-muted-foreground">none</span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WrenchIcon className="size-4 text-muted-foreground" aria-hidden />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.name} className="rounded-md border p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{agent.name}</span>
                    <Badge variant="secondary" className="font-mono">
                      {agent.model_binding}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      prompt <code className="font-mono">{agent.prompt_version}</code>
                    </span>
                    <span>
                      reads <code className="font-mono">{(agent.state_read ?? []).join(", ") || "—"}</code>
                    </span>
                    <span>
                      writes <code className="font-mono">{(agent.state_write ?? []).join(", ") || "—"}</code>
                    </span>
                    {(agent.tools ?? []).length > 0 && (
                      <span>
                        tools <code className="font-mono">{(agent.tools ?? []).join(", ")}</code>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
                Recent runs
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/projects/${name}/runs`}>View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(runs ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No runs recorded for this project yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(runs ?? []).slice(0, 5).map((run) => (
                      <TableRow key={run.run_id}>
                        <TableCell>
                          <Link
                            to={`/projects/${name}/runs/${run.run_id}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {run.run_id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={run.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(run.started_at)}
                        </TableCell>
                        <TableCell>{formatCost(run.total_cost_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-muted-foreground" aria-hidden />
                Where next
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${name}/versions`}>Versions & rollback</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${name}/connections`}>Connections health</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${name}/runs`}>Run history</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/obs">Observability</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
