/**
 * Forge console — launch form (structured params only), history with
 * drill-in, live SSE trajectory (iterations + commits + scores), sandbox
 * violations surfaced as prominent alerts, termination banner, cancel.
 */
import { describe, expect, it } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { MockEventSource } from "./mock-event-source";
import { forgeRunFinished, forgeRunRunning } from "./msw/fixtures";

describe("forge console", () => {
  it("shows the history of past forge runs with termination reasons", async () => {
    renderRoute("/forge");
    expect(await screen.findByText("forge_01DONE")).toBeInTheDocument();
    expect(screen.getByText("threshold_met")).toBeInTheDocument();
    expect(screen.getByText("0.95")).toBeInTheDocument();
  });

  it("launches a forge run with structured params and navigates to the live view", async () => {
    let launchBody: unknown = null;
    server.use(
      http.post("/api/forge", async ({ request }) => {
        launchBody = await request.json();
        return HttpResponse.json(
          {
            forge_run_id: "forge_01NEW",
            project: "hello",
            events_url: "/api/forge/forge_01NEW/events",
          },
          { status: 202 },
        );
      }),
      http.get("/api/forge/forge_01NEW", () =>
        HttpResponse.json({ ...forgeRunRunning, forge_run_id: "forge_01NEW" }),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/forge");

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "hello" }));
    await user.type(
      screen.getByLabelText("Eval set path"),
      "projects/hello/evals/hello_eval.yaml",
    );
    await user.type(
      screen.getByLabelText("Description"),
      "make the greeting friendlier",
    );
    await user.type(screen.getByLabelText("Cost cap (USD, optional)"), "2.50");
    await user.click(screen.getByRole("button", { name: /Launch forge/ }));

    await waitFor(() =>
      expect(launchBody).toEqual({
        project: "hello",
        description: "make the greeting friendlier",
        eval_path: "projects/hello/evals/hello_eval.yaml",
        threshold: 0.9,
        max_iter: 5,
        max_cost_usd: "2.50",
        model: null,
        no_improvement_after: 3,
      }),
    );
    // Navigated to the run detail.
    expect(await screen.findByText("Forge run")).toBeInTheDocument();
    expect(await screen.findByText("forge_01NEW")).toBeInTheDocument();
  });

  it("offers 'watch the active run' on a 409 concurrent-launch conflict", async () => {
    server.use(
      http.post("/api/forge", () =>
        HttpResponse.json(
          {
            error_class: "ForgeAlreadyRunning",
            message: "a forge run is already active for project 'hello'",
            context: { forge_run_id: "forge_01LIVE" },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/forge");

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "hello" }));
    await user.type(screen.getByLabelText("Eval set path"), "evals/e.yaml");
    await user.type(screen.getByLabelText("Description"), "x");
    await user.click(screen.getByRole("button", { name: /Launch forge/ }));

    expect(await screen.findByText("ForgeAlreadyRunning")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Watch the active run instead/ }),
    ).toHaveAttribute("href", "/forge/forge_01LIVE");
  });

  it("streams the live trajectory: iterations, commits, violations, termination", async () => {
    server.use(
      http.get("/api/forge/forge_01LIVE", () =>
        HttpResponse.json(forgeRunRunning),
      ),
    );
    renderRoute("/forge/forge_01LIVE");
    // Cancel appears once the run info loads and the run is live.
    expect(
      await screen.findByRole("button", { name: /Cancel/ }),
    ).toBeInTheDocument();

    const stream = await waitFor(() => {
      const s = MockEventSource.latestFor("/api/forge/forge_01LIVE/events");
      expect(s).toBeDefined();
      return s!;
    });

    act(() => {
      stream.emit(
        "forge.iteration_completed",
        {
          forge_run_id: "forge_01LIVE",
          iteration_number: 1,
          eval_score: 0.8,
          eval_delta: 0.8,
          commit_shas: ["deadbeefcafe00000000000000000000000000ff"],
          applied: true,
        },
        "1",
      );
    });
    expect(screen.getByText("iteration 1")).toBeInTheDocument();
    expect(screen.getByText("score 0.80")).toBeInTheDocument();
    expect(screen.getByText("deadbeef")).toBeInTheDocument();

    act(() => {
      stream.emit(
        "meta_agent.violation",
        {
          forge_run_id: "forge_01LIVE",
          tool: "write_file",
          detail: "refused: path escapes projects/hello",
        },
        "2",
      );
    });
    // Sandbox violations render as a prominent alert (and in the log tail).
    expect(screen.getByText("Sandbox violation")).toBeInTheDocument();
    expect(
      screen.getAllByText(/path escapes projects\/hello/).length,
    ).toBeGreaterThanOrEqual(1);

    act(() => {
      stream.emit(
        "forge.terminated",
        {
          forge_run_id: "forge_01LIVE",
          reason: "threshold_met",
          final_score: 0.95,
          iterations: 1,
        },
        "3",
      );
    });
    expect(screen.getByText(/terminated:/)).toBeInTheDocument();
    expect(screen.getByText("threshold_met")).toBeInTheDocument();
    expect(stream.closed).toBe(true);
  });

  it("cancels a live run from the UI", async () => {
    let cancelled = false;
    server.use(
      http.get("/api/forge/forge_01LIVE", () =>
        HttpResponse.json(forgeRunRunning),
      ),
      http.post("/api/forge/forge_01LIVE/cancel", () => {
        cancelled = true;
        return HttpResponse.json({
          forge_run_id: "forge_01LIVE",
          status: "cancelling",
        });
      }),
    );
    const user = userEvent.setup();
    renderRoute("/forge/forge_01LIVE");
    await user.click(await screen.findByRole("button", { name: /Cancel/ }));
    await waitFor(() => expect(cancelled).toBe(true));
  });

  it("renders a finished run's historical trajectory from the artifact", async () => {
    renderRoute("/forge/forge_01DONE");
    expect(await screen.findByText("iteration 2")).toBeInTheDocument();
    expect(screen.getByText("score 0.95")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d4")).toBeInTheDocument();
    expect(screen.getByText(forgeRunFinished.termination_detail)).toBeInTheDocument();
    // No live stream for a finished run.
    expect(MockEventSource.latestFor("/api/forge/forge_01DONE/events")).toBeUndefined();
  });
});
