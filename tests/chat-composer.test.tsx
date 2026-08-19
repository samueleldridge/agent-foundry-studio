/**
 * Schema-aware chat composer (docs/72 § Chat UX): a two-required-field
 * project (team_hello shape) gets a per-field form that assembles the
 * input object client-side + an edit-as-JSON toggle; a single-field
 * project (hello shape) keeps the plain message box naming the field.
 * Nobody is told to hand-write JSON.
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { teamChatSession } from "./msw/fixtures";

function useTeamSessions(): { body: () => unknown } {
  let captured: unknown = null;
  server.use(
    http.get("/api/chat/team_hello/sessions", () =>
      HttpResponse.json([teamChatSession]),
    ),
    http.post(
      "/api/chat/team_hello/sessions/:sid/messages",
      async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({
          session_id: teamChatSession.session_id,
          run_id: "01KXTEAMRUN01",
          events_url: teamChatSession.events_url,
        });
      },
    ),
  );
  return { body: () => captured };
}

describe("schema-aware chat composer", () => {
  it("renders a per-field form for a two-required-field project and assembles the input object", async () => {
    const sent = useTeamSessions();
    const user = userEvent.setup();
    renderRoute("/projects/team_hello/chat");

    const requestInput = await screen.findByRole("textbox", {
      name: "request",
    });
    const audienceInput = screen.getByRole("textbox", { name: "audience" });
    // The free-text box (which would demand JSON) is gone.
    expect(
      screen.queryByRole("textbox", { name: "Chat message" }),
    ).not.toBeInTheDocument();

    // Send stays disabled until every required field is filled.
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
    await user.type(requestInput, "the release shipping");
    expect(sendButton).toBeDisabled();
    await user.type(audienceInput, "the team");
    expect(sendButton).toBeEnabled();

    await user.click(sendButton);
    await waitFor(() => expect(sent.body()).not.toBeNull());
    const { text } = sent.body() as { text: string };
    expect(JSON.parse(text)).toEqual({
      request: "the release shipping",
      audience: "the team",
    });
  });

  it("toggles to an editable JSON view (prefilled template) and back to the form", async () => {
    const sent = useTeamSessions();
    const user = userEvent.setup();
    renderRoute("/projects/team_hello/chat");

    await screen.findByRole("textbox", { name: "request" });
    await user.click(screen.getByRole("button", { name: "Edit as JSON" }));

    const jsonBox = screen.getByRole("textbox", {
      name: "Chat message JSON",
    }) as HTMLTextAreaElement;
    // Prefilled with the required-field template.
    expect(JSON.parse(jsonBox.value)).toEqual({ request: "", audience: "" });

    await user.clear(jsonBox);
    await user.click(jsonBox);
    await user.paste('{"request": "ship it", "audience": "everyone"}');
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sent.body()).not.toBeNull());
    const { text } = sent.body() as { text: string };
    expect(JSON.parse(text)).toEqual({
      request: "ship it",
      audience: "everyone",
    });

    // Power-user escape hatch is reversible.
    await user.click(screen.getByRole("button", { name: "Back to form" }));
    expect(
      screen.getByRole("textbox", { name: "request" }),
    ).toBeInTheDocument();
  });

  it("carries JSON edits back into the form (Back to form never discards them)", async () => {
    useTeamSessions();
    const user = userEvent.setup();
    renderRoute("/projects/team_hello/chat");

    await screen.findByRole("textbox", { name: "request" });
    await user.click(screen.getByRole("button", { name: "Edit as JSON" }));
    const jsonBox = screen.getByRole("textbox", { name: "Chat message JSON" });
    await user.clear(jsonBox);
    await user.click(jsonBox);
    await user.paste('{"request": "ship it", "audience": "everyone"}');

    await user.click(screen.getByRole("button", { name: "Back to form" }));
    // The JSON edits landed in the per-field inputs.
    expect(screen.getByRole("textbox", { name: "request" })).toHaveValue(
      "ship it",
    );
    expect(screen.getByRole("textbox", { name: "audience" })).toHaveValue(
      "everyone",
    );
  });

  it("refuses to leave JSON mode on invalid JSON, showing an inline error", async () => {
    useTeamSessions();
    const user = userEvent.setup();
    renderRoute("/projects/team_hello/chat");

    await screen.findByRole("textbox", { name: "request" });
    await user.click(screen.getByRole("button", { name: "Edit as JSON" }));
    const jsonBox = screen.getByRole("textbox", { name: "Chat message JSON" });
    await user.clear(jsonBox);
    await user.click(jsonBox);
    await user.paste('{"request": "ship it", broken');

    await user.click(screen.getByRole("button", { name: "Back to form" }));
    // Still in JSON mode, edits intact, inline parse error shown.
    expect(
      screen.getByRole("textbox", { name: "Chat message JSON" }),
    ).toHaveValue('{"request": "ship it", broken');
    expect(
      document.querySelector('[data-slot="composer-form-error"]'),
    ).toHaveTextContent(/JSON is invalid/);
    expect(
      screen.queryByRole("textbox", { name: "request" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the plain message box for a single-required-field project, naming the field", async () => {
    renderRoute("/projects/hello/chat");
    const box = await screen.findByRole("textbox", { name: "Chat message" });
    expect(box).toHaveAttribute("placeholder", "name… (Enter to send)");
    // No form, no JSON toggle for the simple shape.
    expect(
      screen.queryByRole("button", { name: "Edit as JSON" }),
    ).not.toBeInTheDocument();
  });
});
