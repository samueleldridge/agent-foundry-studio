/**
 * Fixture payloads mirroring the real studio API responses (sampled from a
 * live Phase 10a control plane).
 */
import type { GraphExport } from "@/api/graph";
import type {
  CatalogArtifactDetail,
  CatalogEntry,
  CatalogFiles,
  ChatSessionInfo,
  ConnectionInfo,
  DoctorReport,
  EvalRunRow,
  FileContent,
  FileTree,
  ForgeRunInfo,
  LayoutsDocument,
  ProjectDetail,
  ProjectSummary,
  ProviderInfo,
  ProviderKeyStatus,
  RunArtifactView,
  RunListItem,
  StorageStats,
  ValidationResult,
  VersionsResponse,
} from "@/api/types";

export const projects: ProjectSummary[] = [
  {
    name: "hello",
    branch: "main",
    agent_count: 1,
    tool_count: 1,
    last_commit: "04221820",
    last_commit_subject: "revert(examples): restore anthropic default",
    last_eval_score: 1.0,
    healthy: true,
    health_detail: "config loads",
    bootstrap: false,
  },
  {
    name: "team_hello",
    branch: "main",
    agent_count: 3,
    tool_count: 1,
    last_commit: "04221820",
    last_commit_subject: "revert(examples): restore anthropic default",
    last_eval_score: null,
    healthy: true,
    health_detail: "config loads",
    bootstrap: false,
  },
];

export const projectCreated = {
  name: "qa_bot",
  branch: "foundry/qa_bot",
  project_dir: "/repo/projects/qa_bot",
  eval_path: "evals/qa_bot.yaml",
  eval_repo_path: "projects/qa_bot/evals/qa_bot.yaml",
  files: ["README.md", "evals/qa_bot.yaml"],
};

export const projectDetail: ProjectDetail = {
  name: "hello",
  description: "Trivial single-agent system that greets the caller.",
  flow_pattern: "single",
  agents: [
    {
      name: "hello_agent",
      model_binding: "anthropic/claude-haiku-4-5",
      prompt_version: "v2",
      tools: ["catalog/http_get_json@v1"],
      state_read: ["name"],
      state_write: ["greeting"],
    },
  ],
  functions: [],
  tools: { get_time: "catalog/http_get_json@v1" },
  connections: { time_service: "catalog/http_service@v1" },
  guardrails: { max_iterations: 5, max_hops: 20, max_cost_usd: null },
  system_version: "e9ce9a8ffe752b9e",
};

export const fileTree: FileTree = {
  project: "hello",
  files: [
    { path: "agents/hello_agent/agent.yaml", kind: "agent", editable: true },
    { path: "agents/hello_agent/prompts/v2.md", kind: "prompt", editable: true },
    { path: "system.yaml", kind: "system", editable: true },
    { path: "state.yaml", kind: "state", editable: true },
  ],
};

export const agentYaml: FileContent = {
  path: "agents/hello_agent/agent.yaml",
  kind: "agent",
  content:
    "name: hello_agent\nmodel_binding:\n  provider: anthropic\n  model: claude-haiku-4-5\n",
  content_hash: "c4cd5aed9424bf0d",
  schema_url: "/api/schemas/agent",
  editable: true,
};

export const validationError: ValidationResult = {
  ok: false,
  kind: "agent",
  issues: [
    {
      severity: "error",
      message: "unknown provider 'anthropc'; available: anthropic, openai",
      pointer: "/model_binding/provider",
      line: 3,
      column: 13,
      hint: "did you mean 'anthropic'?",
    },
  ],
};

export const validationOk: ValidationResult = {
  ok: true,
  kind: "agent",
  issues: [],
};

export const doctorReport: DoctorReport = {
  ok: false,
  checks: [
    { check: "framework", status: "ok", detail: "foundry 1.0.0 importable", remedy: null },
    { check: "python", status: "ok", detail: "Python 3.12.13 (>= 3.12)", remedy: null },
    {
      check: "provider:anthropic",
      status: "warn",
      detail: "ANTHROPIC_API_KEY unset",
      remedy: "export ANTHROPIC_API_KEY",
    },
    { check: "config:hello", status: "fail", detail: "agent.yaml invalid", remedy: null },
  ],
};

export const catalogTools: CatalogEntry[] = [
  { name: "http_get_json", kind: "tool", versions: ["v1", "v2"], latest: "v2", root: "/repo/catalog" },
  { name: "word_count", kind: "tool", versions: ["v1"], latest: "v1", root: "/repo/catalog" },
];

