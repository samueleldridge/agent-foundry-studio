/**
 * Forge launch form — key-aware model dropdown: chat models grouped by
 * provider, keyed-provider filtering, default meta binding, no-keys
 * empty state, and the "Advanced: custom model" escape hatch. The wire
 * shape stays "<provider>/<model>".
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { forgeRunRunning, providers } from "./msw/fixtures";
import type { ProviderInfo, ProviderKeyStatus } from "@/api/types";

const openaiProvider: ProviderInfo = {
  name: "openai",
  label: "OpenAI",
  kind: "llm",
  stub: false,
  note: "",
  credentials_env: "OPENAI_API_KEY",
  models: [
    {
      id: "gpt-5-mini",
      context_window: 400000,
      max_output_tokens: 128000,
      capabilities: ["tool_use", "vision"],
      reasoning: true,
      pricing: {
        input_per_1m: 0.25,
        output_per_1m: 2.0,
        cache_read_per_1m: 0.025,
        cache_write_per_1m: 0,
      },
    },
    {
      id: "gpt-5",
      context_window: 400000,
      max_output_tokens: 128000,
      capabilities: ["tool_use", "vision"],
      reasoning: true,
      pricing: {
        input_per_1m: 1.25,
        output_per_1m: 10.0,
        cache_read_per_1m: 0.125,
        cache_write_per_1m: 0,
      },
    },
  ],
  // Embedding models must NOT appear in the chat-model dropdown.
  embedding_models: [
    {
      id: "text-embedding-4",
      dimensions: 1536,
      max_input_tokens: 8192,
      max_batch_size: 2048,
      input_per_1m: 0.02,
    },
  ],
};

function keyStatus(
  provider: string,
  source: ProviderKeyStatus["source"],
): ProviderKeyStatus {
  return {
    provider,
    var_name: `${provider.toUpperCase()}_API_KEY`,
    set: source !== "unset",
    source,
    last4: null,
  };
}

/** anthropic fixture (2 chat models) + openai; key status per test. */
function useProviderOverrides(keys: ProviderKeyStatus[]) {
  server.use(
    http.get("/api/providers", () =>
      HttpResponse.json([providers[0], openaiProvider]),
    ),
    http.get("/api/providers/keys", () => HttpResponse.json(keys)),
  );
}

async function openModelSelect(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole("combobox", {
    name: "Meta-agent model",
  });
  await user.click(trigger);
  return trigger;
}

