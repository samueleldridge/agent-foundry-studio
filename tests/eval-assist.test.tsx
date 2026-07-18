/**
 * AI-assisted eval wizard (docs/72 § Eval assistant): describe →
 * clarifying questions → draft → review (case table + validated YAML) →
 * explicit save through the EXISTING config-write route; regenerate with
 * tweaked answers; no-key blocked state.
 *
 * CodeMirror is mocked with a textarea (its diagnostic mapping is
 * unit-tested in code-editor.test.ts); everything else is real.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import {
  agentYaml,
  assistDraft,
  assistDraftYaml,
  providerKeys,
} from "./msw/fixtures";
import type { EvalAssistDraftRequest, ValidationIssue } from "@/api/types";

vi.mock("@/components/CodeEditor", () => ({
  CodeEditor: ({
    value,
    onChange,
    "aria-label": ariaLabel,
    issues,
  }: {
    value: string;
    onChange?: (v: string) => void;
    "aria-label"?: string;
    issues?: ValidationIssue[];
  }) => (
    <div>
      <textarea
        aria-label={ariaLabel ?? "editor"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <div data-testid="editor-issues">
        {(issues ?? []).map((i, n) => (
          <span key={n}>{i.message}</span>
        ))}
      </div>
    </div>
  ),
}));

async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  renderRoute("/projects/hello/evals");
  await user.click(
    await screen.findByRole("button", { name: /Draft with AI/ }),
  );

  // Step 1 — describe.
  await user.type(
    await screen.findByLabelText("What must the agent do?"),
    "Greet the caller by name.",
  );
  await user.click(
    screen.getByRole("button", { name: /Ask clarifying questions/ }),
  );

  // Step 2 — questions rendered as a skippable form, suggested answers
  // as placeholders.
  const first = await screen.findByLabelText(
    "What fields does the agent's input carry?",
  );
  expect(first).toHaveAttribute("placeholder", '{"name": "world"}');
  expect(
    screen.getByLabelText("Which edge cases matter?"),
  ).toHaveAttribute("placeholder", "(skip)");
  await user.type(first, '{{"name": "world"}');
  await user.click(screen.getByRole("button", { name: /Draft eval set/ }));

  // Step 3 — review.
  await screen.findByRole("button", { name: "Save eval set" });
}

describe("eval draft wizard", () => {
  it("walks describe → questions → draft → review with case table + yaml", async () => {
    const user = userEvent.setup();
    await walkToReview(user);

    // Case table with jump-to-line buttons for the drafted cases.
    expect(
      screen.getByRole("button", { name: "Jump to case plain_name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Jump to case unicode_name" }),
    ).toBeInTheDocument();
    // The YAML landed in the editor.
    expect(screen.getByLabelText("Drafted eval YAML")).toHaveValue(
      assistDraftYaml,
    );
    // Draft notes + human-ownership copy.
    expect(
      screen.getByText(/Check the unicode case's expected value/),
    ).toBeInTheDocument();
    expect(screen.getByText(/the eval is YOUR contract/)).toBeInTheDocument();
  });

  it("saves through the existing config-write route (commit-on-save)", async () => {
    const user = userEvent.setup();
    let putPath = "";
    let putBody: { content?: string; base_hash?: string | null } = {};
    server.use(
      http.put(
        "/api/projects/hello/files/*",
        async ({ request }) => {
          putPath = new URL(request.url).pathname;
          putBody = (await request.json()) as typeof putBody;
          return HttpResponse.json({
            path: "evals/hello.yaml",
            commit_sha: "abc1234def567890",
            commit_message: "studio(hello): edit evals/hello.yaml",
          });
        },
      ),
    );

    await walkToReview(user);
    await user.click(screen.getByRole("button", { name: "Save eval set" }));

    await waitFor(() =>
      expect(putPath).toBe("/api/projects/hello/files/evals/hello.yaml"),
    );
    expect(putBody.content).toBe(assistDraftYaml);
    // Concurrent-edit guard: the hash of the existing file rode along.
    expect(putBody.base_hash).toBe(agentYaml.content_hash);
    // Dialog closed after the commit.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save eval set" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("regenerates with tweaked answers", async () => {
    const user = userEvent.setup();
    const draftBodies: EvalAssistDraftRequest[] = [];
    server.use(
      http.post("/api/evals/assist/draft", async ({ request }) => {
        draftBodies.push(
          (await request.json()) as EvalAssistDraftRequest,
        );
        return HttpResponse.json(assistDraft);
      }),
    );

    await walkToReview(user);
    await user.click(
      screen.getByRole("button", { name: /Regenerate with tweaked answers/ }),
    );

    // Back on the questions step with prior answers intact.
    const first = await screen.findByLabelText(
      "What fields does the agent's input carry?",
    );
    expect(first).toHaveValue('{"name": "world"}');
    await user.type(
      screen.getByLabelText("Which edge cases matter?"),
      "empty name",
    );
    await user.click(screen.getByRole("button", { name: /Draft eval set/ }));
    await screen.findByRole("button", { name: "Save eval set" });

    expect(draftBodies).toHaveLength(2);
    const answers = Object.fromEntries(
      (draftBodies[1]!.answers ?? []).map((a) => [a.id, a.answer]),
    );
    expect(answers["edge_cases"]).toBe("empty name");
    expect(answers["input_shape"]).toBe('{"name": "world"}');
  });

  it("surfaces validation issues from the draft and blocks saving", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/evals/assist/draft", () =>
        HttpResponse.json({
          ...assistDraft,
          validation: {
            ok: false,
            kind: "eval",
            issues: [
              {
                severity: "error",
                message: "scorer weights must sum to 1.0 (docs/40); got 0.5",
                pointer: "/scorers",
                line: 12,
                column: null,
                hint: null,
              },
            ],
          },
        }),
      ),
    );

    await walkToReview(user);
    expect(
      screen.getAllByText(/scorer weights must sum to 1.0/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Save eval set" }),
    ).toBeDisabled();
  });

  it("opens from the forge new-project flow with the description prefilled", async () => {
    const user = userEvent.setup();
    renderRoute("/forge");

    await user.click(await screen.findByRole("tab", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "qa_bot");
    await user.click(screen.getByRole("button", { name: /Create project/ }));
    await screen.findByRole("button", { name: /Draft eval with AI/ });

    // The forge form's description feeds the wizard.
    await user.type(
      screen.getByLabelText("Description"),
      "Answer questions about tides.",
    );
    await user.click(
      screen.getByRole("button", { name: /Draft eval with AI/ }),
    );
    expect(
      await screen.findByLabelText("What must the agent do?"),
    ).toHaveValue("Answer questions about tides.");
    expect(
      screen.getByText(/Draft eval set with AI — qa_bot/),
    ).toBeInTheDocument();
  });

  it("blocks generation when no provider key is configured", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/providers/keys", () =>
        HttpResponse.json(
          providerKeys.map((k) => ({
            ...k,
            set: false,
            source: "unset",
            last4: null,
          })),
        ),
      ),
    );

    renderRoute("/projects/hello/evals");
    await user.click(
      await screen.findByRole("button", { name: /Draft with AI/ }),
    );
    await user.type(
      await screen.findByLabelText("What must the agent do?"),
      "Greet the caller.",
    );
    // Key-aware model field: the no-key copy renders and generation stays
    // blocked until a key exists (same pattern as the forge form).
    expect(
      await screen.findByText(/no provider API key configured/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ask clarifying questions/ }),
    ).toBeDisabled();
  });
});