export const catalogDetail: CatalogArtifactDetail = {
  name: "http_get_json",
  kind: "tool",
  versions: [
    {
      version: "v2",
      created_at: "2026-07-01T10:00:00Z",
      created_by: "human",
      eval_score: 0.98,
      eval_run_id: null,
      notes: "adds retry",
      deprecated: false,
      deprecation_reason: null,
      schema_change: null,
    },
    {
      version: "v1",
      created_at: "2026-06-01T10:00:00Z",
      created_by: "human",
      eval_score: 0.95,
      eval_run_id: null,
      notes: null,
      deprecated: true,
      deprecation_reason: "superseded by v2",
      schema_change: null,
    },
  ],
};

export const catalogFiles: CatalogFiles = {
  ref: "catalog/http_get_json",
  version: "v2",
  files: [
    { path: "tool.yaml", content: "name: http_get_json\nversion: v2\n" },
    { path: "handler.py", content: "def handler():\n    return {}\n" },
  ],
};

export const obsCost = {
  rows: [
    { bucket: "2026-07-12", calls: 40, input_tokens: 4000, output_tokens: 400, cost_usd: 0.08 },
    { bucket: "2026-07-13", calls: 119, input_tokens: 1024181, output_tokens: 8113, cost_usd: 0.232434 },
  ],
};

export const obsLatency = {
  rows: [
    { provider: "anthropic", model: "claude-haiku-4-5", calls: 119, p50_ms: 1392, p95_ms: 2718 },
  ],
};

export const obsEvalTrend = {
  rows: [
    {
      eval_run_id: "01KXEPMRYRK96J6V51AHVV8W9F",
      project: "hello",
      eval_name: "hello_greeting",
      target_ref: "hello",
      score: 1.0,
      threshold: 0.9,
      passed: 1,
      cases_total: 5,
      cases_passed: 5,
      completed_at: "2026-07-13T21:38:05.412824+00:00",
    },
  ],
};

export const obsRuns = {
  rows: [
    {
      run_id: "01KXEPYAH7NH83JF9JZ6JMGRJV",
      project: "hello",
      status: "success",
      started_at: "2026-07-13T21:43:14.222112+00:00",
      completed_at: "2026-07-13T21:43:16.478771+00:00",
      total_input_tokens: 1027,
      total_output_tokens: 41,
      total_cost_usd: 0.00017865,
      duration_ms: 2263,
    },
  ],
};

export const runs: RunListItem[] = [
  {
    run_id: "01KXEPYAH7NH83JF9JZ6JMGRJV",
    project: "hello",
    status: "completed",
    started_at: "2026-07-13T21:43:14.222112+00:00",
    completed_at: "2026-07-13T21:43:16.478771+00:00",
    total_cost_usd: 0.00017865,
    total_tokens: 1068,
    error_class: null,
  },
  {
    run_id: "01KXEQRP5SMP7RDFGZF5TW77JB",
    project: "hello",
    status: "failed",
    started_at: "2026-07-13T21:57:38.254529+00:00",
    completed_at: "2026-07-13T21:59:14.497576+00:00",
    total_cost_usd: null,
    total_tokens: 0,
    error_class: "ProviderAuthError",
  },
];

export const runArtifact: RunArtifactView = {
  run_id: "01KXEPYAH7NH83JF9JZ6JMGRJV",
  metadata: { project: "hello" },
  inputs: { name: "world" },
  outputs: { greeting: "Hello, world!" },
  state_transitions: [{ field: "greeting", node: "hello_agent" }],
  llm_calls: [{ model: "claude-haiku-4-5", tokens: 1068 }],
  tool_calls: [{ tool: "get_time", duration_ms: 120 }],
  event_count: 14,
};

export const evalRows: EvalRunRow[] = [
  {
    eval_run_id: "01KXEPMRYRK96J6V51AHVV8W9F",
    eval_name: "hello_greeting",
    project: "hello",
    target_ref: "hello",
    target_version: "",
    score: 1.0,
    threshold: 0.9,
    passed: true,
    completed_at: "2026-07-13T21:38:05.412824+00:00",
  },
];

export const evalDetail = {
  eval_run_id: "01KXEPMRYRK96J6V51AHVV8W9F",
  eval_name: "hello_greeting",
  scope: "project",
  score: 1.0,
  threshold: 0.9,
  passed: true,
  cases_total: 5,
  cases_passed: 5,
  cases_failed: 0,
  duration_ms: 4107,
  completed_at: "2026-07-13T21:38:05.412824Z",
  per_case: [
    {
      case_id: "plain_name",
      status: "scored",
      score: 1.0,
      pass: true,
      duration_ms: 2184,
      cost_usd: "0.00017925",
      tokens: 1069,
      actual_preview: '{"greeting": "Hello, world!"}',
      error: null,
    },
  ],
};

