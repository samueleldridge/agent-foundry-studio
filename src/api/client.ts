/**
 * Base fetch client for the studio control plane.
 *
 * - Optional bearer token (Settings screen / localStorage).
 * - Structured FoundryError envelope decode — every non-2xx response is
 *   raised as an ApiError carrying the envelope, never a bare string.
 */

const TOKEN_KEY = "foundry-studio-token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* best-effort */
  }
}

/** The FoundryError.to_dict() envelope (docs/70 § Failure modes). */
export interface FoundryErrorEnvelope {
  error_class: string;
  message: string;
  context: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly envelope: FoundryErrorEnvelope;
  /** Raw response payload — some 4xx bodies are typed results (e.g. a 422
   * save failure carries the ValidationResult itself, not an envelope). */
  readonly payload: unknown;

  constructor(status: number, envelope: FoundryErrorEnvelope, payload?: unknown) {
    super(envelope.message);
    this.name = "ApiError";
    this.status = status;
    this.envelope = envelope;
    this.payload = payload;
  }
}

function decodeEnvelope(status: number, body: unknown): FoundryErrorEnvelope {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    // FastAPI wraps handler payloads in {detail: ...}; the studio error
    // handler returns the envelope directly. Accept both.
    const inner =
      rec.detail && typeof rec.detail === "object"
        ? (rec.detail as Record<string, unknown>)
        : rec;
    if (typeof inner.error_class === "string" && typeof inner.message === "string") {
      return {
        error_class: inner.error_class,
        message: inner.message,
        context: (inner.context as Record<string, unknown>) ?? {},
      };
    }
    if (typeof rec.detail === "string") {
      return { error_class: `http_${status}`, message: rec.detail, context: {} };
    }
  }
  return {
    error_class: `http_${status}`,
    message: `Request failed with status ${status}`,
    context: {},
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, decodeEnvelope(res.status, payload), payload);
  }
  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}

/**
 * Encode a repo-relative file path for a URL, segment by segment.
 * (encodeURI leaves ?, #, % and friends alone — a path like
 * "evals/a#1.yaml" would silently truncate the request path.)
 */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Build a query string, skipping null/undefined/empty values. */
export function qs(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
