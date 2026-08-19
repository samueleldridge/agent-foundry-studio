import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { ApiError, apiGet, encodePath, qs } from "@/api/client";
import { fetchBaseHash } from "@/api/hooks/useEvalAssist";
import { agentYaml } from "./msw/fixtures";

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

  it("encodePath escapes per segment, keeping the slashes", () => {
    expect(encodePath("evals/hello.yaml")).toBe("evals/hello.yaml");
    // encodeURI would leave # and ? intact and truncate the request path.
    expect(encodePath("evals/a#1 draft?.yaml")).toBe(
      "evals/a%231%20draft%3F.yaml",
    );
  });
});

describe("fetchBaseHash", () => {
  it("returns the server hash when the file exists", async () => {
    await expect(fetchBaseHash("hello", "evals/hello.yaml")).resolves.toBe(
      agentYaml.content_hash,
    );
  });

  it("maps a 404 (fresh save) to a null base hash", async () => {
    server.use(
      http.get("/api/projects/hello/files/*", () =>
        HttpResponse.json(
          { error_class: "FileNotFound", message: "no such file", context: {} },
          { status: 404 },
        ),
      ),
    );
    await expect(
      fetchBaseHash("hello", "evals/new.yaml"),
    ).resolves.toBeNull();
  });

  it("rethrows non-404 failures instead of faking a fresh save", async () => {
    server.use(
      http.get("/api/projects/hello/files/*", () =>
        HttpResponse.json(
          { error_class: "StorageError", message: "disk on fire", context: {} },
          { status: 500 },
        ),
      ),
    );
    await expect(fetchBaseHash("hello", "evals/hello.yaml")).rejects.toThrow(
      "disk on fire",
    );
  });
});
