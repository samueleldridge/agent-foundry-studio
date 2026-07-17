import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";
import type { StudioHealth } from "../types";

/** Studio control-plane health — also carries launch-form defaults
 * (`forge_max_iter_default` = resolved FOUNDRY_FORGE_MAX_ITER, else 5). */
export function useStudioHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<StudioHealth>("/api/health"),
    staleTime: 60_000,
  });
}
