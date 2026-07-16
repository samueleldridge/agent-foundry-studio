/**
 * Live-surface widgets: forge-console, chat-panel, flow-graph-mini —
 * compact embeddings of the real-time screens.
 */
import { MessageSquarePlusIcon } from "lucide-react";
import { useChatSessions, useOpenChatSession } from "@/api/hooks/useChat";
import { useForgeRuns } from "@/api/hooks/useForge";
import { useGraph } from "@/api/graph";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/features/chat/ChatThread";
import { FlowGraph } from "@/features/graph/FlowGraph";
import { ForgeTrajectory } from "@/features/forge/ForgeTrajectory";
import { useForgeStream } from "@/features/forge/use-forge-stream";
import type { ForgeRunInfo } from "@/api/types";
import { ConfigNeeded, WidgetLoading } from "./core-widgets";
import type { WidgetProps } from "./types";

function LiveForgeTrajectory({ info }: { info: ForgeRunInfo }) {
  const live = info.status === "running";
  const { events } = useForgeStream(info.forge_run_id, live);
  return (
    <div className="overflow-y-auto p-2">
      <div className="mb-1.5 flex items-center gap-2 text-xs">
        <StatusBadge status={info.status} />
        <span className="truncate font-mono text-muted-foreground">
          {info.forge_run_id}
        </span>
      </div>
      <ForgeTrajectory info={info} events={events} compact />
    </div>
  );
}

export function ForgeConsoleWidget({ config }: WidgetProps) {
  const runs = useForgeRuns(config.project || undefined);
  if (runs.error) return <ErrorState error={runs.error} className="m-2" />;
  if (runs.isLoading) return <WidgetLoading />;
  const all = runs.data ?? [];
  const active = all.find((r) => r.status === "running");
  const shown = active ?? all[all.length - 1];
  if (!shown) {
    return (
      <EmptyState
        title="No forge runs"
        description="Launch one from the forge console."
        className="m-2 h-[calc(100%-1rem)] border-0"
      />
    );
  }
  return <LiveForgeTrajectory key={shown.forge_run_id} info={shown} />;
}

export function ChatPanelWidget({ config }: WidgetProps) {
  const project = config.project ?? "";
  const sessions = useChatSessions(project || null);
  const openSession = useOpenChatSession(project);
  if (!project) return <ConfigNeeded field="project" />;
  if (sessions.error) return <ErrorState error={sessions.error} className="m-2" />;
  if (sessions.isLoading) return <WidgetLoading />;
  const session = (sessions.data ?? [])[Math.max(0, (sessions.data ?? []).length - 1)];
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <Button
          size="sm"
          disabled={openSession.isPending}
          onClick={() => openSession.mutate()}
        >
          <MessageSquarePlusIcon aria-hidden /> Start a session
        </Button>
      </div>
    );
  }
  return (
    <ChatThread
      key={session.session_id}
      project={project}
      session={session}
      compact
    />
  );
}

export function FlowGraphMiniWidget({ config }: WidgetProps) {
  const project = config.project ?? "";
  const graph = useGraph(project || null);
  if (!project) return <ConfigNeeded field="project" />;
  if (graph.error) {
    return <ErrorState error={graph.error} className="m-2" title="Graph unavailable" />;
  }
  if (graph.isLoading || !graph.data) return <WidgetLoading />;
  return <FlowGraph graph={graph.data} interactive={false} />;
}
