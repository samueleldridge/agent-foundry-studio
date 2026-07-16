/**
 * useSSE — Last-Event-ID resume + terminal-event close (built in 10b,
 * consumed by chat/forge/run-detail in 10c).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { buildSSEUrl, useSSE } from "@/api/sse";

type Listener = (ev: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: Listener | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, fn: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]);
  }

  close() {
    this.closed = true;
  }

  emit(name: string, data: unknown, id: string) {
    const ev = {
      data: JSON.stringify(data),
      lastEventId: id,
      type: name,
    } as MessageEvent;
    for (const fn of this.listeners.get(name) ?? []) fn(ev);
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSSE", () => {
  it("collects typed events and tracks the last id", () => {
    const { result } = renderHook(() => useSSE("/api/runs/r1/events"));
    const source = MockEventSource.instances[0]!;

    act(() => {
      source.emit("run.started", { run_id: "r1", sequence: 0 }, "0");
      source.emit("llm.delta", { delta: { text: "He" } }, "1");
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0]!.event).toBe("run.started");
    expect(result.current.events[1]!.data).toEqual({ delta: { text: "He" } });
    expect(result.current.lastEventId).toBe("1");
  });

  it("closes the stream on a terminal event", () => {
    const { result } = renderHook(() =>
      useSSE("/api/runs/r1/events", { terminalEvents: ["run.completed"] }),
    );
    const source = MockEventSource.instances[0]!;

    act(() => {
      source.emit("run.completed", { status: "success" }, "5");
      // Anything after the terminal frame is ignored.
      source.emit("llm.delta", { delta: { text: "x" } }, "6");
    });

    expect(source.closed).toBe(true);
    expect(result.current.status).toBe("closed");
    expect(result.current.events).toHaveLength(1);
  });

  it("resumes from the last seen id when it reconnects", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSSE("/api/runs/r1/events", { enabled }),
      { initialProps: { enabled: true } },
    );
    const first = MockEventSource.instances[0]!;
    expect(first.url).not.toContain("from_sequence");

    act(() => {
      first.emit("run.started", { sequence: 0 }, "0");
      first.emit("llm.delta", { d: 1 }, "7");
    });

    // Pause and resume the stream (unmount/remount path).
    rerender({ enabled: false });
    rerender({ enabled: true });

    const second = MockEventSource.instances[1]!;
    expect(second.url).toContain("from_sequence=7");
  });

  it("builds resume URLs with the token fallback for EventSource", () => {
    const url = buildSSEUrl("/api/runs/r1/events", "12", "sekret");
    expect(url).toBe("/api/runs/r1/events?from_sequence=12&token=sekret");
    expect(buildSSEUrl("/api/runs/r1/events", null, null)).toBe(
      "/api/runs/r1/events",
    );
  });
});
