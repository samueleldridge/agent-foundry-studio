/**
 * Doctor page — the full check suite (same checks, same order as
 * `foundry doctor --json`) with ok/warn/fail states and on-demand re-run.
 */
import { RefreshCwIcon } from "lucide-react";
import { useDoctor } from "@/api/hooks/useDoctor";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DoctorScreen() {
  const { data, isLoading, isFetching, error, refetch } = useDoctor();

  const checks = data?.checks ?? [];
  const failing = checks.filter((c) => c.status === "fail").length;
  const warning = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctor"
        description="Environment and configuration checks for this repo."
        actions={
          <Button
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Re-run checks"
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} aria-hidden />
            {isFetching ? "Running…" : "Re-run checks"}
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} title="Doctor could not run" />
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Badge variant="ok">{checks.length - failing - warning} ok</Badge>
            {warning > 0 && <Badge variant="warn">{warning} warn</Badge>}
            {failing > 0 && <Badge variant="fail">{failing} fail</Badge>}
          </div>

          <Card>
            <CardContent className="divide-y px-0 py-0">
              {checks.map((check) => (
                <div
                  key={check.check}
                  className="flex items-start justify-between gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{check.check}</p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      {check.detail}
                    </p>
                    {check.remedy && (
                      <p className="mt-0.5 text-xs italic text-warn-foreground dark:text-warn">
                        remedy: {check.remedy}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={check.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
