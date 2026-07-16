import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";
import { MockEventSource } from "./mock-event-source";

// --- Web Storage bridge ------------------------------------------------------
// Node >= 22 defines its own experimental global `localStorage`, which is
// `undefined` unless node runs with --localstorage-file. That built-in global
// shadows jsdom's working Storage when vitest populates the test global from
// the jsdom window. Bridge the globals to the real jsdom Storage objects.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => jsdomWindow[key],
    });
  }
}

// --- msw lifecycle ---------------------------------------------------------
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  MockEventSource.reset();
});
afterAll(() => server.close());

// --- EventSource -------------------------------------------------------------
// jsdom ships no EventSource; the SSE surfaces (chat, forge, run detail) get
// the shared mock. Plain assignment (not vi.stubGlobal) so tests that stub
// and unstub their own EventSource fall back to this one.
(globalThis as { EventSource?: unknown }).EventSource = MockEventSource;

// --- jsdom polyfills -------------------------------------------------------

// ThemeProvider consults prefers-color-scheme.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Recharts ResponsiveContainer + Radix + React Flow + react-grid-layout
// need ResizeObserver.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// React Flow (@xyflow/react) jsdom shims, per the xyflow testing guide.
class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([^)]+)\)/)?.[1];
    this.m22 = scale !== undefined ? +scale : 1;
  }
}
vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyMock);

Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: {
    configurable: true,
    get(this: HTMLElement) {
      return parseFloat(this.style.height) || 1;
    },
  },
  offsetWidth: {
    configurable: true,
    get(this: HTMLElement) {
      return parseFloat(this.style.width) || 1;
    },
  },
});

// CodeMirror measures the DOM; jsdom Ranges have no geometry.
const zeroRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;

Range.prototype.getBoundingClientRect = () => zeroRect;
// React Flow edge rendering asks SVG elements for geometry.
(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () =>
  zeroRect;
Range.prototype.getClientRects = () =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  }) as unknown as DOMRectList;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Radix pointer-capture guards.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
