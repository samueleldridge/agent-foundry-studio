import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../client";
import type {
  ChatMessageResponse,
  ChatSessionInfo,
  ResumeRequest,
  ResumeResponse,
} from "../types";

export function useChatSessions(project: string | null) {
  return useQuery({
    queryKey: ["chat", project, "sessions"],
    queryFn: () =>
      apiGet<ChatSessionInfo[]>(`/api/chat/${project}/sessions`),
    enabled: project !== null && project !== "",
  });
}

export function useOpenChatSession(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<ChatSessionInfo>(`/api/chat/${project}/sessions`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chat", project, "sessions"] });
    },
  });
}

export function useSendChatMessage(project: string, sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiPost<ChatMessageResponse>(
        `/api/chat/${project}/sessions/${sessionId}/messages`,
        { text },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chat", project, "sessions"] });
      void qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

/**
 * Resolve an in-chat approval. Invalidates the approvals inbox so both
 * surfaces stay consistent (docs/72 § Chat UX).
 */
export function useResolveChatApproval(
  project: string,
  sessionId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ResumeRequest) =>
      apiPost<ResumeResponse>(
        `/api/chat/${project}/sessions/${sessionId}/approvals`,
        body,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
}
