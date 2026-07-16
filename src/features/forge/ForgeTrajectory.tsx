/**
 * ForgeTrajectory — the live/historical trajectory view shared by the
 * forge run detail screen and the `forge-console` widget: per-iteration
 * score chart, commit list, sandbox-violation alerts, termination banner.
 */
import { useMemo } from "react";
import { OctagonAlertIcon } from "lucide-react";
import type { SSEEvent } from "@/api/sse";
import type { ForgeRunInfo } from "@/api/types";
import { EventFeed } from "@/components/EventFeed";
import { TrendChart } from "@/components/charts/TrendChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCost, formatScore } from "@/lib/format";
import {
  iterationsFromEvents,
  iterationsFromTrajectory,
  mergeIterations,
  terminationFromEvents,
  violationsFromEvents,
} from "./forge-trajectory";

export function ForgeTrajectory({
  info,
  events,
  compact = false,
}: {
  info: ForgeRunInfo;
  events: SSEEvent[];
  compact?: boolean;
}) {
  const iterations = useMemo(
    () =>
      mergeIterations(
        iterationsFromTrajectory(info.trajectory ?? []),
        iterationsFromEvents(events),
      ),
    [info.trajectory, events],
  );
  const violations = useMemo(() => violationsFromEvents(events), [events]);
  const termination = terminationFromEvents(events);
  const terminationReason = termination?.reason ?? info.termination_reason;
  const finalScore = termination?.finalScore ?? info.final_score;

  const scorePoints = iterations
    .filter((it) => it.score !== null)
    .map((it) => ({ label: `#${it.iteration}`, score: it.score ?? 0 }));

  return (
    <div className="space-y-3" data-slot="forge-trajectory">
      {violations.map((v, i) => (
        <Alert key={i} variant="destructive" data-slot="sandbox-violation">
          <OctagonAlertIcon aria-hidden />
          <AlertTitle>Sandbox violation</AlertTitle>
          <AlertDescription>
            <p>
              <span className="font-mono">{v.tool}</span>
              {v.detail && ` — ${v.detail}`}
            </p>
          </AlertDescription>
        </Alert>
      ))}

      {terminationReason && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
          data-slot="forge-termination"
        >
          <StatusBadge status={info.status} />
          <span>
            terminated: <span className="font-medium">{terminationReason}</span>
          </span>
          {finalScore != null && <span>final score {formatScore(finalScore)}</span>}
          {info.termination_detail && (
            <span className="text-xs text-muted-foreground">
              {info.termination_detail}
            </span>
          )}
        </div>
      )}

      {scorePoints.length > 0 && (
        <div className={compact ? "h-32" : "h-48"}>
          <TrendChart data={scorePoints} threshold={info.threshold} />
        </div>
      )}

      {iterations.length > 0 && (
        <div className="space-y-1.5">
          {iterations.map((it) => (
            <div
              key={`${it.kind}-${it.iteration}`}
              className="rounded-md border px-2.5 py-1.5 text-xs"
              data-slot="forge-iteration"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {it.kind === "bootstrap" ? "bootstrap" : `iteration ${it.iteration}`}
                </Badge>
                {it.score !== null && <span>score {formatScore(it.score)}</span>}
                {it.delta !== null && it.delta !== 0 && (
                  <span className={it.delta > 0 ? "text-ok" : "text-fail"}>
                    {it.delta > 0 ? "+" : ""}
                    {formatScore(it.delta)}
                  </span>
                )}
                {it.costUsd !== null && (
                  <span className="text-muted-foreground">{formatCost(it.costUsd)}</span>
                )}
                {!it.applied && <Badge variant="muted">rolled back</Badge>}
                {it.commits.map((sha) => (
                  <span
                    key={sha}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]"
                    title={sha}
                  >
                    {sha.slice(0, 8)}
                  </span>
                ))}
              </div>
              {!compact && it.summary && (
                <p className="mt-1 line-clamp-2 text-muted-foreground" title={it.summary}>
                  {it.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!compact && events.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Event log</p>
          <EventFeed events={events} />
        </div>
      )}
    </div>
  );
}
