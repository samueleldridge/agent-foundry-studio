import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../client";
import type { ConnectionHealthResponse, ConnectionInfo } from "../types";

export function useConnections(project: string) {
  return useQuery({
    queryKey: ["projects", project, "connections"],
    queryFn: () =>
      apiGet<ConnectionInfo[]>(`/api/projects/${project}/connections`),
  });
}

export function useConnectionHealth(project: string) {
  return useMutation({
    mutationFn: (conn: string) =>
      apiPost<ConnectionHealthResponse>(
        `/api/projects/${project}/connections/${conn}/health`,
      ),
  });
}

export function useConnectionRefresh(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conn: string) =>
      apiPost<{ connection: string; refreshed: boolean }>(
        `/api/projects/${project}/connections/${conn}/refresh`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["projects", project, "connections"],
      });
    },
  });
}
