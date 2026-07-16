/**
 * Forge run detail — live SSE trajectory while running (iterations,
 * scores, commits, sandbox violations, termination), cancel, and the
 * historical artifact view for finished runs.
 */
import { Link, useParams } from "react-router";
import { ArrowLeftIcon, OctagonXIcon } from "lucide-react";
import { toast } from "sonner";
import { useCancelForge, useForgeRun } from "@/api/hooks/useForge";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCost, formatRelativeTime, formatScore } from "@/lib/format";
import { ForgeTrajectory } from "./ForgeTrajectory";
import { useForgeStream } from "./use-forge-stream";

export function ForgeRunDetail() {
  const { forgeRunId = "" } = useParams();
  const info = useForgeRun(forgeRunId, true);
  const live = info.data?.status === "running";
  const { events, status: streamStatus } = useForgeStream(forgeRunId, live);
  const cancel = useCancelForge();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Forge run"
        description={forgeRunId}
        actions={
          <div className="flex items-center gap-2">
            {live && (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(forgeRunId, {
                    onSuccess: () => toast.success("Cancel requested"),
                  })
                }
              >
                <OctagonXIcon aria-hidden /> Cancel
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/forge">
                <ArrowLeftIcon aria-hidden /> All forge runs
              </Link>
            </Button>
          </div>
        }
      />

      {info.error ? (
        <ErrorState error={info.error} title="Could not load the forge run" />
      ) : info.isLoading || !info.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-4 text-sm">
              <StatusBadge status={info.data.status} />
              <div>
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="font-mono">{info.data.project}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Iterations</p>
                <p className="font-mono">{info.data.iterations}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Threshold</p>
                <p className="font-mono">
                  {info.data.threshold == null ? "—" : formatScore(info.data.threshold)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Best score</p>
                <p className="font-mono">
                  {info.data.best_score == null ? "—" : formatScore(info.data.best_score)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="font-mono">
                  {formatCost(
                    info.data.total_cost_usd == null
                      ? null
                      : Number(info.data.total_cost_usd),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-mono">{formatRelativeTime(info.data.started_at)}</p>
              </div>
              {live && (
                <p className="text-xs text-primary">
                  live · stream {streamStatus}
                </p>
              )}
            </CardContent>
          </Card>

          <ForgeTrajectory info={info.data} events={events} />
        </>
      )}
    </div>
  );
}
