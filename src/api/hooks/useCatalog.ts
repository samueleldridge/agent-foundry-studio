import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type {
  CatalogArtifactDetail,
  CatalogEntry,
  CatalogFiles,
  DeprecateRequest,
  DeprecateResponse,
  PromoteRequest,
  PromoteResponse,
} from "../types";

export function useCatalog(kind: string) {
  return useQuery({
    queryKey: ["catalog", kind],
    queryFn: () => apiGet<CatalogEntry[]>(`/api/catalog${qs({ kind })}`),
  });
}

export function useCatalogArtifact(kind: string, name: string | null) {
  return useQuery({
    queryKey: ["catalog", kind, name],
    queryFn: () =>
      apiGet<CatalogArtifactDetail>(`/api/catalog/${kind}/${name}`),
    enabled: name !== null,
  });
}

export function useCatalogFiles(
  kind: string,
  name: string | null,
  version: string | null,
) {
  return useQuery({
    queryKey: ["catalog", kind, name, version, "files"],
    queryFn: () =>
      apiGet<CatalogFiles>(`/api/catalog/${kind}/${name}/${version}/files`),
    enabled: name !== null && version !== null,
  });
}

export function usePromote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PromoteRequest) =>
      apiPost<PromoteResponse>("/api/catalog/promote", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    },
  });
}

export function useDeprecate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeprecateRequest) =>
      apiPost<DeprecateResponse>("/api/catalog/deprecate", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    },
  });
}
