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
import { projectUnavailableError, ragProjectDetail } from "./msw/fixtures";

const ragStoredSession: ChatSessionInfo = {
  session_id: "s_01JXRAGSTORED01",
  project: "rag_hello",
  created_at: "2026-07-15T10:00:00Z",
  run_ids: [],
  multi_turn: false,
  events_url: "/api/chat/rag_hello/sessions/s_01JXRAGSTORED01/events",
  input_fields: [],
};

function useRagProject(sessions: ChatSessionInfo[]) {
  server.use(
    http.get("/api/projects/rag_hello", () =>
      HttpResponse.json(ragProjectDetail),
    ),
    http.get("/api/chat/rag_hello/sessions", () =>
      HttpResponse.json(sessions),
    ),
  );
}

describe("project unavailable (missing runtime secrets)", () => {
  it("chat screen shows the banner with env var, remedy, and connections link", async () => {
    useRagProject([]);
    renderRoute("/projects/rag_hello/chat");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("rag_hello is unavailable");
    expect(banner).toHaveTextContent("COHERE_API_KEY");
    expect(banner).toHaveTextContent(/restart foundry studio/);
    expect(
      screen.getByRole("link", { name: "Review connections" }),
    ).toHaveAttribute("href", "/projects/rag_hello/connections");
    // Runs can't start without the secret.
    expect(
      screen.getByRole("button", { name: /New session/ }),
    ).toBeDisabled();
  });

  it("chat screen still lists stored sessions and disables the thread composer", async () => {
    useRagProject([ragStoredSession]);
    renderRoute("/projects/rag_hello/chat");

    // The stored session renders in the sidebar (no error wall) …
    expect(
      await screen.findByText("s_01JXRAGSTORED0"),
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
    expect(banner).toHaveTextContent("rag_hello is unavailable");
    expect(banner).toHaveTextContent("COHERE_API_KEY");
    expect(screen.queryByText("Could not load versions")).not.toBeInTheDocument();
  });
});
