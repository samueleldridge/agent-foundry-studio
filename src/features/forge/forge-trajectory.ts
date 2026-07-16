/**
 * Pure helpers: forge trajectory records (historical artifacts) and live
 * forge SSE events → one iteration-row model for the console.
 */
import type { SSEEvent } from "@/api/sse";

export interface IterationRow {
  iteration: number;
  kind: string;
  score: number | null;
  delta: number | null;
  commits: string[];
  summary: string | null;
  costUsd: number | null;
  applied: boolean;
}

export interface SandboxViolation {
  tool: string;
  detail: string;
}

export interface Termination {
  reason: string;
  finalScore: number | null;
  iterations: number;
  totalCostUsd: number | null;
}

type Rec = Record<string, unknown>;

function asRecord(data: unknown): Rec {
  return data && typeof data === "object" ? (data as Rec) : {};
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Persisted trajectory.jsonl records (ForgeRunInfo.trajectory). */
export function iterationsFromTrajectory(trajectory: Rec[]): IterationRow[] {
  return trajectory.map((r) => ({
    iteration: Number(r.iteration_number ?? 0),
    kind: String(r.kind ?? "iterate"),
    score: num(r.eval_score_after),
    delta: num(r.eval_delta),
    commits: Array.isArray(r.commit_shas) ? r.commit_shas.map(String) : [],
    summary: typeof r.summary === "string" ? r.summary : null,
    costUsd: num(r.cost_usd),
    applied: r.applied !== false,
  }));
}

/** Live `forge.iteration_completed` frames. */
export function iterationsFromEvents(events: SSEEvent[]): IterationRow[] {
  const rows: IterationRow[] = [];
  for (const { event, data } of events) {
    if (event !== "forge.iteration_completed") continue;
    const d = asRecord(data);
    rows.push({
      iteration: Number(d.iteration_number ?? 0),
      kind: "iterate",
      score: num(d.eval_score),
      delta: num(d.eval_delta),
      commits: Array.isArray(d.commit_shas) ? d.commit_shas.map(String) : [],
      summary: null,
      costUsd: null,
      applied: d.applied !== false,
    });
  }
  return rows;
}

/** Historical + live merged, deduped by iteration number (live wins). */
export function mergeIterations(
  historical: IterationRow[],
  live: IterationRow[],
): IterationRow[] {
  const byIteration = new Map<number, IterationRow>();
  for (const row of historical) byIteration.set(row.iteration, row);
  for (const row of live) {
    const prior = byIteration.get(row.iteration);
    byIteration.set(
      row.iteration,
      prior ? { ...prior, ...row, summary: row.summary ?? prior.summary } : row,
    );
  }
  return [...byIteration.values()].sort((a, b) => a.iteration - b.iteration);
}

/** `meta_agent.violation` frames — surfaced prominently, never buried. */
export function violationsFromEvents(events: SSEEvent[]): SandboxViolation[] {
  return events
    .filter((e) => e.event === "meta_agent.violation")
    .map((e) => {
      const d = asRecord(e.data);
      return { tool: String(d.tool ?? ""), detail: String(d.detail ?? "") };
    });
}

/** Terminal `forge.terminated` / `forge.failed` frame, if streamed. */
export function terminationFromEvents(events: SSEEvent[]): Termination | null {
  for (const { event, data } of [...events].reverse()) {
    if (event === "forge.terminated") {
      const d = asRecord(data);
      return {
        reason: String(d.reason ?? "unknown"),
        finalScore: num(d.final_score),
        iterations: Number(d.iterations ?? 0),
        totalCostUsd: num(d.total_cost_usd),
      };
    }
    if (event === "forge.failed") {
      const d = asRecord(asRecord(data).error);
      return {
        reason: `error: ${String(d.message ?? "forge failed")}`,
        finalScore: null,
        iterations: 0,
        totalCostUsd: null,
      };
    }
  }
  return null;
}
