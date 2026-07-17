/**
 * Forge console — launch form (description / eval set / threshold /
 * budget / model) + history of past forge runs with drill-in.
 *
 * Two entry modes: launch against an EXISTING project, or create a NEW
 * one right here — `POST /api/projects` scaffolds the skeleton, its
 * `foundry/<name>` branch, and a validated starter eval template
 * (`evals/<name>.yaml`, TODO placeholders); the launch form prefills
 * with the new project + that eval path and the template deep-links
 * into the config editor.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  FilePenLineIcon,
  FolderPlusIcon,
  HammerIcon,
  RocketIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { useLaunchForge, useForgeRuns } from "@/api/hooks/useForge";
import { useStudioHealth } from "@/api/hooks/useHealth";
import { useCreateProject, useProjects } from "@/api/hooks/useProjects";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ForgeRunInfo, ProjectCreateResponse } from "@/api/types";
import { formatRelativeTime, formatScore } from "@/lib/format";

export function ForgeLaunchForm({
  defaultProject,
  defaultEvalPath,
}: {
  defaultProject?: string;
  defaultEvalPath?: string;
}) {
  const navigate = useNavigate();
  // include_bootstrap: freshly-scaffolded projects (no system.yaml yet)
  // are exactly what the forge is FOR.
  const { data: projects } = useProjects({ includeBootstrap: true });
  const { data: health } = useStudioHealth();
  const launch = useLaunchForge();

  const [project, setProject] = useState(defaultProject ?? "");
  const [description, setDescription] = useState("");
  const [evalPath, setEvalPath] = useState(defaultEvalPath ?? "");
  const [threshold, setThreshold] = useState("0.9");
  const [maxIter, setMaxIter] = useState<string | null>(null);
  const [maxCost, setMaxCost] = useState("");
  const [model, setModel] = useState("");

  // The env-resolved global default (FOUNDRY_FORGE_MAX_ITER, else 5);
  // shown until the operator overrides it for this run.
  const defaultMaxIter = health?.forge_max_iter_default ?? 5;

  const projectNames = (projects ?? []).map((p) => p.name);
  const options =
    project !== "" && !projectNames.includes(project)
      ? [...projectNames, project].sort()
      : projectNames;

  const activeConflict =
    launch.error instanceof ApiError && launch.error.status === 409
      ? String(launch.error.envelope.context.forge_run_id ?? "")
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    launch.mutate(
      {
        project,
        description,
        eval_path: evalPath,
        threshold: Number(threshold),
        max_iter: Number(maxIter ?? defaultMaxIter),
        max_cost_usd: maxCost.trim() === "" ? null : maxCost.trim(),
        model: model.trim() === "" ? null : model.trim(),
        no_improvement_after: 3,
      },
      {
        onSuccess: (res) => {
          toast.success(`Forge launched — ${res.forge_run_id}`);
          void navigate(`/forge/${res.forge_run_id}`);
        },
      },
    );
  };

  return (
    <Card data-slot="forge-launch-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HammerIcon className="size-4" aria-hidden /> Launch a forge run
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-2 gap-3" onSubmit={submit}>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="forge-project">Project</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger id="forge-project" aria-label="Project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {options.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="forge-eval">Eval set path</Label>
            <Input
              id="forge-eval"
              value={evalPath}
              onChange={(e) => setEvalPath(e.target.value)}
              placeholder="projects/hello/evals/hello_eval.yaml"
              required
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="forge-description">Description</Label>
            <Textarea
              id="forge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should the meta-agent build or improve?"
              rows={2}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forge-threshold">Score threshold</Label>
            <Input
              id="forge-threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forge-max-iter">Max iterations</Label>
            <Input
              id="forge-max-iter"
              type="number"
              min="1"
              max="100"
              value={maxIter ?? String(defaultMaxIter)}
              onChange={(e) => setMaxIter(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default {defaultMaxIter} (FOUNDRY_FORGE_MAX_ITER)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forge-max-cost">Cost cap (USD, optional)</Label>
            <Input
              id="forge-max-cost"
              value={maxCost}
              onChange={(e) => setMaxCost(e.target.value)}
              placeholder="5.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forge-model">Meta-agent model (optional)</Label>
            <Input
              id="forge-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="anthropic/claude-opus-4-7"
            />
          </div>
          <div className="col-span-2">
            <Button type="submit" disabled={launch.isPending || project === ""}>
              <RocketIcon aria-hidden />
              {launch.isPending ? "Launching…" : "Launch forge"}
            </Button>
          </div>
        </form>
        {launch.error && (
          <div className="mt-3 space-y-2">
            <ErrorState error={launch.error} title="Forge launch failed" />
            {activeConflict && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/forge/${activeConflict}`}>Watch the active run instead</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PROJECT_NAME_RE = /^[a-z][a-z0-9_-]{0,63}$/;

function dirtyFilesFrom(error: unknown): string[] | null {
  if (!(error instanceof ApiError)) return null;
  const files = error.envelope.context["dirty_files"];
  if (!Array.isArray(files)) return null;
  return files.map(String);
}

export function NewProjectPanel({
  onCreated,
}: {
  onCreated: (created: ProjectCreateResponse) => void;
}) {
  const create = useCreateProject();
  const [name, setName] = useState("");
  const created = create.data ?? null;
  const dirtyFiles = dirtyFilesFrom(create.error);
  const nameOk = name === "" || PROJECT_NAME_RE.test(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(name, {
      onSuccess: (res) => {
        toast.success(`Project ${res.name} created on ${res.branch}`);
        onCreated(res);
      },
    });
  };

  return (
    <Card data-slot="new-project-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderPlusIcon className="size-4" aria-hidden /> New project
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <div className="min-w-56 space-y-1.5">
            <Label htmlFor="new-project-name">Project name</Label>
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="qa_bot"
              pattern="^[a-z][a-z0-9_-]{0,63}$"
              required
              aria-invalid={!nameOk}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase; becomes{" "}
              <code className="font-mono">projects/&lt;name&gt;</code> on branch{" "}
              <code className="font-mono">foundry/&lt;name&gt;</code>.
            </p>
          </div>
          <Button
            type="submit"
            disabled={create.isPending || name === "" || !nameOk}
          >
            <FolderPlusIcon aria-hidden />
            {create.isPending ? "Creating…" : "Create project"}
          </Button>
        </form>

        {create.error && dirtyFiles && (
          <Alert variant="destructive" data-slot="dirty-tree-alert">
            <AlertTitle>Working tree has uncommitted changes</AlertTitle>
            <AlertDescription>
              <p>
                <code className="font-mono">foundry project new</code> refuses
                on a dirty tree — the skeleton lands in its own commit on the
                new branch. Commit or stash these first:
              </p>
              <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                {dirtyFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {create.error && !dirtyFiles && (
          <ErrorState error={create.error} title="Project creation failed" />
        )}

        {created && (
          <div
            className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
            data-slot="created-skeleton"
          >
            <p>
              Created <code className="font-mono">{created.project_dir}</code>{" "}
              on branch <code className="font-mono">{created.branch}</code>.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {(created.files ?? []).map((file) => (
                <Badge
                  key={file}
                  variant="secondary"
                  className="font-mono text-[10px]"
                >
                  {file}
                </Badge>
              ))}
            </div>
            {created.eval_path && (
              <>
                <p className="text-xs text-muted-foreground">
                  The starter eval is a template — fill in its TODO cases
                  before launching; the forge optimises toward it and the
                  meta-agent may not modify it.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    to={`/projects/${created.name}/configs?file=${encodeURIComponent(created.eval_path)}`}
                  >
                    <FilePenLineIcon aria-hidden /> Open starter eval in the
                    editor
                  </Link>
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ForgeScreen() {
  const runs = useForgeRuns();
  const [mode, setMode] = useState<string>("existing");
  const [created, setCreated] = useState<ProjectCreateResponse | null>(null);

  const launchForm = (
    <ForgeLaunchForm
      key={created ? `created-${created.name}` : "blank"}
      defaultProject={created?.name}
      defaultEvalPath={created?.eval_repo_path ?? undefined}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Forge"
        description="Meta-agent runs: describe the change, gate it on an eval set, watch the trajectory."
      />

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="existing">Existing project</TabsTrigger>
          <TabsTrigger value="new">New project</TabsTrigger>
        </TabsList>
        <TabsContent value="existing" className="mt-3">
          {launchForm}
        </TabsContent>
        <TabsContent value="new" className="mt-3 space-y-4">
          <NewProjectPanel onCreated={setCreated} />
          {launchForm}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.error ? (
            <ErrorState error={runs.error} title="Could not load forge runs" />
          ) : runs.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (runs.data ?? []).length === 0 ? (
            <EmptyState
              icon={HammerIcon}
              title="No forge runs yet"
              description="Launch one above — every iteration is committed and eval-gated."
            />
          ) : (
            <DataTable<ForgeRunInfo>
              data={[...(runs.data ?? [])].reverse()}
              columns={[
                {
                  id: "run",
                  header: "Run",
                  cell: ({ row }) => (
                    <Link
                      to={`/forge/${row.original.forge_run_id}`}
                      className="font-mono text-xs underline-offset-2 hover:underline"
                    >
                      {row.original.forge_run_id}
                    </Link>
                  ),
                },
                { accessorKey: "project", header: "Project" },
                {
                  id: "status",
                  header: "Status",
                  cell: ({ row }) => <StatusBadge status={row.original.status} />,
                },
                { accessorKey: "iterations", header: "Iterations" },
                {
                  id: "best_score",
                  header: "Best score",
                  cell: ({ row }) =>
                    row.original.best_score == null
                      ? "—"
                      : formatScore(row.original.best_score),
                },
                {
                  id: "termination",
                  header: "Termination",
                  cell: ({ row }) => row.original.termination_reason ?? "—",
                },
                {
                  id: "started",
                  header: "Started",
                  cell: ({ row }) => formatRelativeTime(row.original.started_at),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
