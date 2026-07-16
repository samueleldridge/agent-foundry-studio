import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatScore } from "@/lib/format";
import { axisStyle, gridStroke, tooltipStyle, CHART_COLORS } from "./chart-utils";

export interface TrendPoint {
  label: string;
  score: number;
  threshold?: number | null;
}

export function TrendChart({
  data,
  threshold,
}: {
  data: TrendPoint[];
  threshold?: number | null;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...axisStyle} />
        <YAxis
          {...axisStyle}
          domain={[0, 1]}
          tickFormatter={(v: number) => formatScore(v)}
          width={40}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatScore(Number(value)), "score"]}
        />
        {threshold !== null && threshold !== undefined && (
          <ReferenceLine
            y={threshold}
            stroke="var(--warn)"
            strokeDasharray="4 4"
            label={{
              value: `threshold ${formatScore(threshold)}`,
              fill: "var(--muted-foreground)",
              fontSize: 10,
              position: "insideBottomRight",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="score"
          stroke={CHART_COLORS[4]}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS[4] }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
