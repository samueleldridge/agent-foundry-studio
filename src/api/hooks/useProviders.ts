/**
 * Provider panel hooks (backend docs/72 § Provider panel).
 *
 * Key material only ever travels UP (PUT body); every response is
 * status-shaped — the backend never returns a stored key.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "../client";
import type {
  ProviderInfo,
  ProviderKeyStatus,
  ProviderKeyVerifyResult,
} from "../types";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => apiGet<ProviderInfo[]>("/api/providers"),
    staleTime: 60_000, // manifest-backed; changes only with a backend release
  });
}

export function useProviderKeys() {
  return useQuery({
    queryKey: ["providers", "keys"],
    queryFn: () => apiGet<ProviderKeyStatus[]>("/api/providers/keys"),
  });
}

export function useSaveProviderKey(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      apiPut<ProviderKeyStatus>(`/api/providers/${provider}/key`, {
        api_key: apiKey,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providers", "keys"] });
      // A key save can flip 424-unavailable projects back to healthy.
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProviderKey(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiDelete<ProviderKeyStatus>(`/api/providers/${provider}/key`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providers", "keys"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useVerifyProviderKey(provider: string) {
  return useMutation({
    mutationFn: () =>
      apiPost<ProviderKeyVerifyResult>(
        `/api/providers/${provider}/key/verify`,
      ),
  });
}