export const versions: VersionsResponse = {
  project: "hello",
  branch: "main",
  commits: [
    {
      sha: "0422182068527e9fc4868217525a3940fddb87ed",
      short_sha: "04221820",
      author: "Sam",
      date: "2026-07-13T23:20:56+01:00",
      subject: "revert(examples): restore anthropic default",
    },
    {
      sha: "aeda1505de28ce0bc82351d12203821986be82d2",
      short_sha: "aeda1505",
      author: "Sam",
      date: "2026-07-13T22:48:39+01:00",
      subject: "chore(examples): point hello at local models",
    },
  ],
  prompts: [
    {
      name: "hello_agent",
      kind: "prompt",
      ref: "",
      versions: ["v1", "v2"],
      pinned: "v2",
      latest_unpinned: null,
    },
  ],
  tools: [
    {
      name: "get_time",
      kind: "tool",
      ref: "catalog/http_get_json",
      versions: ["v1", "v2"],
      pinned: "v1",
      latest_unpinned: "v2",
    },
  ],
  connections: [],
};

export const rollbackDryRun = {
  granularity: "tool",
  target: "get_time",
  dry_run: true,
  plan: "pin get_time: v1 -> v2 (single-file change to system.yaml)",
  checks: [
    { name: "clean_tree", ok: true, detail: "working tree clean", bypass: "" },
    { name: "pin_exists", ok: true, detail: "v2 present in catalog", bypass: "" },
  ],
  commit_sha: null,
  audit_entry_id: null,
  overrides_used: [],
  notes: ["dry run: nothing written"],
};

export const rollbackApplied = {
  ...rollbackDryRun,
  dry_run: false,
  commit_sha: "feedc0dedeadbeeffeedc0dedeadbeeffeedc0de",
  audit_entry_id: "audit-1",
  notes: [],
};

export const connections: ConnectionInfo[] = [
  {
    name: "time_service",
    ref: "http_service",
    version: "v1",
    auth_scheme: "api_key",
    principal: null,
    redacted_config: {
      base_url: "https://worldtimeapi.org",
      timeout_s: 10.0,
      health_path: "/api/ip",
    },
  },
];

export const connectionHealth = {
  connection: "time_service",
  ref: "http_service",
  ok: true,
  checked_at: "2026-07-15T10:00:00Z",
  cases: [
    { case_id: "reach", ok: true, latency_ms: 143, message: "200 OK" },
  ],
};

export const storageStats: StorageStats = {
  foundry_home: "/Users/sam/.foundry",
  kinds: [
    { kind: "runs", items: 8, bytes: 4601088 },
    { kind: "archives", items: 0, bytes: 0 },
    { kind: "observability.db", items: 1, bytes: 106496 },
  ],
};

export const foundryError = {
  error_class: "ProjectNotFound",
  message: "project 'nope' does not exist under projects/",
  context: { project: "nope" },
};

// --- Phase 10c fixtures --------------------------------------------------------

/** hello — the single-agent shape (start → agent → end). */
export const graphHello: GraphExport = {
  project: "hello",
  system_version: "e9ce9a8ffe752b9e",
  pattern: "single",
  primary_agent: "hello_agent",
  nodes: [
    { id: "__start__", kind: "start", role: null, label: "start", group: null, agent: null, function: null },
    {
      id: "hello_agent",
      kind: "agent",
      role: "single",
      label: "hello_agent",
      group: null,
      agent: {
        model_binding: "anthropic/claude-haiku-4-5",
        prompt_version: "v2",
        tools: ["catalog/http_get_json@v1"],
        state_read: ["name"],
        state_write: ["greeting"],
      },
      function: null,
    },
    { id: "__end__", kind: "end", role: null, label: "end", group: null, agent: null, function: null },
  ],
  edges: [
    { id: "e0", source: "__start__", target: "hello_agent", kind: "sequential", label: null, bidirectional: false },
    { id: "e1", source: "hello_agent", target: "__end__", kind: "sequential", label: null, bidirectional: false },
  ],
  groups: [],
};

