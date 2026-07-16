import { useQuery } from "@tanstack/react-query";
import { apiGet, qs } from "../client";
import type { ObsRows } from "../types";

export interface ObsFilters {
  project?: string;
  since?: string;
  by?: string;
  model?: string;
  tool?: string;
  status?: string;
}

const POLL_MS = 30_000;

export function useObsCost(filters: ObsFilters = {}) {
  return useQuery({
    queryKey: ["obs", "cost", filters],
    queryFn: () => apiGet<ObsRows>(`/api/obs/cost${qs({ ...filters })}`),
    refetchInterval: POLL_MS,
  });
}

export function useObsLatency(filters: ObsFilters = {}) {
  return useQuery({
    queryKey: ["obs", "latency", filters],
    queryFn: () => apiGet<ObsRows>(`/api/obs/latency${qs({ ...filters })}`),
    refetchInterval: POLL_MS,
  });
}

export function useObsToolFailures(filters: ObsFilters = {}) {
  return useQuery({
    queryKey: ["obs", "tool-failures", filters],
    queryFn: () =>
      apiGet<ObsRows>(`/api/obs/tool-failures${qs({ ...filters })}`),
    refetchInterval: POLL_MS,
  });
}

export function useObsEvalTrend(filters: ObsFilters = {}) {
  return useQuery({
    queryKey: ["obs", "eval-trend", filters],
    queryFn: () => apiGet<ObsRows>(`/api/obs/eval-trend${qs({ ...filters })}`),
    refetchInterval: POLL_MS,
  });
}

export function useObsRuns(filters: ObsFilters = {}) {
  return useQuery({
    queryKey: ["obs", "runs", filters],
    queryFn: () => apiGet<ObsRows>(`/api/obs/runs${qs({ ...filters })}`),
    refetchInterval: POLL_MS,
  });
}
