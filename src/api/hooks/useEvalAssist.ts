/**
 * AI-assisted eval authoring (docs/72 § Eval assistant): two mutations —
 * clarifying questions, then a complete validated EvalSpec draft. The
 * draft NEVER touches disk server-side; saving is the explicit human act
 * through the existing config-write route (useSaveFile).
 */
import { useMutation } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost, encodePath } from "../client";
import type {
  EvalAssistDraftRequest,
  EvalAssistDraftResponse,
  EvalAssistQuestionsRequest,
  EvalAssistQuestionsResponse,
  FileContent,
} from "../types";

export function useAssistQuestions() {
  return useMutation({
    mutationFn: (body: EvalAssistQuestionsRequest) =>
      apiPost<EvalAssistQuestionsResponse>(
        "/api/evals/assist/questions",
        body,
      ),
  });
}

export function useAssistDraft() {
  return useMutation({
    mutationFn: (body: EvalAssistDraftRequest) =>
      apiPost<EvalAssistDraftResponse>("/api/evals/assist/draft", body),
  });
}

/**
 * The save target's current content hash, for the write route's
 * concurrent-edit guard: null when the file doesn't exist yet (fresh
 * save), the server hash when it does (e.g. overwriting the TODO
 * starter template).
 */
export async function fetchBaseHash(
  project: string,
  path: string,
): Promise<string | null> {
  try {
    const file = await apiGet<FileContent>(
      `/api/projects/${project}/files/${encodePath(path)}`,
    );
    return file.content_hash;
  } catch (err) {
    // Only "file doesn't exist yet" maps to a fresh-save null base_hash.
    // Anything else (auth failure, network, 500) must surface — treating
    // it as a fresh save would defeat the concurrent-edit guard.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