/** team_hello — supervisor + two workers (docs/72 worked example). */
export const graphTeamHello: GraphExport = {
  project: "team_hello",
  system_version: "9f21ac04be7d3311",
  pattern: "supervisor",
  primary_agent: "coordinator",
  nodes: [
    { id: "__start__", kind: "start", role: null, label: "start", group: null, agent: null, function: null },
    {
      id: "coordinator",
      kind: "agent",
      role: "supervisor",
      label: "coordinator",
      group: null,
      agent: {
        model_binding: "anthropic/claude-haiku-4-5",
        prompt_version: "v1",
        tools: [],
        state_read: ["messages", "request"],
        state_write: ["messages", "final_summary"],
      },
      function: null,
    },
    {
      id: "drafter",
      kind: "agent",
      role: "worker",
      label: "drafter",
      group: null,
      agent: {
        model_binding: "anthropic/claude-haiku-4-5",
        prompt_version: "v1",
        tools: [],
        state_read: ["messages", "request"],
        state_write: ["messages", "draft"],
      },
      function: null,
    },
    {
      id: "publisher",
      kind: "agent",
      role: "worker",
      label: "publisher",
      group: null,
      agent: {
        model_binding: "anthropic/claude-haiku-4-5",
        prompt_version: "v1",
        tools: ["local/publish_greeting@v1"],
        state_read: ["messages", "draft"],
        state_write: ["messages", "published"],
      },
      function: null,
    },
    { id: "__end__", kind: "end", role: null, label: "end", group: null, agent: null, function: null },
  ],
  edges: [
    { id: "e0", source: "__start__", target: "coordinator", kind: "sequential", label: null, bidirectional: false },
    { id: "e1", source: "coordinator", target: "drafter", kind: "handoff", label: null, bidirectional: true },
    { id: "e2", source: "coordinator", target: "publisher", kind: "handoff", label: null, bidirectional: true },
    { id: "e3", source: "coordinator", target: "__end__", kind: "sequential", label: null, bidirectional: false },
  ],
  groups: [],
};

export const chatSession: ChatSessionInfo = {
  session_id: "s_01JXCHATSESSION01",
  project: "hello",
  created_at: "2026-07-16T09:00:00Z",
  run_ids: [],
  multi_turn: false,
  events_url: "/api/chat/hello/sessions/s_01JXCHATSESSION01/events",
  input_fields: [{ name: "name", type: "string", required: true }],
};

/** team_hello — two required input fields: the composer renders the
 * per-field form instead of demanding raw JSON. */
export const teamChatSession: ChatSessionInfo = {
  session_id: "s_01JXTEAMSESSION01",
  project: "team_hello",
  created_at: "2026-07-16T09:10:00Z",
  run_ids: [],
  multi_turn: false,
  events_url: "/api/chat/team_hello/sessions/s_01JXTEAMSESSION01/events",
  input_fields: [
    { name: "request", type: "string", required: true },
    { name: "audience", type: "string", required: true },
  ],
};

export const teamProjectDetail: ProjectDetail = {
  ...projectDetail,
  name: "team_hello",
  description: "Supervisor + two workers (docs/72 worked example).",
  flow_pattern: "supervisor",
  system_version: "9f21ac04be7d3311",
};

/** broken_creds — a purpose-built fixture project whose runtime secret is
 * missing: the backend detail carries the `unavailable` block; run-shaped
 * routes 424. (Deliberately NOT a real example project — rag_hello only
 * needs OPENAI_API_KEY on the backend now.) */
export const brokenCredsProjectDetail: ProjectDetail = {
  ...projectDetail,
  name: "broken_creds",
  description: "Fixture project — retriever behind a cohere connection.",
  flow_pattern: "single",
  system_version: "77aa88bb99ccddee",
  unavailable: {
    env_vars: ["COHERE_API_KEY"],
    remedy:
      "set COHERE_API_KEY in the environment (e.g. the backend repo's " +
      ".env) and restart foundry studio, or edit the connection to a " +
      "different credentials_ref",
  },
};

export const projectUnavailableError = {
  error_class: "ProjectUnavailableError",
  message:
    "project 'broken_creds' is unavailable: environment variable " +
    "'COHERE_API_KEY' is not set",
  context: {
    project: "broken_creds",
    env_vars: ["COHERE_API_KEY"],
    remedy:
      "set COHERE_API_KEY in the environment (e.g. the backend repo's " +
      ".env) and restart foundry studio, or edit the connection to a " +
      "different credentials_ref",
  },
  cause_chain: [
    {
      error_class: "ConfigLoadError",
      message: "environment variable 'COHERE_API_KEY' is not set",
    },
  ],
};

