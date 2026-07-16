/**
 * GraphExport — the normative flow-graph schema (docs/72 § Flow-graph
 * visualisation). Produced entirely server-side by walking the compiled
 * FlowPlan; the frontend does layout + rendering only and never
 * re-implements flow semantics.
 *
 * These interfaces mirror `foundry.studio.schemas.GraphExport` verbatim.
 * The route serialises through a JSONResponse (so it can return a 422
 * ValidationResult for non-compiling projects), which leaves the OpenAPI
 * response as `unknown` — hence this one hand-maintained mirror of the
 * normative schema instead of a generated alias.
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";

export type GraphNodeKind = "agent" | "function" | "start" | "end";
export type GraphNodeRole =
  | "single"
  | "supervisor"
  | "worker"
  | "step"
  | "branch"
  | "join";
export type GraphEdgeKind =
  | "sequential"
  | "handoff"
  | "conditional"
  | "parallel"
  | "join";

export interface AgentSummary {
  /** e.g. "anthropic/claude-haiku-4-5" */
  model_binding: string;
  prompt_version: string;
  /** Pinned refs, e.g. "catalog/word_stats@v2". */
  tools: string[];
  state_read: string[];
  state_write: string[];
}

export interface FunctionSummary {
  version: string;
  state_read: string[];
  state_write: string[];
}

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  role: GraphNodeRole | null;
  label: string;
  group: string | null;
  agent: AgentSummary | null;
  function: FunctionSummary | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /** Predicate source for conditional edges; null otherwise. */
  label: string | null;
  /** Supervisor ↔ worker handoff pairs collapse to one edge. */
  bidirectional: boolean;
}

export interface GraphExport {
  project: string;
  /** Content hash — stale-graph detection after edits. */
  system_version: string;
  pattern: string;
  primary_agent: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: string[];
}

/**
 * Compile the project server-side and fetch its GraphExport.
 * A non-compiling project raises an ApiError whose `payload` is the
 * ValidationResult (422) — the screen renders the issues.
 */
export function useGraph(project: string | null) {
  return useQuery({
    queryKey: ["projects", project, "graph"],
    queryFn: () => apiGet<GraphExport>(`/api/projects/${project}/graph`),
    enabled: project !== null && project !== "",
    retry: false,
  });
}
