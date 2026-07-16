import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type { ForgeLaunchRequest, ForgeRunInfo } from "../types";

/** Launch response (`POST /api/forge`, 202). */
export interface ForgeLaunchResponse {
  forge_run_id: string;
  project: string;
  events_url: string;
}

export function useForgeRuns(project?: string) {
  return useQuery({
    queryKey: ["forge", project ?? "all"],
    queryFn: () => apiGet<ForgeRunInfo[]>(`/api/forge${qs({ project })}`),
    refetchInterval: 15_000,
  });
}

export function useForgeRun(forgeRunId: string | null, live: boolean) {
  return useQuery({
    queryKey: ["forge", "detail", forgeRunId],
    queryFn: () => apiGet<ForgeRunInfo>(`/api/forge/${forgeRunId}`),
    enabled: forgeRunId !== null,
    refetchInterval: live ? 5_000 : false,
  });
}

export function useLaunchForge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ForgeLaunchRequest) =>
      apiPost<ForgeLaunchResponse>("/api/forge", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forge"] });
    },
  });
}

export function useCancelForge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (forgeRunId: string) =>
      apiPost<{ forge_run_id: string; status: string }>(
        `/api/forge/${forgeRunId}/cancel`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forge"] });
    },
  });
}
