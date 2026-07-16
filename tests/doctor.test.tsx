import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";
import { doctorReport } from "./msw/fixtures";

describe("doctor", () => {
  it("renders all checks with ok/warn/fail states", async () => {
    renderRoute("/doctor");
    expect(await screen.findByText("framework")).toBeInTheDocument();
    expect(screen.getByText("provider:anthropic")).toBeInTheDocument();
    expect(screen.getByText(/remedy: export ANTHROPIC_API_KEY/)).toBeInTheDocument();
    // Status summary badges.
    expect(screen.getByText("2 ok")).toBeInTheDocument();
    expect(screen.getByText("1 warn")).toBeInTheDocument();
    expect(screen.getByText("1 fail")).toBeInTheDocument();
  });

  it("re-runs the check suite on demand", async () => {
    let calls = 0;
    server.use(
      http.get("/api/doctor", () => {
        calls += 1;
        return HttpResponse.json(doctorReport);
      }),
    );
    const user = userEvent.setup();
    renderRoute("/doctor");
    await screen.findByText("framework");
    expect(calls).toBe(1);
    await user.click(screen.getByRole("button", { name: "Re-run checks" }));
    expect(await screen.findByText("framework")).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it("renders the error envelope when doctor fails", async () => {
    server.use(http.get("/api/doctor", () => errorResponse(500)));
    renderRoute("/doctor");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
