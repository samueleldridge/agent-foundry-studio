/**
 * Node side panel — full AgentSummary / FunctionSummary (tools with pins,
 * state read/write scopes) + jump links to the node's config and runs.
 */
import { Link } from "react-router";
import { FileCode2Icon, HistoryIcon, XIcon } from "lucide-react";
import type { GraphNode } from "@/api/graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function ScopeList({ title, fields }: { title: string; fields: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">—</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {fields.map((f) => (
            <Badge key={f} variant="secondary" className="font-mono text-[10px]">
              {f}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function GraphSidePanel({
  project,
  node,
  onClose,
}: {
  project: string;
  node: GraphNode;
  onClose: () => void;
}) {
  const agent = node.agent;
  const fn = node.function;

  return (
    <Card className="w-72 shrink-0 self-start" data-slot="graph-side-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {node.label}
          {node.role && <Badge variant="secondary">{node.role}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close node panel">
          <XIcon aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {agent && (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Model</p>
              <p className="font-mono text-xs">{agent.model_binding}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prompt version</p>
              <p className="font-mono text-xs">{agent.prompt_version}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Tools ({agent.tools.length})
              </p>
              {agent.tools.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">No tools</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {agent.tools.map((t) => (
                    <li key={t} className="truncate font-mono text-xs" title={t}>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Separator />
            <ScopeList title="State reads" fields={agent.state_read} />
            <ScopeList title="State writes" fields={agent.state_write} />
          </>
        )}
        {fn && (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Function version</p>
              <p className="font-mono text-xs">{fn.version}</p>
            </div>
            <Separator />
            <ScopeList title="State reads" fields={fn.state_read} />
            <ScopeList title="State writes" fields={fn.state_write} />
          </>
        )}
        {!agent && !fn && (
          <p className="text-xs text-muted-foreground">
            Flow terminal — no configuration.
          </p>
        )}
        {node.kind === "agent" && (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" asChild className="justify-start">
                <Link to={`/projects/${project}/configs?path=agents/${node.id}/agent.yaml`}>
                  <FileCode2Icon aria-hidden /> Open config
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="justify-start">
                <Link to={`/projects/${project}/runs`}>
                  <HistoryIcon aria-hidden /> View runs
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
