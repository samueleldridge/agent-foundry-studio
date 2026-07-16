import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("runs history", () => {
  it("renders run rows with status, cost, and error class", async () => {
    renderRoute("/projects/hello/runs");
    expect(
      await screen.findByText("01KXEPYAH7NH83JF9JZ6JMGRJV"),
    ).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("ProviderAuthError")).toBeInTheDocument();
    expect(screen.getByText("$0.0002")).toBeInTheDocument();
  });

  it("renders the error envelope on failure", async () => {
    server.use(http.get("/api/runs", () => errorResponse(500)));
    renderRoute("/projects/hello/runs");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});

describe("run detail", () => {
  it("renders the artifact view (inputs, outputs, call indexes)", async () => {
    renderRoute("/projects/hello/runs/01KXEPYAH7NH83JF9JZ6JMGRJV");
    expect(await screen.findByText(/"greeting": "Hello, world!"/)).toBeInTheDocument();
    expect(screen.getByText(/State transitions \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/LLM calls \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tool calls \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/14 events persisted/)).toBeInTheDocument();
  });

  it("renders the error envelope when the artifact is missing", async () => {
    server.use(http.get("/api/runs/:runId/artifact", () => errorResponse(404)));
    renderRoute("/projects/hello/runs/01KXEPYAH7NH83JF9JZ6JMGRJV");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
