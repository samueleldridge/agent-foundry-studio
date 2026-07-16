import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("obs dashboards", () => {
  it("renders the four panels plus the runs feed", async () => {
    renderRoute("/obs");
    expect(await screen.findByText("Cost per day")).toBeInTheDocument();
    expect(screen.getByText("Latency by model (p50 / p95)")).toBeInTheDocument();
    expect(screen.getByText("Eval trend")).toBeInTheDocument();
    expect(screen.getByText("Tool failures")).toBeInTheDocument();
    expect(screen.getByText("Runs feed")).toBeInTheDocument();

    // Runs feed rows from real fixture data.
    expect(
      await screen.findByText("01KXEPYAH7NH83JF9JZ6JMGRJV"),
    ).toBeInTheDocument();
    expect(screen.getByText("$0.0002")).toBeInTheDocument();

    // Designed empty state for the empty tool-failures window.
    expect(screen.getByText(/No tool failures in this window/)).toBeInTheDocument();
  });

  it("shows designed empty states when there is no data", async () => {
    server.use(
      http.get("/api/obs/cost", () => HttpResponse.json({ rows: [] })),
      http.get("/api/obs/eval-trend", () => HttpResponse.json({ rows: [] })),
    );
    renderRoute("/obs");
    expect(
      await screen.findByText("No data recorded yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("No eval runs recorded yet.")).toBeInTheDocument();
  });

  it("renders the error envelope when a panel query fails", async () => {
    server.use(http.get("/api/obs/cost", () => errorResponse(500)));
    renderRoute("/obs");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
