/**
 * Config-editor flow: server validation round-trip → issues panel + save
 * gating → commit toast. The CodeMirror wrapper is mocked with a textarea
 * here (its diagnostic mapping is unit-tested in code-editor.test.ts);
 * everything else — debounce, validate POST, 422/409 handling — is real.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import type { ValidationIssue } from "@/api/types";

vi.mock("@/components/CodeEditor", () => ({
  CodeEditor: ({
    value,
    onChange,
    readOnly,
    issues,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
    issues?: ValidationIssue[];
    "aria-label"?: string;
  }) => (
    <div>
      <textarea
        aria-label={ariaLabel ?? "editor"}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <div data-testid="inline-diagnostics">
        {(issues ?? []).map((i, n) => (
          <span key={n}>{`L${i.line}:C${i.column} ${i.message}`}</span>
        ))}
      </div>
    </div>
  ),
}));

const FILE_URL = "/projects/hello/configs?file=agents%2Fhello_agent%2Fagent.yaml";

async function openEditor() {
  renderRoute(FILE_URL);
  const editor = await screen.findByLabelText(
    "Editor for agents/hello_agent/agent.yaml",
  );
  return editor as HTMLTextAreaElement;
}

describe("config editor", () => {
  it("renders server validation errors inline and blocks save", async () => {
    const user = userEvent.setup();
    const editor = await openEditor();

    await user.clear(editor);
    await user.type(editor, "provider: anthropc");

    // Debounced validate round-trip renders the issue panel + inline marker —
    // the message legitimately appears in BOTH places.
    const messages = await screen.findAllByText(/unknown provider 'anthropc'/);
    expect(messages, "panel + inline diagnostic").toHaveLength(2);
    expect(screen.getByText(/\/model_binding\/provider/)).toBeInTheDocument();
    expect(screen.getByText(/line 3, col 13/)).toBeInTheDocument();
    expect(screen.getByText(/did you mean 'anthropic'\?/)).toBeInTheDocument();
    expect(
      screen.getByTestId("inline-diagnostics").textContent,
    ).toContain("L3:C13 unknown provider");

    expect(screen.getByRole("button", { name: "Save file" })).toBeDisabled();
  });

  it("saves valid content and shows the commit toast", async () => {
    const user = userEvent.setup();
    const editor = await openEditor();

    await user.type(editor, "\ndescription: greeting agent");
    expect(await screen.findByText(/Valid — schema/)).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save file" });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(await screen.findByText("Committed abc1234d")).toBeInTheDocument();
    expect(
      screen.getByText("studio(hello): edit agents/hello_agent/agent.yaml"),
    ).toBeInTheDocument();
  });

  it("surfaces the 409 stale-content flow instead of overwriting", async () => {
    server.use(
      http.put("/api/projects/hello/files/*", () =>
        HttpResponse.json(
          {
            error_class: "StaleContent",
            message: "changed since the editor loaded it",
            context: { server_content: "name: hello_agent # edited elsewhere" },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    const editor = await openEditor();

    await user.type(editor, "\ndescription: fresh edit");
    const save = screen.getByRole("button", { name: "Save file" });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(await screen.findByText("File changed on disk")).toBeInTheDocument();
    expect(
      screen.getByText(/name: hello_agent # edited elsewhere/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload server content" }),
    ).toBeInTheDocument();
  });
});
