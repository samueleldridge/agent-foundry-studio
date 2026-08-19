/**
 * Pure reducer: session SSE frames (RunEvents re-stamped with a
 * session-scoped id) → per-run chat turns. Each chat message = one run
 * (docs/72 § Chat UX); the session stream multiplexes every run.
 */
import type { FoundryErrorEnvelope } from "@/api/client";
import type { SSEEvent } from "@/api/sse";

export interface ActivityItem {
  kind: "tool" | "handoff" | "node" | "warning";
  label: string;
  detail?: string;
  status: "running" | "ok" | "fail";
  durationMs?: number;
}

export interface ApprovalState {
  approvalId: string;
  prompt: string;
  agentName: string;
  context: Record<string, unknown>;
  resolved: { decision: "approved" | "rejected"; reason: string | null } | null;
}

export type TurnStatus =
  | "streaming"
  | "success"
  | "max_hops"
  | "approval_pending"
  | "failed"
  | "cancelled"
  // Forward compatibility: an unrecognised run.completed status is
  // preserved verbatim rather than collapsed to "success".
  | (string & {});

export interface ChatTurn {
  runId: string;
  assistantText: string;
  activity: ActivityItem[];
  approvals: ApprovalState[];
  status: TurnStatus;
  error: FoundryErrorEnvelope | null;
  tokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
}

type EventData = Record<string, unknown>;

function asRecord(data: unknown): EventData {
  return data && typeof data === "object" ? (data as EventData) : {};
}

function newTurn(runId: string): ChatTurn {
  return {
    runId,
    assistantText: "",
    activity: [],
    approvals: [],
    status: "streaming",
    error: null,
    tokens: null,
    costUsd: null,
    durationMs: null,
  };
}