describe("forge model select", () => {
  it("disables providers without a key and links their group to /providers", async () => {
    useProviderOverrides([
      keyStatus("openai", "environment"),
      keyStatus("anthropic", "unset"),
    ]);
    const user = userEvent.setup();
    renderRoute("/forge");

    await openModelSelect(user);

    // Keyed provider: selectable, with reasoning + context-window chips.
    const mini = await screen.findByRole("option", { name: /gpt-5-mini/ });
    expect(mini).not.toHaveAttribute("data-disabled");
    expect(within(mini).getByText("reasoning")).toBeInTheDocument();
    expect(within(mini).getByText("400k ctx")).toBeInTheDocument();

    // Unkeyed provider: options greyed out, group affixed with the link.
    const sonnet = screen.getByRole("option", { name: /claude-sonnet-4-5/ });
    expect(sonnet).toHaveAttribute("data-disabled");
    expect(screen.getByText(/no key —/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "add in Providers" }),
    ).toHaveAttribute("href", "/providers");

    // Chat models only — the embedding model never shows up.
    expect(
      screen.queryByRole("option", { name: /text-embedding-4/ }),
    ).not.toBeInTheDocument();
  });

  it("preselects the backend default meta binding when its key is set", async () => {
    // anthropic comes FIRST in the manifest and is also keyed — the
    // default must still be openai/gpt-5-mini, not the first group.
    useProviderOverrides([
      keyStatus("anthropic", "environment"),
      keyStatus("openai", "studio"),
    ]);
    renderRoute("/forge");

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Meta-agent model" }),
      ).toHaveTextContent("gpt-5-mini"),
    );
  });

  it("falls back to the first available model when the default binding has no key", async () => {
    useProviderOverrides([
      keyStatus("anthropic", "environment"),
      keyStatus("openai", "unset"),
    ]);
    renderRoute("/forge");

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Meta-agent model" }),
      ).toHaveTextContent("claude-sonnet-4-5"),
    );
  });

  it("shows an empty state and blocks launch when no provider has a key", async () => {
    useProviderOverrides([
      keyStatus("anthropic", "unset"),
      keyStatus("openai", "unset"),
    ]);
    const user = userEvent.setup();
    renderRoute("/forge");

    // Clear blocking copy + disabled launch, without opening anything.
    expect(
      await screen.findByText(/Launch is blocked: no provider API key/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Launch forge/ }),
    ).toBeDisabled();

    // The dropdown itself carries an empty-state row linking to Providers.
    await openModelSelect(user);
    expect(
      screen.getByText(/no model can be used/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add a key in Providers" }),
    ).toHaveAttribute("href", "/providers");
  });

  it("round-trips the custom-model escape hatch and submits the raw string", async () => {
    let launchBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/forge", async ({ request }) => {
        launchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            forge_run_id: "forge_01NEW",
            project: "hello",
            events_url: "/api/forge/forge_01NEW/events",
          },
          { status: 202 },
        );
      }),
      http.get("/api/forge/forge_01NEW", () =>
        HttpResponse.json({ ...forgeRunRunning, forge_run_id: "forge_01NEW" }),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/forge");

    // Dropdown (with its default) → custom input.
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Meta-agent model" }),
      ).toHaveTextContent("claude-sonnet-4-5"),
    );
    await user.click(
      screen.getByRole("button", { name: "Advanced: custom model" }),
    );
    const custom = screen.getByLabelText("Meta-agent model");
    expect(custom).toHaveAttribute("id", "forge-model-custom");
    await user.type(custom, "example_corp/frontier-x1");

    // Back to the list: default selection intact, dropdown restored.
    await user.click(screen.getByRole("button", { name: "Back to model list" }));
    expect(
      screen.getByRole("combobox", { name: "Meta-agent model" }),
    ).toHaveTextContent("claude-sonnet-4-5");

    // Forward again: the typed custom value round-trips.
    await user.click(
      screen.getByRole("button", { name: "Advanced: custom model" }),
    );
    expect(screen.getByLabelText("Meta-agent model")).toHaveValue(
      "example_corp/frontier-x1",
    );

    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "hello" }));
    await user.type(screen.getByLabelText("Eval set path"), "evals/e.yaml");
    await user.type(screen.getByLabelText("Description"), "x");
    await user.click(screen.getByRole("button", { name: /Launch forge/ }));

    await waitFor(() =>
      expect(launchBody).toMatchObject({ model: "example_corp/frontier-x1" }),
    );
  });

  it("submits the picked model as the '<provider>/<model>' wire string", async () => {
    let launchBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/forge", async ({ request }) => {
        launchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            forge_run_id: "forge_01NEW",
            project: "hello",
            events_url: "/api/forge/forge_01NEW/events",
          },
          { status: 202 },
        );
      }),
      http.get("/api/forge/forge_01NEW", () =>
        HttpResponse.json({ ...forgeRunRunning, forge_run_id: "forge_01NEW" }),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/forge");

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "hello" }));
    await user.type(screen.getByLabelText("Eval set path"), "evals/e.yaml");
    await user.type(screen.getByLabelText("Description"), "x");

    await openModelSelect(user);
    await user.click(
      await screen.findByRole("option", { name: /claude-haiku-4-5/ }),
    );
    expect(
      screen.getByRole("combobox", { name: "Meta-agent model" }),
    ).toHaveTextContent("claude-haiku-4-5");

    await user.click(screen.getByRole("button", { name: /Launch forge/ }));
    await waitFor(() =>
      expect(launchBody).toMatchObject({ model: "anthropic/claude-haiku-4-5" }),
    );
  });
});
