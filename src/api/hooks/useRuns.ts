import { useQuery } from "@tanstack/react-query";
import { apiGet, qs } from "../client";
import type { ApprovalItem, RunArtifactView, RunListItem } from "../types";

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
