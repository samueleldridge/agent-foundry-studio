import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, qs } from "../client";
import type {
  EvalLaunchRequest,
  EvalRunRow,
  TaskInfo,
  TaskLaunched,
} from "../types";

export function useEvals(project?: string) {
  return useQuery({
    queryKey: ["evals", project ?? "all"],
    queryFn: () => apiGet<EvalRunRow[]>(`/api/evals${qs({ project })}`),
    refetchInterval: 15_000,
  });
}

/** Full per-case detail; shape is harness-defined (rendered generically). */
export interface EvalRunDetail extends Record<string, unknown> {
  eval_run_id: string;
  eval_name: string;
  score: number;
  threshold: number;
  passed: boolean;
  cases_total: number;
  cases_passed: number;
  cases_failed: number;
  duration_ms?: number;
  completed_at?: string;
  per_case?: EvalCase[];
}

export interface EvalCase extends Record<string, unknown> {
  case_id: string;
  status: string;
  score: number | null;
  pass: boolean | null;
  duration_ms?: number | null;
  cost_usd?: string | number | null;
  tokens?: number | null;
  actual_preview?: string | null;
  error?: string | null;
}

export function useEvalRun(evalRunId: string) {
  return useQuery({
    queryKey: ["evals", "detail", evalRunId],
    queryFn: () => apiGet<EvalRunDetail>(`/api/evals/${evalRunId}`),
  });
}

export function useLaunchEval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EvalLaunchRequest) =>
      apiPost<TaskLaunched>("/api/evals", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["evals"] });
    },
  });
}

export function useTask(taskId: string | null, poll = false) {
  return useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => apiGet<TaskInfo>(`/api/tasks/${taskId}`),
    enabled: taskId !== null,
    refetchInterval: poll ? 2_000 : false,
  });
}
