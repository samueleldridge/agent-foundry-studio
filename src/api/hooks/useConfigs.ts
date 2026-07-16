import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "../client";
import type {
  FileContent,
  FileTree,
  ValidationResult,
} from "../types";

export function useFileTree(project: string) {
  return useQuery({
    queryKey: ["projects", project, "files"],
    queryFn: () => apiGet<FileTree>(`/api/projects/${project}/files`),
  });
}

export function useFileContent(project: string, path: string | null) {
  return useQuery({
    queryKey: ["projects", project, "files", path],
    queryFn: () =>
      apiGet<FileContent>(
        `/api/projects/${project}/files/${encodeURI(path ?? "")}`,
      ),
    enabled: path !== null,
  });
}

export function useValidate(project: string) {
  return useMutation({
    mutationFn: (body: { path: string; content: string }) =>
      apiPost<ValidationResult>(`/api/projects/${project}/validate`, body),
  });
}

/** PUT response (untyped in OpenAPI — mirrors studio schemas.WriteResult). */
export interface WriteResult {
  path: string;
  commit_sha: string;
  commit_message: string;
}

export function useSaveFile(project: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      path: string;
      content: string;
      base_hash: string | null;
    }) =>
      apiPut<WriteResult>(
        `/api/projects/${project}/files/${encodeURI(args.path)}`,
        { content: args.content, base_hash: args.base_hash },
      ),
    onSuccess: (_data, args) => {
      // A config save invalidates the narrowest affected keys:
      // that file, the project detail/graph, and the versions screen.
      void qc.invalidateQueries({
        queryKey: ["projects", project, "files", args.path],
      });
      void qc.invalidateQueries({ queryKey: ["projects", project] });
      void qc.invalidateQueries({
        queryKey: ["projects", project, "versions"],
      });
    },
  });
}