export const forgeRunRunning: ForgeRunInfo = {
  forge_run_id: "forge_01LIVE",
  project: "hello",
  status: "running",
  threshold: 0.9,
  final_score: null,
  best_score: null,
  iterations: 0,
  termination_reason: null,
  termination_detail: "",
  started_at: "2026-07-16T09:30:00Z",
  completed_at: null,
  total_cost_usd: null,
  trajectory: [],
};

export const forgeRunFinished: ForgeRunInfo = {
  forge_run_id: "forge_01DONE",
  project: "hello",
  status: "completed",
  threshold: 0.9,
  final_score: 0.95,
  best_score: 0.95,
  iterations: 2,
  termination_reason: "threshold_met",
  termination_detail: "score 0.95 >= threshold 0.9 after iteration 2",
  started_at: "2026-07-15T18:00:00Z",
  completed_at: "2026-07-15T18:12:00Z",
  total_cost_usd: "1.2345",
  trajectory: [
    {
      iteration_number: 1,
      kind: "iterate",
      eval_score_after: 0.7,
      eval_delta: 0.7,
      commit_shas: ["a1b2c3d4e5f60000000000000000000000000000"],
      summary: "tightened the greeting prompt",
      cost_usd: 0.61,
      applied: true,
    },
    {
      iteration_number: 2,
      kind: "iterate",
      eval_score_after: 0.95,
      eval_delta: 0.25,
      commit_shas: ["b2c3d4e5f6a70000000000000000000000000000"],
      summary: "added an output-schema hint",
      cost_usd: 0.62,
      applied: true,
    },
  ],
};

/** Empty server layouts document — the client falls back to defaults. */
export const layoutsEmpty: LayoutsDocument = {
  version: 1,
  active: "default",
  dashboards: {},
};

export const approvalItem = {
  run_id: "01KXRUNAPPROVAL01",
  approval_id: "publish-greeting-1",
  project: "team_hello",
  agent_name: "publisher",
  prompt: "Publish the greeting to the shared channel?",
  context: { tool: "local/publish_greeting@v1", args: { text: "Hello!" } },
  requested_at: "2026-07-16T09:45:00Z",
};

// --- providers (docs/72 § Provider panel) --------------------------------------------

export const providers: ProviderInfo[] = [
  {
    name: "anthropic",
    label: "Anthropic",
    kind: "llm",
    stub: false,
    note: "",
    credentials_env: "ANTHROPIC_API_KEY",
    models: [
      {
        id: "claude-sonnet-4-5",
        context_window: 200000,
        max_output_tokens: 64000,
        capabilities: ["cache_control", "extended_thinking", "vision", "tool_use"],
        reasoning: true,
        pricing: {
          input_per_1m: 3.0,
          output_per_1m: 15.0,
          cache_read_per_1m: 0.3,
          cache_write_per_1m: 3.75,
        },
      },
      {
        id: "claude-haiku-4-5",
        context_window: 200000,
        max_output_tokens: 64000,
        capabilities: ["cache_control", "tool_use"],
        reasoning: true,
        pricing: {
          input_per_1m: 1.0,
          output_per_1m: 5.0,
          cache_read_per_1m: 0.1,
          cache_write_per_1m: 1.25,
        },
      },
    ],
    embedding_models: [],
  },
  {
    name: "voyage",
    label: "Voyage AI",
    kind: "embedder",
    stub: false,
    note: "",
    credentials_env: "VOYAGE_API_KEY",
    models: [],
    embedding_models: [
      {
        id: "voyage-3",
        dimensions: 1024,
        max_input_tokens: 32000,
        max_batch_size: 128,
        input_per_1m: 0.06,
      },
    ],
  },
  {
    name: "bedrock",
    label: "AWS Bedrock",
    kind: "llm",
    stub: true,
    note: "Phase 1 stub. Bedrock authenticates through the AWS credential chain (AWS_PROFILE / IAM role), not a single API key, so the studio does not manage credentials for it yet.",
    credentials_env: null,
    models: [],
    embedding_models: [],
  },
];

export const providerKeys: ProviderKeyStatus[] = [
  {
    provider: "anthropic",
    var_name: "ANTHROPIC_API_KEY",
    set: true,
    source: "environment",
    last4: null,
  },
  {
    provider: "voyage",
    var_name: "VOYAGE_API_KEY",
    set: false,
    source: "unset",
    last4: null,
  },
  {
    provider: "cohere",
    var_name: "COHERE_API_KEY",
    set: false,
    source: "unset",
    last4: null,
  },
];
