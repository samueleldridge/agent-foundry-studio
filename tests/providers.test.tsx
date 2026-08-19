/**
 * Providers panel: key card save/verify/clear flows, the manifest-backed
 * model browser table, stub cards, and error state. Key material only
 * travels UP — every asserted response is status-shaped.
 */
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ProviderKeyStatus } from "@/api/types";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { providerKeys } from "./msw/fixtures";
import { renderRoute } from "./utils";

function statefulKeyStore() {
  const statuses = new Map<string, ProviderKeyStatus>(
    providerKeys.map((row) => [row.provider, { ...row }]),
  );
  server.use(
    http.get("/api/providers/keys", () =>
      HttpResponse.json([...statuses.values()]),
    ),
    http.put("/api/providers/:name/key", async ({ params, request }) => {
      const body = (await request.json()) as { api_key: string };
      const provider = String(params.name);
      const status: ProviderKeyStatus = {
        provider,
        var_name: `${provider.toUpperCase()}_API_KEY`,
        set: true,
        source: "studio",
        last4: body.api_key.slice(-4),
      };
      statuses.set(provider, status);
      return HttpResponse.json(status);
    }),
    http.delete("/api/providers/:name/key", ({ params }) => {
      const provider = String(params.name);
      const status: ProviderKeyStatus = {
        provider,
        var_name: `${provider.toUpperCase()}_API_KEY`,
        set: false,
        source: "unset",
        last4: null,
      };
      statuses.set(provider, status);
      return HttpResponse.json(status);
    }),
  );
  return statuses;
}

describe("providers panel", () => {
  it("renders provider cards with the model browser table", async () => {
    renderRoute("/providers");

    expect(await screen.findByText("Anthropic")).toBeInTheDocument();
    // Model rows: id, context, output cap, capability chips, pricing,
    // reasoning badge.
    const row = screen
      .getByText("claude-sonnet-4-5")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("200,000")).toBeInTheDocument();
    expect(within(row).getByText("64,000")).toBeInTheDocument();
    expect(within(row).getByText("extended_thinking")).toBeInTheDocument();
    // Normalised currency: always ≥2 decimals ($3.00, not $3).
    expect(within(row).getByText(/\$3\.00 in · \$15\.00 out/)).toBeInTheDocument();
    expect(within(row).getByText("reasoning")).toBeInTheDocument();

    // Embedder card with the embedding-model table.
    expect(screen.getByText("Voyage AI")).toBeInTheDocument();
    const voyageRow = screen.getByText("voyage-3").closest("tr") as HTMLElement;
    expect(within(voyageRow).getByText("1024")).toBeInTheDocument();
    expect(within(voyageRow).getByText(/\$0\.06 in/)).toBeInTheDocument();

    // Stub card: explanation instead of a key panel.
    expect(screen.getByText("AWS Bedrock")).toBeInTheDocument();
    expect(screen.getByText(/AWS credential chain/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save AWS Bedrock key" }),
    ).not.toBeInTheDocument();

    // Key status: env-sourced vs unset. The env-sourced badge is a
    // POSITIVE (ok/green) state naming the env var — never a muted one
    // the operator could misread as "no key configured".
    const envBadge = screen.getByText("from environment · ANTHROPIC_API_KEY");
    expect(envBadge).toHaveClass("bg-ok/15", "text-ok");
    expect(
      screen.getByText(/loaded from the backend process env/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/e\.g\. the repo's \.env; manage it there/),
    ).toBeInTheDocument();
    expect(screen.getByText("no key")).toBeInTheDocument();
  });

  it("saves a key and reflects the studio-stored status with last4", async () => {
    statefulKeyStore();
    const user = userEvent.setup();
    renderRoute("/providers");

    await screen.findByText("Voyage AI");
    const input = screen.getByLabelText("Voyage AI API key");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "fake-voyage-key-wxyz");
    await user.click(screen.getByRole("button", { name: "Save Voyage AI key" }));

    expect(await screen.findByText(/studio key ·…wxyz/)).toBeInTheDocument();
    expect(input).toHaveValue(""); // draft cleared; never re-displayed
  });

  it("verifies a key and shows the inline result, including auth failure", async () => {
    const user = userEvent.setup();
    renderRoute("/providers");

    await screen.findByText("Anthropic");
    await user.click(screen.getByRole("button", { name: "Verify Anthropic key" }));
    expect(
      await screen.findByText(/credentials accepted \(HTTP 200\)/),
    ).toBeInTheDocument();

    server.use(
      http.post("/api/providers/anthropic/key/verify", () =>
        HttpResponse.json({
          provider: "anthropic",
          var_name: "ANTHROPIC_API_KEY",
          ok: false,
          status_code: 401,
          detail: "Anthropic rejected the key (HTTP 401)",
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Verify Anthropic key" }));
    expect(
      await screen.findByText("Anthropic rejected the key (HTTP 401)"),
    ).toBeInTheDocument();
  });

  it("clears a studio-stored key; env-sourced keys cannot be cleared", async () => {
    const statuses = statefulKeyStore();
    statuses.set("voyage", {
      provider: "voyage",
      var_name: "VOYAGE_API_KEY",
      set: true,
      source: "studio",
      last4: "wxyz",
    });
    const user = userEvent.setup();
    renderRoute("/providers");

    expect(await screen.findByText(/studio key ·…wxyz/)).toBeInTheDocument();
    // Env-sourced keys are managed outside the studio.
    expect(
      screen.getByRole("button", { name: "Clear Anthropic key" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/loaded from the backend process env/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Voyage AI key" }));
    const voyageCard = screen
      .getByText("Voyage AI")
      .closest('[data-slot="provider-card"]') as HTMLElement;
    expect(await within(voyageCard).findByText("no key")).toBeInTheDocument();
  });

  it("renders the error envelope when the provider list fails", async () => {
    server.use(http.get("/api/providers", () => errorResponse(500)));
    renderRoute("/providers");
    expect(
      await screen.findByText("Could not load providers"),
    ).toBeInTheDocument();
  });
});
