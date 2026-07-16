import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("projects list", () => {
  it("renders project rows from the API", async () => {
    renderRoute("/projects");
    expect(await screen.findByText("team_hello")).toBeInTheDocument();
    // health digest + eval score from the summary
    expect(screen.getAllByText("healthy").length).toBeGreaterThan(0);
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("renders the structured FoundryError envelope on failure", async () => {
    server.use(http.get("/api/projects", () => errorResponse(500)));
    renderRoute("/projects");
    expect(
      await screen.findByText(/project 'nope' does not exist/),
    ).toBeInTheDocument();
    expect(screen.getByText("ProjectNotFound")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy details/i })).toBeInTheDocument();
  });
});

describe("project overview", () => {
  it("renders system summary, agents, and pins", async () => {
    renderRoute("/projects/hello");
    expect(await screen.findByText("hello_agent")).toBeInTheDocument();
    expect(screen.getByText("anthropic/claude-haiku-4-5")).toBeInTheDocument();
    expect(screen.getByText("single")).toBeInTheDocument();
    expect(
      screen.getByText(/get_time → catalog\/http_get_json@v1/),
    ).toBeInTheDocument();
  });

  it("renders the error envelope when the project is missing", async () => {
    server.use(http.get("/api/projects/hello", () => errorResponse(404)));
    renderRoute("/projects/hello");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
