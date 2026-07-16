/**
 * Chat thread reducer — session SSE frames → per-run turns (each chat
 * message = one run).
 */
import { describe, expect, it } from "vitest";
import { reduceThread, userTextFromInputs } from "@/features/chat/chat-thread";
import type { SSEEvent } from "@/api/sse";

function ev(event: string, data: Record<string, unknown>, id = "0"): SSEEvent {
  return { event, data, id };
}

describe("reduceThread", () => {
  it("accumulates llm deltas per run and finalises on run.completed", () => {
    const turns = reduceThread([
      ev("run.started", { run_id: "r1" }),
      ev("llm.delta", { run_id: "r1", delta: { type: "text", text: "Hel" } }),
      ev("llm.delta", { run_id: "r1", delta: { type: "text", text: "lo" } }),
      ev("run.completed", {
        run_id: "r1",
        status: "success",
        total_input_tokens: 12,
        total_output_tokens: 8,
        total_cost_estimate_usd: 0.0021,
        duration_ms: 950,
      }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      runId: "r1",
      assistantText: "Hello",
      status: "success",
      tokens: 20,
      costUsd: 0.0021,
      durationMs: 950,
    });
  });

  it("keeps runs separate (each message = one run) in stream order", () => {
    const turns = reduceThread([
      ev("run.started", { run_id: "r1" }),
      ev("run.completed", { run_id: "r1", status: "success", final_output: "one" }),
      ev("run.started", { run_id: "r2" }),
      ev("llm.delta", { run_id: "r2", delta: { type: "text", text: "two" } }),
    ]);
    expect(turns.map((t) => t.runId)).toEqual(["r1", "r2"]);
    expect(turns[0]!.assistantText).toBe("one"); // non-streaming fallback
    expect(turns[1]!.status).toBe("streaming");
  });

  it("pairs tool.started/completed into activity items with duration", () => {
    const turns = reduceThread([
      ev("run.started", { run_id: "r1" }),
      ev("tool.started", { run_id: "r1", tool_ref: "catalog/http_get_json@v1" }),
      ev("tool.completed", {
        run_id: "r1",
        tool_ref: "catalog/http_get_json@v1",
        success: true,
        latency_ms: 42,
      }),
    ]);
    expect(turns[0]!.activity).toEqual([
      expect.objectContaining({
        kind: "tool",
        label: "catalog/http_get_json@v1",
        status: "ok",
        durationMs: 42,
      }),
    ]);
  });

  it("tracks approval.required → approval.resolved on the owning turn", () => {
    const required = [
      ev("run.started", { run_id: "r1" }),
      ev("approval.required", {
        run_id: "r1",
        approval_id: "ap-1",
        prompt: "Publish?",
        agent_name: "publisher",
        context: { tool: "publish" },
      }),
    ];
    let turns = reduceThread(required);
    expect(turns[0]!.status).toBe("approval_pending");
    expect(turns[0]!.approvals[0]).toMatchObject({
      approvalId: "ap-1",
      prompt: "Publish?",
      resolved: null,
    });

    turns = reduceThread([
      ...required,
      ev("approval.resolved", {
        run_id: "r1",
        approval_id: "ap-1",
        decision: "rejected",
        reason: "not yet",
      }),
    ]);
    expect(turns[0]!.status).toBe("streaming");
    expect(turns[0]!.approvals[0]!.resolved).toEqual({
      decision: "rejected",
      reason: "not yet",
    });
  });

  it("treats run.completed(approval_pending) as a pause, not a terminal", () => {
    const turns = reduceThread([
      ev("run.started", { run_id: "r1" }),
      ev("run.completed", { run_id: "r1", status: "approval_pending" }),
    ]);
    expect(turns[0]!.status).toBe("approval_pending");
    expect(turns[0]!.tokens).toBeNull();
  });

  it("captures the structured error envelope from run.failed", () => {
    const turns = reduceThread([
      ev("run.started", { run_id: "r1" }),
      ev("run.failed", {
        run_id: "r1",
        error: {
          error_class: "ProviderAuthError",
          message: "invalid x-api-key",
          context: { provider: "anthropic" },
        },
      }),
    ]);
    expect(turns[0]!.status).toBe("failed");
    expect(turns[0]!.error).toMatchObject({
      error_class: "ProviderAuthError",
      message: "invalid x-api-key",
    });
  });
});

describe("userTextFromInputs", () => {
  it("returns the single string field (ignoring threaded turns)", () => {
    expect(userTextFromInputs({ question: "hi", turns: [1, 2] })).toBe("hi");
  });
  it("falls back to pretty JSON for schema-shaped inputs", () => {
    expect(userTextFromInputs({ a: 1, b: 2 })).toContain('"a": 1');
  });
  it("returns empty for no inputs", () => {
    expect(userTextFromInputs({})).toBe("");
    expect(userTextFromInputs(null)).toBe("");
  });
});
