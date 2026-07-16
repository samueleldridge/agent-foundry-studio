/**
 * Observability dashboards — cost / latency / tool-failures / eval-trend /
 * runs feed, rendered from the local SQLite mirror via the obs routes.
 */
import { useMemo, useState } from "react";
import {
  useObsCost,
  useObsEvalTrend,
  useObsLatency,
  useObsRuns,
  useObsToolFailures,
} from "@/api/hooks/useObs";
import { useProjects } from "@/api/hooks/useProjects";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ChartCard } from "@/components/charts/chart-utils";
import { CostChart, type CostPoint } from "@/components/charts/CostChart";
import {
  LatencyChart,
  type LatencyPoint,
} from "@/components/charts/LatencyChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCost,
  formatDuration,
  formatRelativeTime,
  formatTokens,
} from "@/lib/format";

const SINCE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

const ALL_PROJECTS = "__all__";

type Row = Record<string, unknown>;

export function ObsScreen() {
  const [since, setSince] = useState<string>("7d");
  const [project, setProject] = useState<string>(ALL_PROJECTS);

  const filters = useMemo(
    () => ({
      since,
      ...(project !== ALL_PROJECTS ? { project } : {}),
    }),
    [since, project],
  );

  const { data: projects } = useProjects();
  const cost = useObsCost({ ...filters, by: "day" });
  const latency = useObsLatency(filters);
  const failures = useObsToolFailures(filters);
  const trend = useObsEvalTrend(filters);
  const runs = useObsRuns(filters);

  const costRows = ((cost.data?.rows ?? []) as Row[]).map((r) => ({
    bucket: String(r.bucket ?? ""),
    cost_usd: Number(r.cost_usd ?? 0),
    calls: Number(r.calls ?? 0),
  })) satisfies CostPoint[];

  const latencyRows = ((latency.data?.rows ?? []) as Row[]).map((r) => ({
    model: String(r.model ?? r.provider ?? ""),
    p50_ms: Number(r.p50_ms ?? 0),
    p95_ms: Number(r.p95_ms ?? 0),
    calls: Number(r.calls ?? 0),
  })) satisfies LatencyPoint[];

  const trendRows = (trend.data?.rows ?? []) as Row[];
  const trendPoints: TrendPoint[] = trendRows
    .slice()
    .reverse()
    .map((r) => ({
      label: formatRelativeTime(
        typeof r.completed_at === "string" ? r.completed_at : null,
      ),
      score: Number(r.score ?? 0),
      threshold: r.threshold == null ? null : Number(r.threshold),
    }));
  const trendThreshold =
    trendRows.length > 0 && trendRows[0]?.threshold != null
      ? Number(trendRows[0].threshold)
      : null;

  const failureRows = (failures.data?.rows ?? []) as Row[];
  const runRows = (runs.data?.rows ?? []) as Row[];

  const firstError =
    cost.error ?? latency.error ?? trend.error ?? runs.error ?? failures.error;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Observability"
        description="Cost, latency, tool failures, and eval trend from the local run mirror."
        actions={
          <div className="flex gap-2">
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="w-40" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={since} onValueChange={setSince}>
              <SelectTrigger className="w-36" aria-label="Time window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SINCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {firstError && <ErrorState error={firstError} title="Some panels failed to load" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cost per day"
          isLoading={cost.isLoading}
          isEmpty={costRows.length === 0}
        >
          <CostChart data={costRows} />
        </ChartCard>

        <ChartCard
          title="Latency by model (p50 / p95)"
          isLoading={latency.isLoading}
          isEmpty={latencyRows.length === 0}
        >
          <LatencyChart data={latencyRows} />
        </ChartCard>

        <ChartCard
          title="Eval trend"
          isLoading={trend.isLoading}
          isEmpty={trendPoints.length === 0}
          emptyText="No eval runs recorded yet."
        >
          <TrendChart data={trendPoints} threshold={trendThreshold} />
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Tool failures</CardTitle>
          </CardHeader>
          <CardContent>
            {failureRows.length === 0 ? (
              <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No tool failures in this window.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {Object.keys(failureRows[0] ?? {}).map((key) => (
                      <TableHead key={key}>{key.replaceAll("_", " ")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failureRows.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((value, j) => (
                        <TableCell key={j} className="font-mono text-xs">
                          {String(value ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runs feed</CardTitle>
        </CardHeader>
        <CardContent>
          {runRows.length === 0 ? (
            <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No runs in this window.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Run</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {String(row.run_id ?? "—")}
                    </TableCell>
                    <TableCell>{String(row.project ?? "—")}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(row.status ?? "unknown")} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(
                        typeof row.started_at === "string" ? row.started_at : null,
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDuration(
                        row.duration_ms == null ? null : Number(row.duration_ms),
                      )}
                    </TableCell>
                    <TableCell>
                      {formatTokens(
                        Number(row.total_input_tokens ?? 0) +
                          Number(row.total_output_tokens ?? 0),
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCost(
                        row.total_cost_usd == null
                          ? null
                          : Number(row.total_cost_usd),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
