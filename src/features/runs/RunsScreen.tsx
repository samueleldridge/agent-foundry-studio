/**
 * Run history for a project — table + detail shape, cheap polling.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { HistoryIcon } from "lucide-react";
import { useRuns } from "@/api/hooks/useRuns";
import type { RunListItem } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCost,
  formatRelativeTime,
  formatTokens,
} from "@/lib/format";

const ALL_STATUSES = "__all__";
const STATUS_OPTIONS = ["completed", "failed", "running", "approval_pending"];

export function RunsScreen() {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const { data, isLoading, error } = useRuns({
    project: name,
    ...(status !== ALL_STATUSES ? { status } : {}),
  });

  const columns = useMemo<ColumnDef<RunListItem, unknown>[]>(
    () => [
      {
        accessorKey: "run_id",
        header: "Run",
        cell: ({ row }) => (
          <code className="font-mono text-xs text-primary">
            {row.original.run_id}
          </code>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "started_at",
        header: "Started",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatRelativeTime(row.original.started_at)}
          </span>
        ),
      },
      {
        accessorKey: "total_tokens",
        header: "Tokens",
        cell: ({ row }) => formatTokens(row.original.total_tokens),
      },
      {
        accessorKey: "total_cost_usd",
        header: "Cost",
        cell: ({ row }) => formatCost(row.original.total_cost_usd),
      },
      {
        accessorKey: "error_class",
        header: "Error",
        cell: ({ row }) =>
          row.original.error_class ? (
            <code className="font-mono text-xs text-fail">
              {row.original.error_class}
            </code>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${name} · runs`}
        description="Run history from the mirror + artifact store."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {error ? (
        <ErrorState error={error} title="Could not load runs" />
      ) : !isLoading && (data ?? []).length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No runs recorded"
          description="Runs appear here once the project executes (serve, eval, or chat)."
        />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onRowClick={(run) =>
            void navigate(`/projects/${name}/runs/${run.run_id}`)
          }
        />
      )}
    </div>
  );
}
