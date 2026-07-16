/**
 * Dagre auto-layout for GraphExport → React Flow nodes/edges.
 *
 * Pure functions (unit-tested without a DOM): the server owns flow
 * semantics; layout is the only client-side computation (docs/72).
 */
import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { GraphEdge, GraphExport, GraphNode } from "@/api/graph";

export type LayoutDirection = "LR" | "TB";

export interface FlowNodeData {
  graphNode: GraphNode;
  direction: LayoutDirection;
  [key: string]: unknown;
}

/** Node card dimensions per kind — dagre needs sizes up front. */
export function nodeSize(node: GraphNode): { width: number; height: number } {
  switch (node.kind) {
    case "agent":
      return { width: 220, height: 84 };
    case "function":
      return { width: 180, height: 64 };
    default:
      return { width: 72, height: 36 };
  }
}

function edgeStyle(edge: GraphEdge): Partial<Edge> {
  switch (edge.kind) {
    case "conditional":
      return {
        style: { strokeDasharray: "6 4", strokeWidth: 1.5 },
        label: edge.label ?? undefined,
      };
    case "handoff":
      return {
        style: { strokeWidth: 2 },
        animated: true,
        ...(edge.bidirectional
          ? {
              markerStart: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            }
          : {}),
      };
    case "parallel":
      return { style: { strokeWidth: 1.5 } };
    case "join":
      return { style: { strokeWidth: 1, opacity: 0.6 } };
    default:
      return { style: { strokeWidth: 1.5 } };
  }
}

export interface LayoutResult {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

/**
 * Position every node with dagre and map edges to styled React Flow
 * edges. `direction` LR (default) or TB.
 */
export function layoutGraph(
  graph: GraphExport,
  direction: LayoutDirection = "LR",
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, nodeSize(node));
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const nodes: Node<FlowNodeData>[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    const { width, height } = nodeSize(node);
    return {
      id: node.id,
      type: node.kind === "agent" ? "agent" : node.kind === "function" ? "function" : "terminal",
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
      width,
      height,
      data: { graphNode: node, direction },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    ...edgeStyle(edge),
  }));

  return { nodes, edges };
}
