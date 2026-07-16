/**
 * Dashboard document helpers — server-doc coercion (incl. unknown widget
 * survival), placement, board mutations.
 */
import { describe, expect, it } from "vitest";
import {
  addBoard,
  addWidgetTo,
  applyGridLayout,
  coerceDoc,
  removeBoard,
  removeWidgetFrom,
  resetBoard,
  updateWidgetConfig,
} from "@/dashboard/dashboards";
import { DEFAULT_DASHBOARDS } from "@/widgets/defaults";
import type { LayoutsDocument } from "@/api/types";

const savedDoc: LayoutsDocument = {
  version: 1,
  active: "ops",
  dashboards: {
    ops: {
      widgets: [
        {
          id: "w1",
          widget: "cost-chart",
          config: { since: "7d", by: "day" },
          layout: { x: 0, y: 0, w: 6, h: 3 },
        },
        {
          id: "w2",
          widget: "some-widget-from-the-future",
          config: {},
          layout: { x: 6, y: 0, w: 4, h: 3 },
        },
      ],
    },
  },
};

describe("coerceDoc", () => {
  it("ships the three default boards when the server document is empty", () => {
    const doc = coerceDoc({ version: 1, active: "default", dashboards: {} });
    expect(Object.keys(doc.dashboards)).toEqual(
      Object.keys(DEFAULT_DASHBOARDS),
    );
    expect(doc.active).toBe("default");
    expect(doc.dashboards.default!.widgets.length).toBeGreaterThanOrEqual(6);
  });

  it("round-trips a persisted document, preserving unknown widget ids", () => {
    const doc = coerceDoc(savedDoc);
    expect(doc.active).toBe("ops");
    expect(doc.dashboards.ops!.widgets).toHaveLength(2);
    // Forward compatibility: unknown ids survive (they render placeholders).
    expect(doc.dashboards.ops!.widgets[1]!.widget).toBe(
      "some-widget-from-the-future",
    );
  });

  it("repairs an active pointer at a missing board", () => {
    const doc = coerceDoc({ ...savedDoc, active: "gone" });
    expect(doc.active).toBe("ops");
  });
});

describe("board mutations", () => {
  const doc = coerceDoc(savedDoc);

  it("addWidgetTo appends below existing widgets with the default size", () => {
    const next = addWidgetTo(doc, "ops", "doctor-panel");
    const added = next.dashboards.ops!.widgets.at(-1)!;
    expect(added.widget).toBe("doctor-panel");
    expect(added.layout).toMatchObject({ x: 0, y: 3, w: 4, h: 4 });
    expect(doc.dashboards.ops!.widgets).toHaveLength(2); // immutable
  });

  it("removeWidgetFrom drops the instance", () => {
    const next = removeWidgetFrom(doc, "ops", "w1");
    expect(next.dashboards.ops!.widgets.map((w) => w.id)).toEqual(["w2"]);
  });

  it("updateWidgetConfig replaces one instance's config", () => {
    const next = updateWidgetConfig(doc, "ops", "w1", { since: "30d" });
    expect(next.dashboards.ops!.widgets[0]!.config).toEqual({ since: "30d" });
  });

  it("applyGridLayout writes drag/resize positions back (no-op when unchanged)", () => {
    const moved = applyGridLayout(doc, "ops", [
      { i: "w1", x: 2, y: 1, w: 8, h: 4 },
    ]);
    expect(moved.dashboards.ops!.widgets[0]!.layout).toEqual({
      x: 2,
      y: 1,
      w: 8,
      h: 4,
    });
    const unchanged = applyGridLayout(doc, "ops", [
      { i: "w1", x: 0, y: 0, w: 6, h: 3 },
    ]);
    expect(unchanged).toBe(doc);
  });

  it("resetBoard restores the shipped default for known board names", () => {
    const withDefault = addBoard(doc, "default");
    const reset = resetBoard(withDefault, "default");
    expect(reset.dashboards.default!.widgets).toEqual(
      DEFAULT_DASHBOARDS.default!.widgets,
    );
  });

  it("addBoard/removeBoard manage named dashboards and never drop the last one", () => {
    const two = addBoard(doc, "second");
    expect(two.active).toBe("second");
    const one = removeBoard(two, "second");
    expect(one.active).toBe("ops");
    expect(removeBoard(one, "ops")).toBe(one); // last board is kept
  });
});
