import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, qs } from "../client";
import type {
  ArchiveReport,
  ArchiveRequest,
  GcReport,
  GcRequest,
  PinRequest,
  PinnedItem,
  StorageStats,
} from "../types";

export function useStorageStats() {
  return useQuery({
    queryKey: ["storage", "stats"],
    queryFn: () => apiGet<StorageStats>("/api/storage/stats"),
  });
}

export function usePins() {
  return useQuery({
    queryKey: ["storage", "pins"],
    queryFn: () => apiGet<PinnedItem[]>("/api/storage/pins"),
  });
}

export function useGc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GcRequest) => apiPost<GcReport>("/api/storage/gc", body),
    onSuccess: (report) => {
      if (!report.dry_run) {
        void qc.invalidateQueries({ queryKey: ["storage"] });
        void qc.invalidateQueries({ queryKey: ["runs"] });
      }
    },
  });
}

export function useArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ArchiveRequest) =>
      apiPost<ArchiveReport>("/api/storage/archive", body),
    onSuccess: (report) => {
      if (!report.dry_run) {
        void qc.invalidateQueries({ queryKey: ["storage"] });
      }
    },
  });
}

export function usePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PinRequest) =>
      apiPost<PinnedItem>("/api/storage/pins", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["storage", "pins"] });
    },
  });
}

export function useUnpin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { kind: string; artifact_id: string }) =>
      apiDelete<{ removed: boolean }>(
        `/api/storage/pins${qs({ kind: args.kind, artifact_id: args.artifact_id })}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["storage", "pins"] });
    },
  });
}
