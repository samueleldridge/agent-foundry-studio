/**
 * Forge console — launch form (description / eval set / threshold /
 * budget / model) + history of past forge runs with drill-in.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { HammerIcon, RocketIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { useLaunchForge, useForgeRuns } from "@/api/hooks/useForge";
import { useProjects } from "@/api/hooks/useProjects";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
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
import { Textarea } from "@/components/ui/textarea";
import type { ForgeRunInfo } from "@/api/types";
import { formatRelativeTime, formatScore } from "@/lib/format";

export function ForgeLaunchForm({ defaultProject }: { defaultProject?: string }) {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const launch = useLaunchForge();

  const [project, setProject] = useState(defaultProject ?? "");
  const [description, setDescription] = useState("");
  const [evalPath, setEvalPath] = useState("");
  const [threshold, setThreshold] = useState("0.9");
  const [maxIter, setMaxIter] = useState("5");
  const [maxCost, setMaxCost] = useState("");
  const [model, setModel] = useState("");

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
        max_iter: Number(maxIter),
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
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
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
              value={maxIter}
              onChange={(e) => setMaxIter(e.target.value)}
            />
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

export function ForgeScreen() {
  const runs = useForgeRuns();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Forge"
        description="Meta-agent runs: describe the change, gate it on an eval set, watch the trajectory."
      />

      <ForgeLaunchForm />

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
