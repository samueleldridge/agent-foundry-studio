import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "../client";
import type { LayoutsDocument } from "../types";

/**
 * Widget-dashboard layouts — server-persisted via `PUT /api/layouts`
 * (writes `<FOUNDRY_HOME>/studio/layouts.json`), never localStorage, so
 * boards survive browser resets and studio restarts (docs/72 § Layout
 * persistence).
 */
export function useLayouts() {
  return useQuery({
    queryKey: ["layouts"],
    queryFn: () => apiGet<LayoutsDocument>("/api/layouts"),
    staleTime: 60_000,
  });
}

export function useSaveLayouts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: LayoutsDocument) =>
      apiPut<LayoutsDocument>("/api/layouts", doc),
    onSuccess: (saved) => {
      qc.setQueryData(["layouts"], saved);
    },
  });
}
