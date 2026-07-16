/**
 * Widget registry — the settled 12 (docs/72 § Widget system) — and the
 * WidgetFrame chrome: config dialog, deep link, remove, unknown-widget
 * placeholder (never a crash).
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { renderWithProviders } from "./utils";
import { WIDGET_IDS, WIDGET_REGISTRY } from "@/widgets/registry";
import { DEFAULT_DASHBOARDS } from "@/widgets/defaults";
import { WidgetFrame } from "@/dashboard/WidgetFrame";
import type { WidgetInstance } from "@/widgets/types";

const SETTLED_12 = [
  "project-health",
  "runs-feed",
  "cost-chart",
  "latency-chart",
  "eval-trend",
  "doctor-panel",
  "forge-console",
  "chat-panel",
  "flow-graph-mini",
  "catalog-browser",
  "approvals-inbox",
  "versions-panel",
];

describe("widget registry", () => {
  it("contains exactly the 12 settled widgets", () => {
    expect([...WIDGET_IDS].sort()).toEqual([...SETTLED_12].sort());
  });

  it("every entry is complete: component, sizes, deep link", () => {
    for (const id of WIDGET_IDS) {
      const def = WIDGET_REGISTRY[id]!;
      expect(def.id).toBe(id);
      expect(def.component).toBeTypeOf("function");
      expect(def.defaultSize.w).toBeGreaterThanOrEqual(def.minSize.w);
      expect(def.defaultSize.h).toBeGreaterThanOrEqual(def.minSize.h);
      expect(def.deepLink({ project: "hello" })).toMatch(/^\//);
    }
  });

  it("deep links target the widgets' full screens", () => {
    expect(WIDGET_REGISTRY["chat-panel"]!.deepLink({ project: "hello" })).toBe(
      "/projects/hello/chat",
    );
    expect(
      WIDGET_REGISTRY["flow-graph-mini"]!.deepLink({ project: "team_hello" }),
    ).toBe("/projects/team_hello/graph");
    expect(WIDGET_REGISTRY["forge-console"]!.deepLink({})).toBe("/forge");
    expect(WIDGET_REGISTRY["approvals-inbox"]!.deepLink({})).toBe("/approvals");
    expect(WIDGET_REGISTRY["doctor-panel"]!.deepLink({})).toBe("/doctor");
  });

  it("shipped default boards reference only registered widgets", () => {
    for (const board of Object.values(DEFAULT_DASHBOARDS)) {
      for (const w of board.widgets) {
        expect(WIDGET_IDS).toContain(w.widget);
      }
    }
  });
});

describe("WidgetFrame", () => {
  const instance = (widget: string): WidgetInstance => ({
    id: "w-test",
    widget,
    config: {},
    layout: { x: 0, y: 0, w: 4, h: 3 },
  });

  it("renders a placeholder tile for unknown widget ids", () => {
    const onRemove = vi.fn();
    renderWithProviders(
      <MemoryRouter>
        <WidgetFrame
          instance={instance("widget-from-the-future")}
          onRemove={onRemove}
          onConfigChange={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Unknown widget “widget-from-the-future”/),
    ).toBeInTheDocument();
  });

  it("wires the chrome: deep link, remove, and the config dialog", async () => {
    const onRemove = vi.fn();
    const onConfigChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <WidgetFrame
          instance={{ ...instance("doctor-panel"), config: {} }}
          onRemove={onRemove}
          onConfigChange={onConfigChange}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Open Doctor" })).toHaveAttribute(
      "href",
      "/doctor",
    );
    await user.click(screen.getByRole("button", { name: "Remove Doctor" }));
    expect(onRemove).toHaveBeenCalledOnce();
    // doctor-panel has no config fields → no config button.
    expect(
      screen.queryByRole("button", { name: "Configure Doctor" }),
    ).not.toBeInTheDocument();
  });

  it("saves per-widget config through the dialog", async () => {
    const onConfigChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <WidgetFrame
          instance={{ ...instance("cost-chart"), config: { since: "7d" } }}
          onRemove={() => {}}
          onConfigChange={onConfigChange}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Configure Cost" }));
    expect(await screen.findByText("Configure “Cost”")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Time window" }));
    await user.click(await screen.findByRole("option", { name: "30d" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onConfigChange).toHaveBeenCalledWith({ since: "30d" });
  });
});
