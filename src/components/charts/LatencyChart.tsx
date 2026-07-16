import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration } from "@/lib/format";
import { axisStyle, gridStroke, tooltipStyle, CHART_COLORS } from "./chart-utils";

export interface LatencyPoint {
  model: string;
  p50_ms: number;
  p95_ms: number;
  calls?: number;
}

export function LatencyChart({ data }: { data: LatencyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="model" {...axisStyle} />
        <YAxis
          {...axisStyle}
          tickFormatter={(v: number) => formatDuration(v)}
          width={60}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [formatDuration(Number(value)), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
        <Bar dataKey="p50_ms" name="p50" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="p95_ms" name="p95" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
