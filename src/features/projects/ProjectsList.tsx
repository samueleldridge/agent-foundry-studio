import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon, BoxesIcon } from "lucide-react";
import { toast } from "sonner";
import { useCreateProject, useProjects } from "@/api/hooks/useProjects";
import type { ProjectSummary } from "@/api/types";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatScore } from "@/lib/format";

export function ProjectsList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const columns = useMemo<ColumnDef<ProjectSummary, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "healthy",
        header: "Health",
        cell: ({ row }) => (
          <StatusBadge status={row.original.healthy ? "healthy" : "unhealthy"} />
        ),
      },
      { accessorKey: "branch", header: "Branch" },
      { accessorKey: "agent_count", header: "Agents" },
      { accessorKey: "tool_count", header: "Tools" },
      {
        accessorKey: "last_eval_score",
        header: "Last eval",
        cell: ({ row }) => formatScore(row.original.last_eval_score),
      },
      {
        accessorKey: "last_commit_subject",
        header: "Last commit",
        cell: ({ row }) => (
          <span className="block max-w-72 truncate text-muted-foreground">
            <code className="mr-1.5 font-mono text-xs">
              {row.original.last_commit}
            </code>
            {row.original.last_commit_subject}
          </span>
        ),
      },
    ],
    [],
  );

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createProject.mutate(name, {
      onSuccess: () => {
        toast.success(`Project ${name} scaffolded`);
        setDialogOpen(false);
        setNewName("");
        void navigate(`/projects/${name}`);
      },
      onError: (err) => toast.error(`Scaffold failed: ${err.message}`),
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="Configured systems under projects/ — health, artifacts, and recent activity."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon aria-hidden /> New project
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} title="Could not load projects" />
      ) : !isLoading && (data ?? []).length === 0 ? (
        <EmptyState
          icon={BoxesIcon}
          title="No projects yet"
          description="Scaffold your first project to get a skeleton plus a foundry/<name> branch."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon aria-hidden /> New project
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          onRowClick={(p) => void navigate(`/projects/${p.name}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Scaffolds a project skeleton under projects/ and creates its
              foundry branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={newName}
              placeholder="my_project"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCreate}
              disabled={!newName.trim() || createProject.isPending}
            >
              {createProject.isPending ? "Scaffolding…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
