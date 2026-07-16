/**
 * Shipped default dashboards (docs/72 § Layout persistence) — used when
 * the server layouts document is absent/empty and by per-board "reset".
 */
import type { Dashboard, DashboardsDoc } from "./types";

export const DEFAULT_DASHBOARDS: Record<string, Dashboard> = {
  default: {
    widgets: [
      {
        id: "w-health",
        widget: "project-health",
        config: { project: "hello" },
        layout: { x: 0, y: 0, w: 4, h: 3 },
      },
      {
        id: "w-runs",
        widget: "runs-feed",
        config: {},
        layout: { x: 4, y: 0, w: 4, h: 3 },
      },
      {
        id: "w-cost",
        widget: "cost-chart",
        config: { since: "7d", by: "day" },
        layout: { x: 8, y: 0, w: 4, h: 3 },
      },
      {
        id: "w-trend",
        widget: "eval-trend",
        config: { project: "hello", since: "30d" },
        layout: { x: 0, y: 3, w: 4, h: 3 },
      },
      {
        id: "w-approvals",
        widget: "approvals-inbox",
        config: {},
        layout: { x: 4, y: 3, w: 4, h: 3 },
      },
      {
        id: "w-doctor",
        widget: "doctor-panel",
        config: {},
        layout: { x: 8, y: 3, w: 4, h: 3 },
      },
    ],
  },
  "forge board": {
    widgets: [
      {
        id: "w-forge",
        widget: "forge-console",
        config: {},
        layout: { x: 0, y: 0, w: 8, h: 6 },
      },
      {
        id: "w-forge-trend",
        widget: "eval-trend",
        config: { project: "hello", since: "30d" },
        layout: { x: 8, y: 0, w: 4, h: 3 },
      },
      {
        id: "w-forge-versions",
        widget: "versions-panel",
        config: { project: "hello" },
        layout: { x: 8, y: 3, w: 4, h: 3 },
      },
    ],
  },
  "chat board": {
    widgets: [
      {
        id: "w-chat",
        widget: "chat-panel",
        config: { project: "hello" },
        layout: { x: 0, y: 0, w: 7, h: 7 },
      },
      {
        id: "w-chat-graph",
        widget: "flow-graph-mini",
        config: { project: "hello" },
        layout: { x: 7, y: 0, w: 5, h: 4 },
      },
    ],
  },
};

export function defaultDoc(): DashboardsDoc {
  return {
    version: 1,
    active: "default",
    dashboards: structuredClone(DEFAULT_DASHBOARDS),
  };
}
