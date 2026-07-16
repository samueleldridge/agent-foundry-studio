/**
 * Widget registry — the settled v1.1 set of 12 (docs/72 § Widget system).
 * Adding a widget = one entry here + one component; the dashboard host is
 * generic.
 */
import {
  ActivityIcon,
  BookOpenIcon,
  CircleDollarSignIcon,
  GitBranchIcon,
  HammerIcon,
  HeartPulseIcon,
  HistoryIcon,
  MessageSquareIcon,
  ShieldAlertIcon,
  StethoscopeIcon,
  TimerIcon,
  WorkflowIcon,
} from "lucide-react";
import {
  ApprovalsInboxWidget,
  CatalogBrowserWidget,
  DoctorWidget,
  ProjectHealthWidget,
  RunsFeedWidget,
  VersionsPanelWidget,
} from "./core-widgets";
import {
  CostChartWidget,
  EvalTrendWidget,
  LatencyChartWidget,
} from "./chart-widgets";
import {
  ChatPanelWidget,
  FlowGraphMiniWidget,
  ForgeConsoleWidget,
} from "./live-widgets";
import type { WidgetConfig, WidgetDefinition } from "./types";

const projectField = (required: boolean) => ({
  key: "project",
  label: required ? "Project" : "Project (optional)",
  kind: "project" as const,
  required,
});

const sinceField = {
  key: "since",
  label: "Time window",
  kind: "select" as const,
  options: ["24h", "7d", "30d", "90d"],
};

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  "project-health": {
    id: "project-health",
    title: "Project health",
    icon: HeartPulseIcon,
    component: ProjectHealthWidget,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    configFields: [projectField(true)],
    deepLink: (c: WidgetConfig) => `/projects/${c.project ?? ""}`,
  },
  "runs-feed": {
    id: "runs-feed",
    title: "Runs feed",
    icon: HistoryIcon,
    component: RunsFeedWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 2 },
    configFields: [
      projectField(false),
      { key: "limit", label: "Rows", kind: "select", options: ["5", "8", "15", "25"] },
    ],
    deepLink: (c) => (c.project ? `/projects/${c.project}/runs` : "/obs"),
  },
  "cost-chart": {
    id: "cost-chart",
    title: "Cost",
    icon: CircleDollarSignIcon,
    component: CostChartWidget,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    configFields: [
      projectField(false),
      sinceField,
      { key: "by", label: "Bucket", kind: "select", options: ["day", "model", "agent"] },
    ],
    deepLink: () => "/obs",
  },
  "latency-chart": {
    id: "latency-chart",
    title: "Latency",
    icon: TimerIcon,
    component: LatencyChartWidget,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    configFields: [projectField(false), sinceField],
    deepLink: () => "/obs",
  },
  "eval-trend": {
    id: "eval-trend",
    title: "Eval trend",
    icon: ActivityIcon,
    component: EvalTrendWidget,
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    configFields: [projectField(true), sinceField],
    deepLink: (c) => `/projects/${c.project ?? ""}/evals`,
  },
  "doctor-panel": {
    id: "doctor-panel",
    title: "Doctor",
    icon: StethoscopeIcon,
    component: DoctorWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    configFields: [],
    deepLink: () => "/doctor",
  },
  "forge-console": {
    id: "forge-console",
    title: "Forge console",
    icon: HammerIcon,
    component: ForgeConsoleWidget,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 3 },
    configFields: [projectField(false)],
    deepLink: () => "/forge",
  },
  "chat-panel": {
    id: "chat-panel",
    title: "Chat",
    icon: MessageSquareIcon,
    component: ChatPanelWidget,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    configFields: [projectField(true)],
    deepLink: (c) => `/projects/${c.project ?? ""}/chat`,
  },
  "flow-graph-mini": {
    id: "flow-graph-mini",
    title: "Flow graph",
    icon: WorkflowIcon,
    component: FlowGraphMiniWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    configFields: [projectField(true)],
    deepLink: (c) => `/projects/${c.project ?? ""}/graph`,
  },
  "catalog-browser": {
    id: "catalog-browser",
    title: "Catalog",
    icon: BookOpenIcon,
    component: CatalogBrowserWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    configFields: [
      {
        key: "kind",
        label: "Kind",
        kind: "select",
        options: ["tools", "connections", "retrievers"],
      },
    ],
    deepLink: () => "/catalog",
  },
  "approvals-inbox": {
    id: "approvals-inbox",
    title: "Approvals",
    icon: ShieldAlertIcon,
    component: ApprovalsInboxWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 2 },
    configFields: [projectField(false)],
    deepLink: () => "/approvals",
  },
  "versions-panel": {
    id: "versions-panel",
    title: "Versions",
    icon: GitBranchIcon,
    component: VersionsPanelWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 2 },
    configFields: [projectField(true)],
    deepLink: (c) => `/projects/${c.project ?? ""}/versions`,
  },
};

export const WIDGET_IDS = Object.keys(WIDGET_REGISTRY);
