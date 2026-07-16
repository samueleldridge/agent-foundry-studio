/**
 * Flow-graph screen — renders the graph-export endpoint's GraphExport with
 * React Flow + dagre. A non-compiling project surfaces the server's
 * ValidationResult with a link into the config editor.
 */
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeftIcon,
  FileCode2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { ApiError } from "@/api/client";
import { useGraph, type GraphNode } from "@/api/graph";
import type { ValidationResult } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FlowGraph } from "./FlowGraph";
import { GraphSidePanel } from "./GraphSidePanel";
import type { LayoutDirection } from "./graph-layout";

function validationResultFrom(error: unknown): ValidationResult | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const payload = error.payload as Record<string, unknown> | null;
  if (payload && typeof payload === "object" && Array.isArray(payload.issues)) {
    return payload as unknown as ValidationResult;
  }
  return null;
}

function CompileErrorPanel({
  project,
  result,
}: {
  project: string;
  result: ValidationResult;
}) {
  return (
    <Alert variant="destructive" data-slot="graph-compile-error">
      <AlertTitle>Project does not compile</AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {(result.issues ?? []).map((issue, i) => (
            <li key={i}>
              <span className="font-medium">{issue.severity}:</span> {issue.message}
              {issue.pointer && (
                <span className="ml-1 font-mono text-xs">({issue.pointer})</span>
              )}
              {issue.hint && (
                <p className="text-xs text-muted-foreground">hint: {issue.hint}</p>
              )}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/projects/${project}/configs`}>
            <FileCode2Icon aria-hidden /> Open config editor
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function GraphScreen() {
  const { name = "" } = useParams();
  const graph = useGraph(name);
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const validation = validationResultFrom(graph.error);

  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader
        title="Flow graph"
        description={
          graph.data
            ? `pattern: ${graph.data.pattern} · primary agent: ${graph.data.primary_agent}`
            : name
        }
        actions={
          <div className="flex items-center gap-2">
            {graph.data && (
              <Badge
                variant="secondary"
                className="font-mono text-[10px]"
                title={`system_version ${graph.data.system_version}`}
              >
                {graph.data.system_version.slice(0, 12)}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDirection((d) => (d === "LR" ? "TB" : "LR"))
              }
            >
              <ArrowRightLeftIcon aria-hidden /> {direction === "LR" ? "Top-down" : "Left-right"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={graph.isFetching}
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["projects", name, "graph"],
                })
              }
            >
              <RefreshCwIcon aria-hidden /> Recompile
            </Button>
          </div>
        }
      />

      {graph.isLoading ? (
        <Skeleton className="h-[520px] w-full" />
      ) : validation ? (
        <CompileErrorPanel project={name} result={validation} />
      ) : graph.error ? (
        <ErrorState error={graph.error} title="Could not export the flow graph" />
      ) : graph.data ? (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="h-[540px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
            <FlowGraph
              graph={graph.data}
              direction={direction}
              onNodeSelect={setSelected}
            />
          </div>
          {selected && (
            <GraphSidePanel
              project={name}
              node={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
