/**
 * Project-unavailable UX (missing runtime secrets, backend 424 /
 * detail `unavailable` block): friendly banner naming the env var(s) +
 * remedy + connections link instead of an error wall; chat still lists
 * stored sessions with a disabled composer.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ChatSessionInfo } from "@/api/types";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { projectUnavailableError, brokenCredsProjectDetail } from "./msw/fixtures";

const brokenCredsStoredSession: ChatSessionInfo = {
  session_id: "s_01JXBROKENSTOR01",
  project: "broken_creds",
  created_at: "2026-07-15T10:00:00Z",
  run_ids: [],
  multi_turn: false,
  events_url: "/api/chat/broken_creds/sessions/s_01JXBROKENSTOR01/events",
  input_fields: [],
};

function useBrokenCredsProject(sessions: ChatSessionInfo[]) {
  server.use(
    http.get("/api/projects/broken_creds", () =>
      HttpResponse.json(brokenCredsProjectDetail),
    ),
    http.get("/api/chat/broken_creds/sessions", () =>
      HttpResponse.json(sessions),
    ),
  );
}

describe("project unavailable (missing runtime secrets)", () => {
  it("chat screen shows the banner with env var, remedy, and connections link", async () => {
    useBrokenCredsProject([]);
    renderRoute("/projects/broken_creds/chat");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("broken_creds is unavailable");
    expect(banner).toHaveTextContent("COHERE_API_KEY");
    expect(banner).toHaveTextContent(/restart foundry studio/);
    expect(
      screen.getByRole("link", { name: "Review connections" }),
    ).toHaveAttribute("href", "/projects/broken_creds/connections");
    // COHERE_API_KEY is a provider key → the banner cross-links to the
    // Providers panel where it can be added without a restart.
    expect(
      await screen.findByRole("link", { name: /Add key in Providers/ }),
    ).toHaveAttribute("href", "/providers");
    // Runs can't start without the secret.
    expect(
      screen.getByRole("button", { name: /New session/ }),
    ).toBeDisabled();
  });

  it("omits the Providers cross-link when the missing var is not a provider key", async () => {
    server.use(
      http.get("/api/projects/broken_creds", () =>
        HttpResponse.json({
          ...brokenCredsProjectDetail,
          unavailable: {
            env_vars: ["INTERNAL_DB_PASSWORD"],
            remedy: "set INTERNAL_DB_PASSWORD and restart foundry studio",
          },
        }),
      ),
      http.get("/api/chat/broken_creds/sessions", () => HttpResponse.json([])),
    );
    renderRoute("/projects/broken_creds/chat");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("INTERNAL_DB_PASSWORD");
    // Key statuses have loaded (connections link is there) …
    expect(
      screen.getByRole("link", { name: "Review connections" }),
    ).toBeInTheDocument();
    // … but a non-provider var gets no Providers cross-link.
    expect(
      screen.queryByRole("link", { name: /Add key in Providers/ }),
    ).not.toBeInTheDocument();
  });

  it("chat screen still lists stored sessions and disables the thread composer", async () => {
    useBrokenCredsProject([brokenCredsStoredSession]);
    renderRoute("/projects/broken_creds/chat");

    // The stored session renders in the sidebar (no error wall) …
    expect(
      await screen.findByText("s_01JXBROKENSTOR"),
    ).toBeInTheDocument();
    // … and the reattached thread's composer is disabled.
    const box = await screen.findByRole("textbox", { name: "Chat message" });
    expect(box).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    expect(
      screen.queryByText("Could not load chat sessions"),
    ).not.toBeInTheDocument();
  });

  it("a 424 response renders the banner instead of the error wall on other tabs", async () => {
    server.use(
      http.get("/api/projects/hello/versions", () =>
        HttpResponse.json(projectUnavailableError, { status: 424 }),
      ),
    );
    renderRoute("/projects/hello/versions");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("broken_creds is unavailable");
    expect(banner).toHaveTextContent("COHERE_API_KEY");
    expect(screen.queryByText("Could not load versions")).not.toBeInTheDocument();
  });
});
