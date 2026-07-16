/**
 * Custom React Flow node cards per GraphNode kind/role (docs/72 §
 * Rendering): agents show model + prompt version + tool count; the
 * supervisor gets a distinct accent; functions show version; start/end
 * are small terminals.
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BotIcon, CrownIcon, FunctionSquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FlowNodeData } from "./graph-layout";

function handles(direction: "LR" | "TB", kind: "both" | "source" | "target") {
  const targetPos = direction === "LR" ? Position.Left : Position.Top;
  const sourcePos = direction === "LR" ? Position.Right : Position.Bottom;
  return (
    <>
      {kind !== "source" && (
        <Handle type="target" position={targetPos} className="!bg-muted-foreground" />
      )}
      {kind !== "target" && (
        <Handle type="source" position={sourcePos} className="!bg-muted-foreground" />
      )}
    </>
  );
}

export function AgentGraphNode({ data, selected }: NodeProps) {
  const { graphNode, direction } = data as FlowNodeData;
  const agent = graphNode.agent;
  const isSupervisor = graphNode.role === "supervisor";
  const [provider, model] = (agent?.model_binding ?? "/").split("/", 2);

  return (
    <div
      className={cn(
        "h-full w-full rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-shadow",
        isSupervisor && "border-primary/60 ring-1 ring-primary/30",
        selected && "ring-2 ring-ring",
      )}
      data-node-kind="agent"
      data-node-role={graphNode.role ?? ""}
    >
      <div className="flex items-center gap-1.5">
        {isSupervisor ? (
          <CrownIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
        ) : (
          <BotIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="truncate text-sm font-medium">{graphNode.label}</span>
        {graphNode.role && (
          <Badge variant={isSupervisor ? "default" : "secondary"} className="ml-auto shrink-0 text-[10px]">
            {graphNode.role}
          </Badge>
        )}
      </div>
      {agent && (
        <div className="mt-1.5 space-y-1">
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={agent.model_binding}
          >
            <span className="rounded bg-muted px-1 py-px">{provider}</span>{" "}
            {model}
          </p>
          <p className="text-[11px] text-muted-foreground">
            prompt {agent.prompt_version} ·{" "}
            {agent.tools.length === 1 ? "1 tool" : `${agent.tools.length} tools`}
          </p>
        </div>
      )}
      {handles(direction, "both")}
    </div>
  );
}

export function FunctionGraphNode({ data, selected }: NodeProps) {
  const { graphNode, direction } = data as FlowNodeData;
  return (
    <div
      className={cn(
        "h-full w-full rounded-lg border border-dashed bg-card px-3 py-2 shadow-sm",
        selected && "ring-2 ring-ring",
      )}
      data-node-kind="function"
    >
      <div className="flex items-center gap-1.5">
        <FunctionSquareIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-sm font-medium">{graphNode.label}</span>
      </div>
      {graphNode.function && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          fn · {graphNode.function.version}
        </p>
      )}
      {handles(direction, "both")}
    </div>
  );
}

export function TerminalGraphNode({ data }: NodeProps) {
  const { graphNode, direction } = data as FlowNodeData;
  const isStart = graphNode.kind === "start";
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-full border bg-muted text-xs font-medium text-muted-foreground"
      data-node-kind={graphNode.kind}
    >
      {graphNode.label}
      {handles(direction, isStart ? "source" : "target")}
    </div>
  );
}

