import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("connections", () => {
  it("renders redacted descriptors and runs a health check", async () => {
    const user = userEvent.setup();
    renderRoute("/projects/hello/connections");

    expect(await screen.findByText("time_service")).toBeInTheDocument();
    expect(screen.getByText("http_service@v1")).toBeInTheDocument();
    // Redacted config only — no credential fields.
    expect(screen.getByText(/worldtimeapi\.org/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Health/ }));
    expect(await screen.findByText(/200 OK/)).toBeInTheDocument();
    expect(screen.getByText("reach")).toBeInTheDocument();
  });

  it("renders the error envelope on failure", async () => {
    server.use(
      http.get("/api/projects/hello/connections", () => errorResponse(500)),
    );
    renderRoute("/projects/hello/connections");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
