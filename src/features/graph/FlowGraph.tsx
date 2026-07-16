/**
 * FlowGraph — React Flow renderer over a GraphExport. Interactive by
 * default (minimap / fit / zoom / node click); `interactive={false}` is
 * the fitted, non-interactive `flow-graph-mini` widget variant.
 */
import { useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphExport, GraphNode } from "@/api/graph";
import { useTheme } from "@/theme/ThemeProvider";
import {
  AgentGraphNode,
  FunctionGraphNode,
  TerminalGraphNode,
} from "./GraphNodes";
import { layoutGraph, type FlowNodeData, type LayoutDirection } from "./graph-layout";

const GRAPH_NODE_TYPES = {
  agent: AgentGraphNode,
  function: FunctionGraphNode,
  terminal: TerminalGraphNode,
};

interface FlowGraphProps {
  graph: GraphExport;
  direction?: LayoutDirection;
  interactive?: boolean;
  onNodeSelect?: (node: GraphNode | null) => void;
  className?: string;
}

export function FlowGraph({
  graph,
  direction = "LR",
  interactive = true,
  onNodeSelect,
  className,
}: FlowGraphProps) {
  const { theme } = useTheme();
  const { nodes, edges } = useMemo(
    () => layoutGraph(graph, direction),
    [graph, direction],
  );

  return (
    <div className={className ?? "h-full w-full"} data-slot="flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={GRAPH_NODE_TYPES}
        colorMode={theme === "dark" ? "dark" : "light"}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        panOnDrag={interactive}
        preventScrolling={interactive}
        onNodeClick={
          onNodeSelect
            ? (_, node: Node) => onNodeSelect((node.data as FlowNodeData).graphNode)
            : undefined
        }
        onPaneClick={onNodeSelect ? () => onNodeSelect(null) : undefined}
      >
        <Background gap={16} />
        {interactive && <Controls showInteractive={false} />}
        {interactive && <MiniMap pannable zoomable className="!bg-muted" />}
      </ReactFlow>
    </div>
  );
}
