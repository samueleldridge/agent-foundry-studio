/**
 * Shared EventSource test double — jsdom ships no EventSource, and the
 * studio SSE surfaces (chat, forge, run detail) all open one. Installed
 * globally in tests/setup.ts; tests drive frames with `emit()`.
 */
type Listener = (ev: MessageEvent) => void;

export class MockEventSource {
  static instances: MockEventSource[] = [];

  static reset() {
    MockEventSource.instances = [];
  }

  /** The most recently opened stream. */
  static latest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }

  /** The most recent stream whose URL contains the given fragment. */
  static latestFor(urlFragment: string): MockEventSource | undefined {
    return [...MockEventSource.instances]
      .reverse()
      .find((s) => s.url.includes(urlFragment));
  }

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

  removeEventListener(name: string, fn: Listener) {
    this.listeners.set(
      name,
      (this.listeners.get(name) ?? []).filter((l) => l !== fn),
    );
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }

  /** Deliver one named SSE frame (data is JSON-encoded like the wire). */
  emit(name: string, data: unknown, id: string) {
    const ev = {
      data: JSON.stringify(data),
      lastEventId: id,
      type: name,
    } as MessageEvent;
    for (const fn of this.listeners.get(name) ?? []) fn(ev);
    if (name === "message") this.onmessage?.(ev);
  }
}
