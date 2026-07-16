/**
 * Chat — streaming thread over the session SSE: llm.delta rendering,
 * tool-call chips, in-thread approval cards (approve AND reject-with-reason
 * both post the ApprovalResponse), failed-run rendering + retry, session
 * reattach.
 */
import { describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { MockEventSource } from "./mock-event-source";
import { chatSession } from "./msw/fixtures";

const EVENTS_URL = "sessions/s_01JXCHATSESSION01/events";

async function openChatWithMessage(user: ReturnType<typeof userEvent.setup>) {
  renderRoute("/projects/hello/chat");
  await screen.findAllByText(/single-turn/i);
  const stream = await waitFor(() => {
    const s = MockEventSource.latestFor(EVENTS_URL);
    expect(s).toBeDefined();
    return s!;
  });
  await user.type(screen.getByRole("textbox", { name: "Chat message" }), "hi there");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  return stream;
}

describe("chat", () => {
  it("streams llm deltas and shows the run footer on completion", async () => {
    const user = userEvent.setup();
    const stream = await openChatWithMessage(user);

    act(() => {
      stream.emit("run.started", { run_id: "01KXCHATRUN01", sequence: 0 }, "0");
      stream.emit(
        "llm.delta",
        { run_id: "01KXCHATRUN01", delta: { type: "text", text: "Hello, " } },
        "1",
      );
      stream.emit(
        "llm.delta",
        { run_id: "01KXCHATRUN01", delta: { type: "text", text: "operator!" } },
        "2",
      );
    });
    // The operator message renders right-aligned; the response streams.
    expect(screen.getByText("hi there")).toBeInTheDocument();
    expect(screen.getByText("Hello, operator!")).toBeInTheDocument();

    act(() => {
      stream.emit(
        "run.completed",
        {
          run_id: "01KXCHATRUN01",
          status: "success",
          total_input_tokens: 10,
          total_output_tokens: 5,
          total_cost_estimate_usd: 0.0012,
          duration_ms: 640,
        },
        "3",
      );
    });
    // Run footer: run_id link + cost + tokens.
    const footerLink = screen.getByRole("link", { name: "01KXCHATRUN01" });
    expect(footerLink).toHaveAttribute(
      "href",
      "/projects/hello/runs/01KXCHATRUN01",
    );
    expect(screen.getByText("$0.0012")).toBeInTheDocument();
    expect(screen.getByText("15 tok")).toBeInTheDocument();
  });

  it("shows tool calls in the collapsible activity strip", async () => {
    const user = userEvent.setup();
    const stream = await openChatWithMessage(user);

    act(() => {
      stream.emit("run.started", { run_id: "01KXCHATRUN01" }, "0");
      stream.emit(
        "tool.started",
        { run_id: "01KXCHATRUN01", tool_ref: "catalog/http_get_json@v1" },
        "1",
      );
      stream.emit(
        "tool.completed",
        {
          run_id: "01KXCHATRUN01",
          tool_ref: "catalog/http_get_json@v1",
          success: true,
          latency_ms: 88,
        },
        "2",
      );
    });

    const strip = screen.getByText(/activity · 1 events/).closest("button")!;
    // Chip summary before expanding.
    expect(within(strip).getByText("catalog/http_get_json")).toBeInTheDocument();
    await user.click(strip);
    expect(screen.getByText("catalog/http_get_json@v1")).toBeInTheDocument();
    expect(screen.getByText("· 88ms")).toBeInTheDocument();
  });

  it("renders an in-thread approval card; approving posts the ApprovalResponse", async () => {
    let resumeBody: unknown = null;
    server.use(
      http.post(
        "/api/chat/hello/sessions/:sid/approvals",
        async ({ request }) => {
          resumeBody = await request.json();
          return HttpResponse.json({
            run_id: "01KXCHATRUN01",
            status: "resumed",
            events_url: "",
          });
        },
      ),
    );
    const user = userEvent.setup();
    const stream = await openChatWithMessage(user);

    act(() => {
      stream.emit("run.started", { run_id: "01KXCHATRUN01" }, "0");
      stream.emit(
        "approval.required",
        {
          run_id: "01KXCHATRUN01",
          approval_id: "publish-1",
          prompt: "Publish the greeting?",
          agent_name: "publisher",
          context: { tool: "publish_greeting" },
        },
        "1",
      );
    });
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByText("Publish the greeting?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(resumeBody).toEqual({
        approval_id: "publish-1",
        decision: "approved",
        reason: null,
      }),
    );

    // The stream resumes and the card collapses to a resolved badge.
    act(() => {
      stream.emit(
        "approval.resolved",
        {
          run_id: "01KXCHATRUN01",
          approval_id: "publish-1",
          decision: "approved",
        },
        "2",
      );
    });
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("rejecting requires a reason and posts it; badge shows the reason", async () => {
    let resumeBody: unknown = null;
    server.use(
      http.post(
        "/api/chat/hello/sessions/:sid/approvals",
        async ({ request }) => {
          resumeBody = await request.json();
          return HttpResponse.json({
            run_id: "01KXCHATRUN01",
            status: "resumed",
            events_url: "",
          });
        },
      ),
    );
    const user = userEvent.setup();
    const stream = await openChatWithMessage(user);

    act(() => {
      stream.emit("run.started", { run_id: "01KXCHATRUN01" }, "0");
      stream.emit(
        "approval.required",
        {
          run_id: "01KXCHATRUN01",
          approval_id: "publish-1",
          prompt: "Publish the greeting?",
        },
        "1",
      );
    });

    await user.click(screen.getByRole("button", { name: "Reject…" }));
    const confirm = screen.getByRole("button", { name: "Confirm reject" });
    expect(confirm).toBeDisabled(); // no reason yet
    await user.type(
      screen.getByRole("textbox", { name: "Rejection reason" }),
      "wrong channel",
    );
    await user.click(confirm);
    await waitFor(() =>
      expect(resumeBody).toEqual({
        approval_id: "publish-1",
        decision: "rejected",
        reason: "wrong channel",
      }),
    );

    act(() => {
      stream.emit(
        "approval.resolved",
        {
          run_id: "01KXCHATRUN01",
          approval_id: "publish-1",
          decision: "rejected",
          reason: "wrong channel",
        },
        "2",
      );
    });
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/wrong channel/)).toBeInTheDocument();
  });

  it("renders a failed run's structured error with a retry affordance", async () => {
    const user = userEvent.setup();
    const stream = await openChatWithMessage(user);

    act(() => {
      stream.emit("run.started", { run_id: "01KXCHATRUN01" }, "0");
      stream.emit(
        "run.failed",
        {
          run_id: "01KXCHATRUN01",
          error: {
            error_class: "ProviderAuthError",
            message: "authentication_error: invalid x-api-key",
            context: { provider: "anthropic" },
          },
        },
        "1",
      );
    });

    expect(screen.getByText("Run failed")).toBeInTheDocument();
    expect(screen.getByText("ProviderAuthError")).toBeInTheDocument();
    expect(
      screen.getByText(/authentication_error: invalid x-api-key/),
    ).toBeInTheDocument();
    // Retry sends the same input as a new run.
    expect(
      screen.getByRole("button", { name: /Retry message/ }),
    ).toBeInTheDocument();
  });

  it("lists sessions for reload reattach and opens new ones", async () => {
    let created = 0;
    server.use(
      http.post("/api/chat/hello/sessions", () => {
        created += 1;
        return HttpResponse.json(
          { ...chatSession, session_id: "s_01JXCHATSESSION02" },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderRoute("/projects/hello/chat");
    // The persisted session shows in the list (reattach after reload).
    expect(
      await screen.findByText(chatSession.session_id.slice(0, 16)),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /New session/ }));
    await waitFor(() => expect(created).toBe(1));
  });
});
