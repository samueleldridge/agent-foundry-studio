/**
 * Forge trajectory helpers — historical artifact records merged with live
 * SSE frames; sandbox violations and terminations extracted for prominent
 * rendering.
 */
import { describe, expect, it } from "vitest";
import {
  iterationsFromEvents,
  iterationsFromTrajectory,
  mergeIterations,
  terminationFromEvents,
  violationsFromEvents,
} from "@/features/forge/forge-trajectory";
import type { SSEEvent } from "@/api/sse";
import { forgeRunFinished } from "./msw/fixtures";

function ev(event: string, data: unknown, id = "0"): SSEEvent {
  return { event, data, id };
}

describe("iterationsFromTrajectory", () => {
  it("maps persisted trajectory records", () => {
    const rows = iterationsFromTrajectory(forgeRunFinished.trajectory ?? []);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      iteration: 2,
      score: 0.95,
      delta: 0.25,
      commits: ["b2c3d4e5f6a70000000000000000000000000000"],
      summary: "added an output-schema hint",
      applied: true,
    });
  });
});

describe("iterationsFromEvents + mergeIterations", () => {
  it("live frames win over historical rows for the same iteration", () => {
    const historical = iterationsFromTrajectory([
      { iteration_number: 1, eval_score_after: 0.5, summary: "old summary" },
    ]);
    const live = iterationsFromEvents([
      ev("forge.iteration_started", { iteration_number: 2 }),
      ev("forge.iteration_completed", {
        iteration_number: 1,
        eval_score: 0.8,
        eval_delta: 0.3,
        commit_shas: ["abc"],
      }),
      ev("forge.iteration_completed", { iteration_number: 2, eval_score: 0.9 }),
    ]);
    const merged = mergeIterations(historical, live);
    expect(merged.map((r) => r.iteration)).toEqual([1, 2]);
    expect(merged[0]).toMatchObject({ score: 0.8, commits: ["abc"], summary: "old summary" });
    expect(merged[1]!.score).toBe(0.9);
  });
});

describe("violationsFromEvents", () => {
  it("extracts meta_agent.violation frames", () => {
    expect(
      violationsFromEvents([
        ev("forge.iteration_started", { iteration_number: 1 }),
        ev("meta_agent.violation", {
          tool: "write_file",
          detail: "path escapes projects/hello",
        }),
      ]),
    ).toEqual([{ tool: "write_file", detail: "path escapes projects/hello" }]);
  });
});

describe("terminationFromEvents", () => {
  it("reads the terminal forge.terminated frame", () => {
    expect(
      terminationFromEvents([
        ev("forge.iteration_completed", { iteration_number: 1 }),
        ev("forge.terminated", {
          reason: "threshold_met",
          final_score: 0.95,
          iterations: 2,
          total_cost_usd: 1.2,
        }),
      ]),
    ).toEqual({
      reason: "threshold_met",
      finalScore: 0.95,
      iterations: 2,
      totalCostUsd: 1.2,
    });
  });

  it("maps forge.failed to an error termination", () => {
    const t = terminationFromEvents([
      ev("forge.failed", { error: { message: "budget exceeded" } }),
    ]);
    expect(t?.reason).toBe("error: budget exceeded");
  });

  it("returns null while the run is still live", () => {
    expect(
      terminationFromEvents([ev("forge.iteration_started", { iteration_number: 1 })]),
    ).toBeNull();
  });
});
