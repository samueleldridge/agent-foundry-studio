/**
 * Graph layout — GraphExport fixtures (hello single-agent AND team_hello
 * supervisor + workers) → positioned React Flow nodes + styled edges. The
 * server owns flow semantics; layout is the only client-side computation.
 */
import { describe, expect, it } from "vitest";
import { MarkerType } from "@xyflow/react";
import { layoutGraph, nodeSize } from "@/features/graph/graph-layout";
import { graphHello, graphTeamHello } from "./msw/fixtures";

describe("layoutGraph — hello (single)", () => {
  const { nodes, edges } = layoutGraph(graphHello);

  it("maps every node with a finite dagre position", () => {
    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it("orders start → agent → end left-to-right", () => {
    const x = (id: string) => nodes.find((n) => n.id === id)!.position.x;
    expect(x("__start__")).toBeLessThan(x("hello_agent"));
    expect(x("hello_agent")).toBeLessThan(x("__end__"));
  });

  it("types nodes by kind (terminal vs agent card)", () => {
    expect(nodes.find((n) => n.id === "hello_agent")!.type).toBe("agent");
    expect(nodes.find((n) => n.id === "__start__")!.type).toBe("terminal");
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.markerEnd)).toBe(true);
  });
});

describe("layoutGraph — team_hello (supervisor + workers)", () => {
  const { nodes, edges } = layoutGraph(graphTeamHello);

  it("renders the full supervisor shape", () => {
    expect(nodes.map((n) => n.id).sort()).toEqual(
      ["__end__", "__start__", "coordinator", "drafter", "publisher"].sort(),
    );
    expect(
      nodes.find((n) => n.id === "coordinator")!.data.graphNode.role,
    ).toBe("supervisor");
  });

  it("doubles bidirectional handoff edges with a start marker", () => {
    const handoffs = edges.filter((e) => e.source === "coordinator" && e.target !== "__end__");
    expect(handoffs).toHaveLength(2);
    for (const edge of handoffs) {
      expect(edge.animated).toBe(true);
      expect(edge.markerStart).toMatchObject({ type: MarkerType.ArrowClosed });
    }
  });

  it("keeps sequential edges plain (no start marker)", () => {
    const seq = edges.find((e) => e.source === "__start__")!;
    expect(seq.animated).toBeUndefined();
    expect(seq.markerStart).toBeUndefined();
  });

  it("positions with top-down rank order when direction is TB", () => {
    const tb = layoutGraph(graphTeamHello, "TB");
    const y = (id: string) => tb.nodes.find((n) => n.id === id)!.position.y;
    expect(y("__start__")).toBeLessThan(y("coordinator"));
    expect(y("coordinator")).toBeLessThan(y("__end__"));
  });

  it("labels conditional edges with the predicate source", () => {
    const conditional = layoutGraph({
      ...graphHello,
      edges: [
        {
          id: "c0",
          source: "__start__",
          target: "hello_agent",
          kind: "conditional",
          label: "state.retries < 3",
          bidirectional: false,
        },
      ],
    }).edges[0]!;
    expect(conditional.label).toBe("state.retries < 3");
    expect(conditional.style?.strokeDasharray).toBe("6 4");
  });
});

describe("nodeSize", () => {
  it("gives agents the largest cards and terminals the smallest", () => {
    const agent = nodeSize(graphHello.nodes[1]!);
    const terminal = nodeSize(graphHello.nodes[0]!);
    expect(agent.width).toBeGreaterThan(terminal.width);
  });
});
