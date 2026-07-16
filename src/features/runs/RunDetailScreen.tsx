/**
 * Run detail — status card + live event timeline (SSE replay of persisted
 * RunEvents, staying attached while an in-progress run streams) +
 * RunArtifact view (inputs, outputs, state transitions, llm/tool call
 * indexes).
 */
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useRun, useRunArtifact } from "@/api/hooks/useRuns";
import { useSSE } from "@/api/sse";
import { EventFeed } from "@/components/EventFeed";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  formatCost,
  formatTimestamp,
  formatTokens,
} from "@/lib/format";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg border bg-card p-3 font-mono text-xs">
      {JSON.stringify(value, null, 2) ?? "null"}
    </pre>
  );
}

const RUN_TERMINAL = ["run.completed", "run.failed", "run.cancelled"] as const;

export function RunDetailScreen() {
  const { name = "", runId = "" } = useParams();
  const run = useRun(runId);
  const artifact = useRunArtifact(runId);
  const queryClient = useQueryClient();

  // Event timeline: SSE replay of persisted events; for an in-progress run
  // the stream stays open and follows live. Terminal frames close it and
  // refresh the status card + artifact.
  const live =
    run.data !== undefined &&
    !["success", "completed", "failed", "cancelled", "max_hops"].includes(
      run.data.status,
    );
  const feed = useSSE(run.data ? `/api/runs/${runId}/events` : null, {
    terminalEvents: RUN_TERMINAL,
    onEvent: (event) => {
      if ((RUN_TERMINAL as readonly string[]).includes(event.event)) {
        void queryClient.invalidateQueries({ queryKey: ["runs"] });
      }
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Run detail"
        description={runId}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/projects/${name}/runs`}>
              <ArrowLeftIcon aria-hidden /> All runs
            </Link>
          </Button>
        }
      />

      {run.error ? (
        <ErrorState error={run.error} title="Could not load run" />
      ) : run.isLoading || !run.data ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-4 text-sm">
            <StatusBadge status={run.data.status} />
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="font-mono">{formatTimestamp(run.data.started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-mono">{formatTimestamp(run.data.completed_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens</p>
              <p className="font-mono">{formatTokens(run.data.total_tokens)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="font-mono">{formatCost(run.data.total_cost_usd)}</p>
            </div>
            {run.data.error_class && (
              <div>
                <p className="text-xs text-muted-foreground">Error</p>
                <p className="font-mono text-fail">{run.data.error_class}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Events
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {live ? `live · stream ${feed.status}` : "replayed from the persisted stream"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventFeed events={feed.events} emptyMessage="No events yet." />
        </CardContent>
      </Card>

      {artifact.error ? (
        <ErrorState error={artifact.error} title="Could not load run artifact" />
      ) : artifact.isLoading || !artifact.data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Run artifact
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {artifact.data.event_count} events persisted
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="io">
              <TabsList>
                <TabsTrigger value="io">Input / output</TabsTrigger>
                <TabsTrigger value="state">
                  State transitions ({(artifact.data.state_transitions ?? []).length})
                </TabsTrigger>
                <TabsTrigger value="llm">
                  LLM calls ({(artifact.data.llm_calls ?? []).length})
                </TabsTrigger>
                <TabsTrigger value="tools">
                  Tool calls ({(artifact.data.tool_calls ?? []).length})
                </TabsTrigger>
                <TabsTrigger value="meta">Metadata</TabsTrigger>
              </TabsList>
              <TabsContent value="io" className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Inputs</p>
                <JsonBlock value={artifact.data.inputs} />
                <p className="text-xs font-medium text-muted-foreground">Outputs</p>
                <JsonBlock value={artifact.data.outputs} />
              </TabsContent>
              <TabsContent value="state">
                <JsonBlock value={artifact.data.state_transitions} />
              </TabsContent>
              <TabsContent value="llm">
                <JsonBlock value={artifact.data.llm_calls} />
              </TabsContent>
              <TabsContent value="tools">
                <JsonBlock value={artifact.data.tool_calls} />
              </TabsContent>
              <TabsContent value="meta">
                <JsonBlock value={artifact.data.metadata} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
