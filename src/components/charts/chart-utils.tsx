import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3Icon } from "lucide-react";

/** Shared axis/tooltip styling on theme tokens — never hard-coded colors. */
export const axisStyle = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  axisLine: { stroke: "var(--border)" },
  tickLine: { stroke: "var(--border)" },
} as const;

export const gridStroke = "var(--border)";

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.375rem",
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "color-mix(in oklab, var(--accent) 50%, transparent)" },
} as const;

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

interface ChartCardProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function ChartCard({
  title,
  isLoading = false,
  isEmpty = false,
  emptyText = "No data recorded yet.",
  children,
  actions,
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : isEmpty ? (
          <EmptyState
            icon={BarChart3Icon}
            title={emptyText}
            description="Data appears here as runs are recorded to the local observability store."
            className="h-56 border-0"
          />
        ) : (
          <div className="h-56 w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
