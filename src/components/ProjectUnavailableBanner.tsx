/**
 * Banner for a project whose runtime secrets are missing (backend 424
 * `ProjectUnavailableError` / project-detail `unavailable` block): names
 * the env var(s), shows the remedy, links to the connections screen.
 * Stored state (sessions, runs, versions) stays browsable around it.
 */
import { Link } from "react-router";
import { KeyRoundIcon } from "lucide-react";
import { ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UnavailableInfo {
  project: string;
  envVars: string[];
  remedy: string;
}

/** Extract the unavailable envelope from a 424 ApiError; null otherwise. */
export function unavailableFromError(error: unknown): UnavailableInfo | null {
  if (!(error instanceof ApiError) || error.status !== 424) return null;
  const ctx = error.envelope.context;
  return {
    project: typeof ctx.project === "string" ? ctx.project : "",
    envVars: Array.isArray(ctx.env_vars) ? ctx.env_vars.map(String) : [],
    remedy: typeof ctx.remedy === "string" ? ctx.remedy : "",
  };
}

export function ProjectUnavailableBanner({
  project,
  envVars,
  remedy,
  className,
}: UnavailableInfo & { className?: string }) {
  const vars = envVars.length > 0 ? envVars : ["(unknown)"];
  return (
    <Alert
      variant="warning"
      className={cn(className)}
      data-slot="project-unavailable-banner"
    >
      <KeyRoundIcon aria-hidden />
      <div>
        <AlertTitle>
          {project ? `${project} is unavailable` : "Project unavailable"} —
          missing credentials
        </AlertTitle>
        <AlertDescription>
          <p>
            This project needs{" "}
            {vars.map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <code className="rounded bg-warn/15 px-1 py-0.5 font-mono text-[11px]">
                  {name}
                </code>
              </span>
            ))}{" "}
            set in the backend environment before it can run. Its stored
            sessions, runs, and versions remain browsable.
          </p>
          {remedy && <p className="mt-1">{remedy}</p>}
          {project && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-warn/40"
              asChild
            >
              <Link to={`/projects/${project}/connections`}>
                Review connections
              </Link>
            </Button>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
