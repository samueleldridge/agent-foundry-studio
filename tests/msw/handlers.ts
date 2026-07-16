/**
 * msw handlers for the studio control plane — test doubles only, never
 * shipped in the production bundle.
 */
import { http, HttpResponse } from "msw";
import * as fx from "./fixtures";

export const handlers = [
  http.get("/api/health", () =>
    HttpResponse.json({
      status: "ok",
      version: "0.1.0",
      uptime_s: 12.5,
      active_forge_runs: 0,
      active_chat_sessions: 0,
      run_manager_pool: 0,
    }),
  ),

  // Projects
  http.get("/api/projects", () => HttpResponse.json(fx.projects)),
  http.get("/api/projects/hello", () => HttpResponse.json(fx.projectDetail)),
  http.get("/api/projects/team_hello", () =>
    HttpResponse.json(fx.teamProjectDetail),
  ),

  // Configs
  http.get("/api/projects/hello/files", () => HttpResponse.json(fx.fileTree)),
  http.get("/api/projects/hello/files/*", () => HttpResponse.json(fx.agentYaml)),
  http.post("/api/projects/hello/validate", async ({ request }) => {
    const body = (await request.json()) as { content: string };
    return HttpResponse.json(
      body.content.includes("anthropc") ? fx.validationError : fx.validationOk,
    );
  }),
  http.put("/api/projects/hello/files/*", () =>
    HttpResponse.json({
      path: "agents/hello_agent/agent.yaml",
      commit_sha: "abc1234def5678900000000000000000000000000",
      commit_message: "studio(hello): edit agents/hello_agent/agent.yaml",
    }),
  ),

  // Catalog
  http.get("/api/catalog", () => HttpResponse.json(fx.catalogTools)),
  http.get("/api/catalog/tools/http_get_json", () =>
    HttpResponse.json(fx.catalogDetail),
  ),
  http.get("/api/catalog/tools/http_get_json/v2/files", () =>
    HttpResponse.json(fx.catalogFiles),
  ),

  // Doctor
  http.get("/api/doctor", () => HttpResponse.json(fx.doctorReport)),

  // Obs
  http.get("/api/obs/cost", () => HttpResponse.json(fx.obsCost)),
  http.get("/api/obs/latency", () => HttpResponse.json(fx.obsLatency)),
  http.get("/api/obs/tool-failures", () => HttpResponse.json({ rows: [] })),
  http.get("/api/obs/eval-trend", () => HttpResponse.json(fx.obsEvalTrend)),
  http.get("/api/obs/runs", () => HttpResponse.json(fx.obsRuns)),

  // Runs
  http.get("/api/runs", () => HttpResponse.json(fx.runs)),
  http.get("/api/runs/:runId", () => HttpResponse.json(fx.runs[0])),
  http.get("/api/runs/:runId/artifact", () => HttpResponse.json(fx.runArtifact)),
  http.get("/api/approvals", () => HttpResponse.json([])),

  // Evals
  http.get("/api/evals", () => HttpResponse.json(fx.evalRows)),
  http.get("/api/evals/:evalRunId", () => HttpResponse.json(fx.evalDetail)),
  http.post("/api/evals", () =>
    HttpResponse.json(
      { task_id: "task-123", events_url: "/api/tasks/task-123/events" },
      { status: 202 },
    ),
  ),
  http.get("/api/tasks/task-123", () =>
    HttpResponse.json({
      task_id: "task-123",
      kind: "eval",
      status: "completed",
      created_at: "2026-07-15T10:00:00Z",
      result: { eval_run_id: "01KXEPMRYRK96J6V51AHVV8W9F" },
      error: null,
    }),
  ),

  // Versions
  http.get("/api/projects/hello/versions", () => HttpResponse.json(fx.versions)),
  http.get("/api/projects/hello/diff", () =>
    HttpResponse.json({
      project: "hello",
      ref1: "aeda1505",
      ref2: "04221820",
      files: [
        {
          path: "projects/hello/agents/hello_agent/agent.yaml",
          hunks:
            "@@ -1,3 +1,3 @@\n name: hello_agent\n-  provider: openai\n+  provider: anthropic",
        },
      ],
    }),
  ),
  http.post("/api/projects/hello/rollback", async ({ request }) => {
    const body = (await request.json()) as { dry_run: boolean };
    return HttpResponse.json(body.dry_run ? fx.rollbackDryRun : fx.rollbackApplied);
  }),

  // Connections
  http.get("/api/projects/hello/connections", () =>
    HttpResponse.json(fx.connections),
  ),
  http.post("/api/projects/hello/connections/time_service/health", () =>
    HttpResponse.json(fx.connectionHealth),
  ),
  http.post("/api/projects/hello/connections/time_service/refresh", () =>
    HttpResponse.json({ connection: "time_service", refreshed: true }),
  ),

  // Storage
  http.get("/api/storage/stats", () => HttpResponse.json(fx.storageStats)),
  http.get("/api/storage/pins", () =>
    HttpResponse.json([
      { kind: "run", id: "01KXEPYAH7NH83JF9JZ6JMGRJV", reason: "demo", scope: "global" },
    ]),
  ),
  http.post("/api/storage/gc", async ({ request }) => {
    const body = (await request.json()) as { dry_run: boolean };
    return HttpResponse.json({
      kind: "run",
      dry_run: body.dry_run,
      candidates: body.dry_run ? ["01OLD"] : [],
      deleted: body.dry_run ? [] : ["01OLD"],
      skipped_pinned: ["01KXEPYAH7NH83JF9JZ6JMGRJV"],
      forced: false,
    });
  }),
  http.post("/api/storage/archive", async ({ request }) => {
    const body = (await request.json()) as { dry_run: boolean };
    return HttpResponse.json({
      kind: "run",
      dry_run: body.dry_run,
      archives: body.dry_run ? ["01OLD"] : [],
      archived: body.dry_run ? [] : ["01OLD"],
      skipped_pinned: [],
    });
  }),

  // --- Phase 10c: graph / chat / forge / layouts / approvals ----------------
  http.get("/api/projects/hello/graph", () => HttpResponse.json(fx.graphHello)),
  http.get("/api/projects/team_hello/graph", () =>
    HttpResponse.json(fx.graphTeamHello),
  ),

  http.get("/api/chat/:project/sessions", () => HttpResponse.json([fx.chatSession])),
  http.post("/api/chat/:project/sessions", () =>
    HttpResponse.json(fx.chatSession, { status: 201 }),
  ),
  http.post("/api/chat/:project/sessions/:sid/messages", () =>
    HttpResponse.json({
      session_id: fx.chatSession.session_id,
      run_id: "01KXCHATRUN01",
      events_url: fx.chatSession.events_url,
    }),
  ),
  http.post("/api/chat/:project/sessions/:sid/approvals", () =>
    HttpResponse.json({
      run_id: "01KXCHATRUN01",
      status: "resumed",
      events_url: "",
    }),
  ),

  http.get("/api/forge", () => HttpResponse.json([fx.forgeRunFinished])),
  http.get("/api/forge/:forgeRunId", () => HttpResponse.json(fx.forgeRunFinished)),
  http.post("/api/forge", () =>
    HttpResponse.json(
      {
        forge_run_id: "forge_01NEW",
        project: "hello",
        events_url: "/api/forge/forge_01NEW/events",
      },
      { status: 202 },
    ),
  ),
  http.post("/api/forge/:forgeRunId/cancel", ({ params }) =>
    HttpResponse.json({
      forge_run_id: String(params.forgeRunId),
      status: "cancelling",
    }),
  ),

  http.get("/api/layouts", () => HttpResponse.json(fx.layoutsEmpty)),
  http.put("/api/layouts", async ({ request }) =>
    HttpResponse.json(await request.json()),
  ),

  http.post("/api/runs/:runId/resume", ({ params }) =>
    HttpResponse.json({
      run_id: String(params.runId),
      status: "resumed",
      events_url: "",
    }),
  ),
];

/** A structured FoundryError envelope response, for error-path tests. */
export function errorResponse(status = 500) {
  return HttpResponse.json(fx.foundryError, { status });
}
