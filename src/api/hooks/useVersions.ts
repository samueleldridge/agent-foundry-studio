import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type {
  DiffResponse,
  RollbackRequest,
  RollbackResponse,
  VersionsResponse,
} from "../types";

export function useVersions(project: string) {
  return useQuery({
    queryKey: ["projects", project, "versions"],
    queryFn: () =>
      apiGet<VersionsResponse>(`/api/projects/${project}/versions?tool=`),
  });
}

export function useDiff(
  project: string,
  ref1: string | null,
  ref2: string | null,
  path?: string,
) {
  return useQuery({
    queryKey: ["projects", project, "diff", ref1, ref2, path ?? ""],
    queryFn: () =>
      apiGet<DiffResponse>(
        `/api/projects/${project}/diff${qs({ ref1, ref2, path })}`,
      ),
    enabled: ref1 !== null && ref2 !== null,
  });
}

export function useRollback(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RollbackRequest) =>
      apiPost<RollbackResponse>(`/api/projects/${project}/rollback`, body),
    onSuccess: (data) => {
      if (!data.dry_run) {
        // A real rollback moves pins/files: refresh the project scope.
        void qc.invalidateQueries({ queryKey: ["projects", project] });
      }
    },
  });
}
