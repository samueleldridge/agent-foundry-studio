/**
 * useSSE — EventSource wrapper with Last-Event-ID resume.
 *
 * The studio SSE endpoints stamp each frame with a monotonically increasing
 * `id:`; on reconnect we resume from the last id seen via the
 * `from_sequence` / Last-Event-ID convention (EventSource sends the
 * Last-Event-ID header automatically on its own reconnects; we mirror it in
 * the URL when WE re-open, e.g. after unmount/remount).
 *
 * Built and unit-tested in Phase 10b; consumed by chat/forge/run-detail
 * surfaces in 10c.
 */
import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "./client";

export interface SSEEvent {
  /** SSE `event:` field, e.g. "llm.delta", "run.completed". */
  event: string;
  /** Parsed JSON payload (raw string if the payload is not JSON). */
  data: unknown;
  /** SSE `id:` field, if present. */
  id: string | null;
}

export interface UseSSEOptions {
  /** Pause the stream without unmounting the consumer. */
  enabled?: boolean;
  /** Event names that should close the stream (e.g. "run.completed"). */
  terminalEvents?: readonly string[];
  /** Called for every event, in order. */
  onEvent?: (event: SSEEvent) => void;
}

export interface UseSSEResult {
  /** All events received on the current mount, in order. */
  events: SSEEvent[];
  /** Last id seen — the resume cursor. */
  lastEventId: string | null;
  status: "idle" | "connecting" | "open" | "closed" | "error";
}

export function buildSSEUrl(
  url: string,
  lastEventId: string | null,
  token: string | null = getAuthToken(),
): string {
  const u = new URL(url, window.location.origin);
  if (lastEventId !== null) u.searchParams.set("from_sequence", lastEventId);
  // EventSource cannot set headers; the control plane accepts ?token=.
  if (token) u.searchParams.set("token", token);
  return u.pathname + u.search;
}

export function useSSE(
  url: string | null,
  options: UseSSEOptions = {},
): UseSSEResult {
  const { enabled = true, terminalEvents = [], onEvent } = options;
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [status, setStatus] = useState<UseSSEResult["status"]>(
    url && enabled ? "connecting" : "idle",
  );
  const lastIdRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  const terminalRef = useRef(terminalEvents);

  useEffect(() => {
    onEventRef.current = onEvent;
    terminalRef.current = terminalEvents;
  }, [onEvent, terminalEvents]);

  useEffect(() => {
    if (!url || !enabled) {
      // Synchronizing local status with the (absent) external stream.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("idle");
      return;
    }

     
    setStatus("connecting");
    const source = new EventSource(buildSSEUrl(url, lastIdRef.current));
    let closed = false;

    const handle = (ev: MessageEvent, name: string) => {
      if (closed) return;
      let data: unknown = ev.data;
      if (typeof ev.data === "string") {
        try {
          data = JSON.parse(ev.data);
        } catch {
          data = ev.data;
        }
      }
      const id = ev.lastEventId !== "" ? ev.lastEventId : null;
      if (id !== null) {
        lastIdRef.current = id;
        setLastEventId(id);
      }
      const record: SSEEvent = { event: name, data, id };
      setEvents((prev) => [...prev, record]);
      onEventRef.current?.(record);
      if (terminalRef.current.includes(name)) {
        closed = true;
        source.close();
        setStatus("closed");
      }
    };

    source.onopen = () => {
      if (!closed) setStatus("open");
    };
    source.onmessage = (ev) => handle(ev, ev.type);
    source.onerror = () => {
      if (!closed) setStatus("error");
      // EventSource reconnects automatically with Last-Event-ID.
    };

    // Named events do not hit onmessage; observe everything via a proxy.
    // EventSource has no wildcard, so we patch addEventListener usage by
    // listening for the well-known studio event names.
    for (const name of STUDIO_EVENT_NAMES) {
      source.addEventListener(name, (ev) => handle(ev as MessageEvent, name));
    }

    return () => {
      closed = true;
      source.close();
      setStatus("closed");
    };
  }, [url, enabled]);

  return { events, lastEventId, status };
}

/**
 * The studio event vocabulary (docs/72 § SSE frames + phase-10a handoff).
 * EventSource offers no wildcard listener, so named events are enumerated.
 */
export const STUDIO_EVENT_NAMES: readonly string[] = [
  // Run lifecycle (foundry.core.events RunEvent union)
  "run.started",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "agent.started",
  "agent.completed",
  "function_node.started",
  "function_node.completed",
  "llm.started",
  "llm.delta",
  "llm.completed",
  "provider.retry",
  "tool.started",
  "tool.completed",
  "handoff",
  "state.transition",
  "approval.required",
  "approval.resolved",
  "warning",
  "connection",
  "embed",
  "retrieval",
  "rerank",
  "memory.read",
  "memory.write",
  "memory.consolidate",
  "cache.semantic.hit",
  "cache.semantic.miss",
  "cache.semantic.store",
  "cache.semantic.invalidate",
  "cache.tool.hit",
  "cache.tool.miss",
  "cache.tool.store",
  // Background tasks (evals / tests / deploys)
  "task.progress",
  "task.completed",
  "task.failed",
  // Forge (meta-agent session)
  "forge.started",
  "forge.iteration_started",
  "forge.iteration_completed",
  "forge.rollback",
  "forge.terminated",
  "forge.failed",
  "meta_agent.violation",
  // Studio audit events
  "studio.config_saved",
  "studio.rollback",
];
