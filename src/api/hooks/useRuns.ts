import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type {
  ApprovalItem,
  ResumeRequest,
  ResumeResponse,
  RunArtifactView,
  RunListItem,
} from "../types";

export function useRuns(filters: { project?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["runs", filters],
    queryFn: () => apiGet<RunListItem[]>(`/api/runs${qs({ ...filters })}`),
    refetchInterval: 15_000,
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: ["runs", "detail", runId],
    queryFn: () => apiGet<RunListItem>(`/api/runs/${runId}`),
  });
}

export function useRunArtifact(runId: string) {
  return useQuery({
    queryKey: ["runs", "detail", runId, "artifact"],
    queryFn: () => apiGet<RunArtifactView>(`/api/runs/${runId}/artifact`),
  });
}

export function useApprovals(project?: string) {
  return useQuery({
    queryKey: ["approvals", project ?? "all"],
    queryFn: () => apiGet<ApprovalItem[]>(`/api/approvals${qs({ project })}`),
    refetchInterval: 15_000,
  });
}

/**
 * Resolve a pending approval from the inbox (`POST /runs/{id}/resume`).
 * Invalidates every approvals query so the inbox and any open chat stay
 * consistent.
 */
export function useResumeRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, body }: { runId: string; body: ResumeRequest }) =>
      apiPost<ResumeResponse>(`/api/runs/${runId}/resume`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals"] });
      void qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
