/**
 * Chart widgets: cost-chart, latency-chart, eval-trend — compact forms of
 * the observability dashboards.
 */
import {
  useObsCost,
  useObsEvalTrend,
  useObsLatency,
} from "@/api/hooks/useObs";
import { CostChart, type CostPoint } from "@/components/charts/CostChart";
import {
  LatencyChart,
  type LatencyPoint,
} from "@/components/charts/LatencyChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { formatRelativeTime } from "@/lib/format";
import { ConfigNeeded, WidgetLoading } from "./core-widgets";
import type { WidgetProps } from "./types";

type Row = Record<string, unknown>;

function chartFilters(config: Record<string, string>) {
  return {
    ...(config.project ? { project: config.project } : {}),
    since: config.since ?? "7d",
  };
}

export function CostChartWidget({ config }: WidgetProps) {
  const cost = useObsCost({ ...chartFilters(config), by: config.by ?? "day" });
  if (cost.error) return <ErrorState error={cost.error} className="m-2" />;
  if (cost.isLoading) return <WidgetLoading />;
  const rows = ((cost.data?.rows ?? []) as Row[]).map((r) => ({
    bucket: String(r.bucket ?? ""),
    cost_usd: Number(r.cost_usd ?? 0),
    calls: Number(r.calls ?? 0),
  })) satisfies CostPoint[];
  if (rows.length === 0) {
    return <EmptyState title="No cost data" className="m-2 h-[calc(100%-1rem)] border-0" />;
  }
  return (
    <div className="h-full p-2">
      <CostChart data={rows} />
    </div>
  );
}

export function LatencyChartWidget({ config }: WidgetProps) {
  const latency = useObsLatency(chartFilters(config));
  if (latency.error) return <ErrorState error={latency.error} className="m-2" />;
  if (latency.isLoading) return <WidgetLoading />;
  const rows = ((latency.data?.rows ?? []) as Row[]).map((r) => ({
    model: String(r.model ?? r.provider ?? ""),
    p50_ms: Number(r.p50_ms ?? 0),
    p95_ms: Number(r.p95_ms ?? 0),
    calls: Number(r.calls ?? 0),
  })) satisfies LatencyPoint[];
  if (rows.length === 0) {
    return (
      <EmptyState title="No latency data" className="m-2 h-[calc(100%-1rem)] border-0" />
    );
  }
  return (
    <div className="h-full p-2">
      <LatencyChart data={rows} />
    </div>
  );
}

export function EvalTrendWidget({ config }: WidgetProps) {
  const trend = useObsEvalTrend(
    config.project ? chartFilters(config) : { since: config.since ?? "7d" },
  );
  if (!config.project) return <ConfigNeeded field="project" />;
  if (trend.error) return <ErrorState error={trend.error} className="m-2" />;
  if (trend.isLoading) return <WidgetLoading />;
  const rows = (trend.data?.rows ?? []) as Row[];
  const points: TrendPoint[] = rows
    .slice()
    .reverse()
    .map((r) => ({
      label: formatRelativeTime(
        typeof r.completed_at === "string" ? r.completed_at : null,
      ),
      score: Number(r.score ?? 0),
    }));
  const threshold =
    rows.length > 0 && rows[0]?.threshold != null ? Number(rows[0].threshold) : null;
  if (points.length === 0) {
    return (
      <EmptyState title="No eval runs yet" className="m-2 h-[calc(100%-1rem)] border-0" />
    );
  }
  return (
    <div className="h-full p-2">
      <TrendChart data={points} threshold={threshold} />
    </div>
  );
}
