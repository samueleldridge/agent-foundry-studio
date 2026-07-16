/**
 * Connections — list with redacted descriptors, on-demand health checks,
 * pool refresh.
 */
import { useState } from "react";
import { useParams } from "react-router";
import { CableIcon, HeartPulseIcon, RotateCwIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useConnectionHealth,
  useConnectionRefresh,
  useConnections,
} from "@/api/hooks/useConnections";
import type { ConnectionHealthResponse } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/format";

function HealthResult({ result }: { result: ConnectionHealthResponse }) {
  return (
    <div className="mt-2 space-y-1 rounded-md border bg-muted/40 p-2">
      <div className="flex items-center gap-2 text-xs">
        <StatusBadge status={result.ok ? "healthy" : "unhealthy"} />
        <span className="text-muted-foreground">
          {(result.cases ?? []).length} case(s)
        </span>
      </div>
      {(result.cases ?? []).map((c) => (
        <div key={c.case_id} className="flex items-center gap-2 text-xs">
          <StatusBadge status={c.ok ? "ok" : "fail"} />
          <code className="font-mono">{c.case_id}</code>
          <span className="text-muted-foreground">
            {formatDuration(c.latency_ms)} — {c.message}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ConnectionsScreen() {
  const { name = "" } = useParams();
  const { data, isLoading, error } = useConnections(name);
  const health = useConnectionHealth(name);
  const refresh = useConnectionRefresh(name);
  const [healthResults, setHealthResults] = useState<
    Record<string, ConnectionHealthResponse>
  >({});
  const [checking, setChecking] = useState<string | null>(null);

  const runHealth = (conn: string) => {
    setChecking(conn);
    health.mutate(conn, {
      onSuccess: (result) =>
        setHealthResults((prev) => ({ ...prev, [conn]: result })),
      onError: (err) => toast.error(`Health check failed: ${err.message}`),
      onSettled: () => setChecking(null),
    });
  };

  const runRefresh = (conn: string) => {
    refresh.mutate(conn, {
      onSuccess: () => toast.success(`${conn}: pool refreshed`),
      onError: (err) => toast.error(`Refresh failed: ${err.message}`),
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${name} · connections`}
        description="Pinned connections with redacted config — secrets never reach the browser."
      />

      {error ? (
        <ErrorState error={error} title="Could not load connections" />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={CableIcon}
          title="No connections"
          description="This project declares no connections in system.yaml."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(data ?? []).map((conn) => (
            <Card key={conn.name}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CableIcon className="size-4 text-muted-foreground" aria-hidden />
                  {conn.name}
                </CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runHealth(conn.name)}
                    disabled={checking === conn.name}
                  >
                    <HeartPulseIcon aria-hidden />
                    {checking === conn.name ? "Checking…" : "Health"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runRefresh(conn.name)}
                    disabled={refresh.isPending}
                    aria-label={`Refresh ${conn.name} pool`}
                  >
                    <RotateCwIcon aria-hidden />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="font-mono">
                    {conn.ref}@{conn.version}
                  </Badge>
                  <Badge variant="secondary">auth: {conn.auth_scheme}</Badge>
                  {conn.principal && (
                    <Badge variant="muted">principal: {conn.principal}</Badge>
                  )}
                </div>
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
                  {JSON.stringify(conn.redacted_config, null, 2)}
                </pre>
                {healthResults[conn.name] && (
                  <HealthResult result={healthResults[conn.name]!} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
