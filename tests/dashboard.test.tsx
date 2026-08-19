/**
 * Dashboard host — default boards when the server document is empty,
 * add/remove widgets, and debounced persistence via `PUT /api/layouts`
 * with the documented shape (server-side, never localStorage).
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import type { DashboardsDoc } from "@/widgets/types";

function capturePut() {
  const puts: DashboardsDoc[] = [];
  server.use(
    http.put("/api/layouts", async ({ request }) => {
      const body = (await request.json()) as DashboardsDoc;
      puts.push(body);
      return HttpResponse.json(body);
    }),
  );
  return puts;
}

describe("dashboard", () => {
  it("ships the three default boards when the server document is empty", async () => {
    renderRoute("/");
    expect(await screen.findByRole("tab", { name: "default" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "forge board" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "chat board" })).toBeInTheDocument();
    // The default board's six widgets render with live data.
    expect(await screen.findByText("Project health")).toBeInTheDocument();
    const grid = within(
      document.querySelector('[data-slot="dashboard-grid"]') as HTMLElement,
    );
    expect(grid.getByText("Runs feed")).toBeInTheDocument();
    expect(grid.getByText("Cost")).toBeInTheDocument();
    expect(grid.getByText("Eval trend")).toBeInTheDocument();
    expect(grid.getByText("Approvals")).toBeInTheDocument();
    expect(grid.getByText("Doctor")).toBeInTheDocument();
    // Live data flowed into the tiles (project-health card).
    expect(await screen.findByText("config loads")).toBeInTheDocument();
  });

  it("renders a persisted board from the server, incl. unknown-widget placeholders", async () => {
    server.use(
      http.get("/api/layouts", () =>
        HttpResponse.json({
          version: 1,
          active: "ops",
          dashboards: {
            ops: {
              widgets: [
                {
                  id: "w1",
                  widget: "doctor-panel",
                  config: {},
                  layout: { x: 0, y: 0, w: 4, h: 4 },
                },
                {
                  id: "w2",
                  widget: "widget-from-the-future",
                  config: {},
                  layout: { x: 4, y: 0, w: 4, h: 4 },
                },
              ],
            },
          },
        }),
      ),
    );
    renderRoute("/");
    expect(await screen.findByRole("tab", { name: "ops" })).toBeInTheDocument();
    const grid = within(
      (await screen.findByText(/Unknown widget/)).closest(
        '[data-slot="dashboard-grid"]',
      ) as HTMLElement,
    );
    expect(grid.getByText("Doctor")).toBeInTheDocument();
    // Forward compatibility: placeholder tile, not a crash.
    expect(
      screen.getByText(/Unknown widget “widget-from-the-future”/),
    ).toBeInTheDocument();
  });

  it("adds a widget from the picker and persists the layout (debounced PUT)", async () => {
    const puts = capturePut();
    const user = userEvent.setup();
    renderRoute("/");
    await screen.findByRole("tab", { name: "default" });

    await user.click(screen.getByRole("button", { name: /Add widget/ }));
    expect(await screen.findByText("Add a widget")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /latency-chart/ }));

    // The tile appears immediately…
    expect(await screen.findByText("Latency")).toBeInTheDocument();
    // …and the debounced PUT carries the documented shape.
    await waitFor(
      () => {
        expect(puts.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );
    const doc = puts.at(-1)!;
    expect(doc.version).toBe(1);
    expect(doc.active).toBe("default");
    const widgets = doc.dashboards.default!.widgets;
    const added = widgets.find((w) => w.widget === "latency-chart")!;
    expect(added).toMatchObject({
      widget: "latency-chart",
      config: {},
      layout: expect.objectContaining({ w: 6, h: 3 }),
    });
  });

  it("flushes the still-debounced layout save on unmount (edit is never dropped)", async () => {
    const puts = capturePut();
    const user = userEvent.setup();
    const { unmount } = renderRoute("/");
    await screen.findByText("Project health");

    await user.click(
      screen.getByRole("button", { name: "Remove Project health" }),
    );
    // Unmount before the 800ms debounce fires — the pending save must be
    // flushed in cleanup, not dropped.
    expect(puts).toHaveLength(0);
    unmount();
    await waitFor(() => expect(puts.length).toBeGreaterThanOrEqual(1));
    const widgets = puts.at(-1)!.dashboards.default!.widgets;
    expect(widgets.some((w) => w.widget === "project-health")).toBe(false);
  });

  it("removes a widget and persists the removal", async () => {
    const puts = capturePut();
    const user = userEvent.setup();
    renderRoute("/");
    await screen.findByText("Project health");

    await user.click(
      screen.getByRole("button", { name: "Remove Project health" }),
    );
    expect(screen.queryByText("Project health")).not.toBeInTheDocument();
    await waitFor(
      () => {
        expect(puts.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );
    const widgets = puts.at(-1)!.dashboards.default!.widgets;
    expect(widgets.some((w) => w.widget === "project-health")).toBe(false);
    expect(widgets).toHaveLength(5);
  });

  it("switches boards and creates a new named dashboard", async () => {
    const puts = capturePut();
    const user = userEvent.setup();
    renderRoute("/");
    await screen.findByRole("tab", { name: "forge board" });

    await user.click(screen.getByRole("tab", { name: "forge board" }));
    expect(await screen.findByText("Forge console")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New dashboard" }));
    await user.type(await screen.findByLabelText("Name"), "ops board");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("tab", { name: "ops board" })).toBeInTheDocument();
    expect(screen.getByText("Empty board")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(puts.at(-1)?.dashboards["ops board"]).toBeDefined();
      },
      { timeout: 3000 },
    );
    expect(puts.at(-1)!.active).toBe("ops board");
  });

  it("resets the active board to its shipped default", async () => {
    const user = userEvent.setup();
    renderRoute("/");
    await screen.findByText("Project health");

    await user.click(screen.getByRole("button", { name: "Remove Project health" }));
    expect(screen.queryByText("Project health")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Reset board/ }));
    expect(await screen.findByText("Project health")).toBeInTheDocument();
  });
});
