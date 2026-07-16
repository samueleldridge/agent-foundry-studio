/**
 * Widget-system contracts (docs/72 § Widget system): a widget is a
 * self-contained, data-fetching panel — the summary form of a full
 * screen, deep-linking into it. Widgets own their queries/streams so any
 * combination composes.
 */
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/** Per-widget config: project selector, time window, etc. */
export type WidgetConfig = Record<string, string>;

export interface WidgetProps {
  config: WidgetConfig;
}

export interface WidgetConfigField {
  key: string;
  label: string;
  kind: "project" | "text" | "select";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<WidgetProps>;
  /** Grid units (12-column grid, rowHeight 80). */
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  configFields: WidgetConfigField[];
  deepLink: (config: WidgetConfig) => string;
}

/** One placed widget inside a dashboard (the persisted shape). */
export interface WidgetInstance {
  id: string;
  widget: string;
  config: WidgetConfig;
  layout: { x: number; y: number; w: number; h: number };
}

export interface Dashboard {
  widgets: WidgetInstance[];
}

export interface DashboardsDoc {
  version: number;
  active: string;
  dashboards: Record<string, Dashboard>;
}
