import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { ApiError, apiGet, qs } from "@/api/client";

describe("api client", () => {
  it("decodes the FoundryError envelope on non-2xx responses", async () => {
    server.use(
      http.get("/api/boom", () =>
        HttpResponse.json(
          {
            error_class: "SandboxViolation",
            message: "write outside projects/ refused",
            context: { path: "../../src/foundry/evil.py" },
          },
          { status: 403 },
        ),
      ),
    );
    const err = await apiGet("/api/boom").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(403);
    expect(apiErr.envelope.error_class).toBe("SandboxViolation");
    expect(apiErr.envelope.context.path).toBe("../../src/foundry/evil.py");
  });

  it("wraps FastAPI {detail: ...} envelopes too", async () => {
    server.use(
      http.get("/api/boom", () =>
        HttpResponse.json({ detail: "Not Found" }, { status: 404 }),
      ),
    );
    const err = (await apiGet("/api/boom").catch((e: unknown) => e)) as ApiError;
    expect(err.envelope.error_class).toBe("http_404");
    expect(err.envelope.message).toBe("Not Found");
  });

  it("keeps the raw payload for typed 4xx bodies (422 ValidationResult)", async () => {
    server.use(
      http.get("/api/boom", () =>
        HttpResponse.json(
          { ok: false, kind: "agent", issues: [] },
          { status: 422 },
        ),
      ),
    );
    const err = (await apiGet("/api/boom").catch((e: unknown) => e)) as ApiError;
    expect(err.payload).toEqual({ ok: false, kind: "agent", issues: [] });
  });

  it("builds query strings, skipping empty values", () => {
    expect(qs({ project: "hello", since: undefined, by: "" })).toBe(
      "?project=hello",
    );
    expect(qs({})).toBe("");
  });
});
