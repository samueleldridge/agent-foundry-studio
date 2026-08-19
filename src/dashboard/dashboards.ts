/**
 * Pure dashboard-document helpers (unit-tested without a DOM): coercion of
 * the server layouts document, widget placement, and board mutations. The
 * document round-trips through `GET/PUT /api/layouts` — server-persisted,
 * never localStorage (docs/72 § Layout persistence).
 */
import type { LayoutsDocument } from "@/api/types";
import { WIDGET_REGISTRY } from "@/widgets/registry";
import { DEFAULT_DASHBOARDS, defaultDoc } from "@/widgets/defaults";
import type { Dashboard, DashboardsDoc, WidgetInstance } from "@/widgets/types";

type Rec = Record<string, unknown>;

function asRecord(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

/** Finite number or the fallback — NaN/Infinity from a hand-edited or
 * corrupted server document must never enter layout coordinates. */
function finite(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function coerceInstance(raw: unknown): WidgetInstance | null {
  const rec = asRecord(raw);
  if (!rec || typeof rec.id !== "string" || typeof rec.widget !== "string") {
    return null;
  }
  const layout = asRecord(rec.layout) ?? {};
  const config = asRecord(rec.config) ?? {};
  return {
    id: rec.id,
    // Unknown widget ids survive coercion — they render placeholder tiles
    // (forward compatibility), never crash the board.
    widget: rec.widget,
    config: Object.fromEntries(
      Object.entries(config).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>,
    layout: {
      x: finite(layout.x, 0),
      y: finite(layout.y, 0),
      w: Math.max(1, finite(layout.w, 4)),
      h: Math.max(1, finite(layout.h, 3)),
    },
  };
}

/**
 * Server document → typed DashboardsDoc. An absent/empty document yields
 * the shipped defaults (default / forge board / chat board).
 */
export function coerceDoc(raw: LayoutsDocument | null | undefined): DashboardsDoc {
  const dashboardsRaw = asRecord(raw?.dashboards);
  if (!raw || !dashboardsRaw || Object.keys(dashboardsRaw).length === 0) {
    return defaultDoc();
  }
  const dashboards: Record<string, Dashboard> = {};
  for (const [name, board] of Object.entries(dashboardsRaw)) {
    const rec = asRecord(board);
    const widgets = Array.isArray(rec?.widgets) ? rec.widgets : [];
    dashboards[name] = {
      widgets: widgets
        .map(coerceInstance)
        .filter((w): w is WidgetInstance => w !== null),
    };
  }
  const active =
    typeof raw.active === "string" && raw.active in dashboards
      ? raw.active
      : Object.keys(dashboards)[0]!;
  return { version: finite(raw.version, 1) || 1, active, dashboards };
}

let counter = 0;

/** Unique-enough instance id (persisted, so readable beats opaque). */
export function newInstanceId(widget: string): string {
  counter += 1;
  return `w-${widget}-${Date.now().toString(36)}${counter}`;
}

/** First free y below every existing widget (append to the bottom). */
function nextY(board: Dashboard): number {
  return board.widgets.reduce(
    (max, w) => Math.max(max, w.layout.y + w.layout.h),
    0,
  );
}

export function addWidgetTo(
  doc: DashboardsDoc,
  boardName: string,
  widgetId: string,
): DashboardsDoc {
  const def = WIDGET_REGISTRY[widgetId];
  const board = doc.dashboards[boardName];
  if (!def || !board) return doc;
  const instance: WidgetInstance = {
    id: newInstanceId(widgetId),
    widget: widgetId,
    config: {},
    layout: { x: 0, y: nextY(board), ...def.defaultSize },
  };
  return {
    ...doc,
    dashboards: {
      ...doc.dashboards,
      [boardName]: { widgets: [...board.widgets, instance] },
    },
  };
}

export function removeWidgetFrom(
  doc: DashboardsDoc,
  boardName: string,
  instanceId: string,
): DashboardsDoc {
  const board = doc.dashboards[boardName];
  if (!board) return doc;
  return {
    ...doc,
    dashboards: {
      ...doc.dashboards,
      [boardName]: {
        widgets: board.widgets.filter((w) => w.id !== instanceId),
      },
    },
  };
}

export function updateWidgetConfig(
  doc: DashboardsDoc,
  boardName: string,
  instanceId: string,
  config: Record<string, string>,
): DashboardsDoc {
  const board = doc.dashboards[boardName];
  if (!board) return doc;
  return {
    ...doc,
    dashboards: {
      ...doc.dashboards,
      [boardName]: {
        widgets: board.widgets.map((w) =>
          w.id === instanceId ? { ...w, config } : w,
        ),
      },
    },
  };
}

/** Apply react-grid-layout positions back onto the board's instances. */
export function applyGridLayout(
  doc: DashboardsDoc,
  boardName: string,
  items: readonly { i: string; x: number; y: number; w: number; h: number }[],
): DashboardsDoc {
  const board = doc.dashboards[boardName];
  if (!board) return doc;
  const byId = new Map(items.map((it) => [it.i, it]));
  let changed = false;
  const widgets = board.widgets.map((w) => {
    const it = byId.get(w.id);
    if (!it) return w;
    const next = { x: it.x, y: it.y, w: it.w, h: it.h };
    if (
      next.x === w.layout.x &&
      next.y === w.layout.y &&
      next.w === w.layout.w &&
      next.h === w.layout.h
    ) {
      return w;
    }
    changed = true;
    return { ...w, layout: next };
  });
  if (!changed) return doc;
  return {
    ...doc,
    dashboards: { ...doc.dashboards, [boardName]: { widgets } },
  };
}

/** Reset one board to its shipped default (or empty if it has none). */
export function resetBoard(doc: DashboardsDoc, boardName: string): DashboardsDoc {
  const shipped = DEFAULT_DASHBOARDS[boardName];
  return {
    ...doc,
    dashboards: {
      ...doc.dashboards,
      [boardName]: shipped
        ? structuredClone(shipped)
        : { widgets: [] },
    },
  };
}

export function addBoard(doc: DashboardsDoc, name: string): DashboardsDoc {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed in doc.dashboards) return doc;
  return {
    ...doc,
    active: trimmed,
    dashboards: { ...doc.dashboards, [trimmed]: { widgets: [] } },
  };
}

export function removeBoard(doc: DashboardsDoc, name: string): DashboardsDoc {
  const names = Object.keys(doc.dashboards);
  if (!(name in doc.dashboards) || names.length <= 1) return doc;
  const dashboards = Object.fromEntries(
    Object.entries(doc.dashboards).filter(([k]) => k !== name),
  );
  return {
    ...doc,
    active: doc.active === name ? Object.keys(dashboards)[0]! : doc.active,
    dashboards,
  };
}
