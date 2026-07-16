/**
 * Flow-graph screen — GraphExport rendering for both fixture shapes
 * (hello single, team_hello supervisor + workers), the node side panel,
 * and the non-compiling-project ValidationResult path.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute, renderWithProviders } from "./utils";
import { MemoryRouter } from "react-router";
import { GraphSidePanel } from "@/features/graph/GraphSidePanel";
import { graphTeamHello } from "./msw/fixtures";

describe("graph screen", () => {
  it("renders hello's single-agent shape from the graph-export endpoint", async () => {
    renderRoute("/projects/hello/graph");
    expect(await screen.findByText("hello_agent")).toBeInTheDocument();
    expect(screen.getByText("start")).toBeInTheDocument();
    expect(screen.getByText("end")).toBeInTheDocument();
    // Model chip + prompt/tool summary on the agent card.
    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getByText(/prompt v2/)).toBeInTheDocument();
    expect(screen.getByText(/1 tool$/)).toBeInTheDocument();
    // Header: pattern + system_version staleness token + recompile.
    expect(screen.getByText(/pattern: single/)).toBeInTheDocument();
    expect(screen.getByText("e9ce9a8ffe75")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recompile/ })).toBeInTheDocument();
  });

  it("renders team_hello's supervisor + two workers with roles", async () => {
    renderRoute("/projects/team_hello/graph");
    expect(await screen.findByText("coordinator")).toBeInTheDocument();
    expect(screen.getByText("drafter")).toBeInTheDocument();
    expect(screen.getByText("publisher")).toBeInTheDocument();
    expect(screen.getByText("supervisor")).toBeInTheDocument();
    expect(screen.getAllByText("worker")).toHaveLength(2);
    expect(screen.getByText(/pattern: supervisor/)).toBeInTheDocument();
    expect(screen.getByText(/primary agent: coordinator/)).toBeInTheDocument();
  });

  it("renders the server ValidationResult with a config-editor link when the project does not compile", async () => {
    server.use(
      http.get("/api/projects/hello/graph", () =>
        HttpResponse.json(
          {
            ok: false,
            kind: "system",
            issues: [
              {
                severity: "error",
                message: "unknown provider 'anthropc'; available: anthropic, openai",
                pointer: "/agents/0/model_binding/provider",
                line: 3,
                column: 13,
                hint: "did you mean 'anthropic'?",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderRoute("/projects/hello/graph");
    expect(
      await screen.findByText("Project does not compile"),
    ).toBeInTheDocument();
    expect(screen.getByText(/unknown provider 'anthropc'/)).toBeInTheDocument();
    expect(screen.getByText(/did you mean 'anthropic'\?/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Open config editor/ });
    expect(link).toHaveAttribute("href", "/projects/hello/configs");
  });
});

describe("graph side panel", () => {
  it("shows tools with pins, state scopes, and jump links", async () => {
    const user = userEvent.setup();
    const onClose = () => {};
    renderWithProviders(
      <MemoryRouter>
        <GraphSidePanel
          project="team_hello"
          node={graphTeamHello.nodes.find((n) => n.id === "publisher")!}
          onClose={onClose}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("publisher")).toBeInTheDocument();
    expect(screen.getByText("anthropic/claude-haiku-4-5")).toBeInTheDocument();
    expect(screen.getByText("local/publish_greeting@v1")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument(); // state read
    expect(screen.getByText("published")).toBeInTheDocument(); // state write
    expect(screen.getByRole("link", { name: /Open config/ })).toHaveAttribute(
      "href",
      "/projects/team_hello/configs?path=agents/publisher/agent.yaml",
    );
    expect(screen.getByRole("link", { name: /View runs/ })).toHaveAttribute(
      "href",
      "/projects/team_hello/runs",
    );
    // Keyboard-focusable close control.
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Close node panel" }),
    ).toBeInTheDocument();
  });
});
