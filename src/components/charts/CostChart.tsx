import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCost } from "@/lib/format";
import { axisStyle, gridStroke, tooltipStyle, CHART_COLORS } from "./chart-utils";

export interface CostPoint {
  bucket: string;
  cost_usd: number;
  calls?: number;
}

export function CostChart({ data }: { data: CostPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" {...axisStyle} />
        <YAxis
          {...axisStyle}
          tickFormatter={(v: number) => formatCost(v)}
          width={70}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatCost(Number(value)), "cost"]}
        />
        <Bar
          dataKey="cost_usd"
          fill={CHART_COLORS[0]}
          radius={[3, 3, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