/** Reduce the full session event list into ordered per-run turns. */
export function reduceThread(events: SSEEvent[]): ChatTurn[] {
  const turns = new Map<string, ChatTurn>();

  const turnFor = (runId: string): ChatTurn => {
    let turn = turns.get(runId);
    if (!turn) {
      turn = newTurn(runId);
      turns.set(runId, turn);
    }
    return turn;
  };

  for (const { event, data } of events) {
    const d = asRecord(data);
    const runId = typeof d.run_id === "string" ? d.run_id : null;
    if (!runId) continue;
    const turn = turnFor(runId);

    switch (event) {
      case "llm.delta": {
        const delta = asRecord(d.delta);
        if (delta.type === "text" && typeof delta.text === "string") {
          turn.assistantText += delta.text;
        }
        break;
      }
      case "tool.started": {
        turn.activity.push({
          kind: "tool",
          label: String(d.tool_ref ?? "tool"),
          detail: typeof d.input_preview === "string" ? d.input_preview : undefined,
          status: "running",
        });
        break;
      }
      case "tool.completed": {
        const ref = String(d.tool_ref ?? "tool");
        const open = [...turn.activity]
          .reverse()
          .find((a) => a.kind === "tool" && a.label === ref && a.status === "running");
        const ok = d.success !== false;
        if (open) {
          open.status = ok ? "ok" : "fail";
          open.durationMs = Number(d.latency_ms ?? 0);
          if (typeof d.output_preview === "string") open.detail = d.output_preview;
        } else {
          turn.activity.push({
            kind: "tool",
            label: ref,
            status: ok ? "ok" : "fail",
            durationMs: Number(d.latency_ms ?? 0),
          });
        }
        break;
      }
      case "handoff": {
        turn.activity.push({
          kind: "handoff",
          label: `${String(d.from_agent ?? "?")} → ${String(d.to_agent ?? "?")}`,
          status: "ok",
        });
        break;
      }
      case "agent.started":
      case "function_node.started": {
        const name = String(d.agent_name ?? d.node_name ?? d.name ?? "node");
        turn.activity.push({ kind: "node", label: name, status: "running" });
        break;
      }
      case "agent.completed":
      case "function_node.completed": {
        const name = String(d.agent_name ?? d.node_name ?? d.name ?? "node");
        const open = [...turn.activity]
          .reverse()
          .find((a) => a.kind === "node" && a.label === name && a.status === "running");
        if (open) open.status = "ok";
        break;
      }
      case "warning": {
        turn.activity.push({
          kind: "warning",
          label: String(d.category ?? "warning"),
          detail: typeof d.message === "string" ? d.message : undefined,
          status: "fail",
        });
        break;
      }
      case "approval.required": {
        const approvalId = String(d.approval_id ?? "");
        if (!turn.approvals.some((a) => a.approvalId === approvalId)) {
          turn.approvals.push({
            approvalId,
            prompt: String(d.prompt ?? ""),
            agentName: String(d.agent_name ?? ""),
            context: asRecord(d.context),
            resolved: null,
          });
        }
        turn.status = "approval_pending";
        break;
      }
      case "approval.resolved": {
        const approvalId = String(d.approval_id ?? "");
        const approval = turn.approvals.find((a) => a.approvalId === approvalId);
        if (approval) {
          approval.resolved = {
            decision: d.decision === "rejected" ? "rejected" : "approved",
            reason: typeof d.reason === "string" ? d.reason : null,
          };
        }
        turn.status = "streaming";
        break;
      }
      case "run.completed": {
        const status = String(d.status ?? "success");
        if (status === "approval_pending") {
          turn.status = "approval_pending";
          break;
        }
        // Preserve the raw status — collapsing unknown terminal states
        // (e.g. a future "budget_exceeded") to "success" would lie.
        turn.status = status;
        const input = Number(d.total_input_tokens ?? 0);
        const output = Number(d.total_output_tokens ?? 0);
        turn.tokens = input + output;
        turn.costUsd =
          d.total_cost_estimate_usd == null
            ? null
            : Number(d.total_cost_estimate_usd);
        turn.durationMs = Number(d.duration_ms ?? 0);
        // The typed final_output is the authoritative answer. For streamed
        // structured-output runs the accumulated deltas are the RAW JSON
        // being generated token-by-token — always re-render from
        // final_output so single-field outputs ({greeting: "..."}) show as
        // prose, not serialized objects.
        if (d.final_output != null) {
          turn.assistantText = humaneOutputText(d.final_output);
        }
        break;
      }
      case "run.failed": {
        turn.status = "failed";
        const err = asRecord(d.error);
        turn.error = {
          error_class: String(err.error_class ?? "RunFailed"),
          message: String(err.message ?? "run failed"),
          context: asRecord(err.context),
        };
        break;
      }
      case "run.cancelled": {
        turn.status = "cancelled";
        break;
      }
      default:
        break;
    }
  }

  return [...turns.values()];
}

/**
 * Derive the operator-visible text of a persisted run's input (reattach
 * path — the run.started frame carries only an inputs hash).
 */
/**
 * Operator-visible text for a typed run output: a bare string renders
 * as-is; an object with exactly one string field (the common
 * single-answer shape, e.g. {greeting}) renders that string; anything
 * richer renders as pretty-printed JSON.
 */
export function humaneOutputText(output: unknown): string {
  if (typeof output === "string") return output;
  const rec = asRecord(output);
  const entries = Object.entries(rec);
  if (entries.length === 1 && typeof entries[0]![1] === "string") {
    return entries[0]![1];
  }
  return JSON.stringify(output, null, 2);
}

export function userTextFromInputs(inputs: unknown): string {
  let rec = asRecord(inputs);
  // Defensive unwrap: older artifact payloads carried the docs/81
  // {"inputs": {...}} envelope verbatim.
  if (
    Object.keys(rec).length === 1 &&
    "inputs" in rec &&
    typeof rec.inputs === "object" &&
    rec.inputs !== null
  ) {
    rec = asRecord(rec.inputs);
  }
  const entries = Object.entries(rec).filter(([k]) => k !== "turns");
  // Replay the bare string only for the single-field input shape — a
  // multi-field input with one string member must render as the full
  // object, not just that member.
  if (entries.length === 1 && typeof entries[0]![1] === "string") {
    return entries[0]![1];
  }
  if (entries.length === 0) return "";
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}
