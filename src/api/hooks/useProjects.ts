import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type {
  ProjectCreateResponse,
  ProjectDetail,
  ProjectSummary,
  TaskLaunched,
} from "../types";

export function useProjects(options: { includeBootstrap?: boolean } = {}) {
  const includeBootstrap = options.includeBootstrap ?? false;
  return useQuery({
    queryKey: ["projects", { includeBootstrap }],
    queryFn: () =>
      apiGet<ProjectSummary[]>(
        `/api/projects${qs({ include_bootstrap: includeBootstrap || null })}`,
      ),
  });
}

export function useProject(name: string) {
  return useQuery({
    queryKey: ["projects", name],
    queryFn: () => apiGet<ProjectDetail>(`/api/projects/${name}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiPost<ProjectCreateResponse>("/api/projects", { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useLaunchProjectTest() {
  return useMutation({
    mutationFn: (name: string) =>
      apiPost<TaskLaunched>(`/api/projects/${name}/test`),
  });
}
