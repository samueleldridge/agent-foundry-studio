/**
 * Per-project chat screen — session list (reload reattach) + ChatThread.
 */
import { useState } from "react";
import { useParams } from "react-router";
import { MessageSquarePlusIcon } from "lucide-react";
import { useChatSessions, useOpenChatSession } from "@/api/hooks/useChat";
import { useProject } from "@/api/hooks/useProjects";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { ProjectUnavailableBanner } from "@/components/ProjectUnavailableBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { ChatThread } from "./ChatThread";

export function ChatScreen() {
  const { name = "" } = useParams();
  const sessions = useChatSessions(name);
  const openSession = useOpenChatSession(name);
  const project = useProject(name);
  // Missing runtime secrets: sessions still list; runs can't start.
  const unavailable = project.data?.unavailable ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reattach: default to the most recent session once the list loads
  // (derived, so a reload lands back in the latest thread).
  const effectiveId =
    selectedId ??
    (sessions.data && sessions.data.length > 0
      ? sessions.data[sessions.data.length - 1]!.session_id
      : null);
  const selected =
    sessions.data?.find((s) => s.session_id === effectiveId) ?? null;

  const newSession = () =>
    openSession.mutate(undefined, {
      onSuccess: (s) => setSelectedId(s.session_id),
    });

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      <PageHeader
        title="Chat"
        description={
          selected
            ? selected.multi_turn
              ? "Multi-turn session — prior turns thread into each run."
              : "Single-turn project — each message is an independent run."
            : `Chat with ${name}`
        }
        actions={
          <Button
            onClick={newSession}
            disabled={openSession.isPending || unavailable !== null}
          >
            <MessageSquarePlusIcon aria-hidden /> New session
          </Button>
        }
      />

      {unavailable && (
        <ProjectUnavailableBanner
          project={name}
          envVars={unavailable.env_vars ?? []}
          remedy={unavailable.remedy ?? ""}
        />
      )}

      {sessions.error ? (
        <ErrorState error={sessions.error} title="Could not load chat sessions" />
      ) : openSession.error ? (
        <ErrorState error={openSession.error} title="Could not open a chat session" />
      ) : sessions.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="w-52 shrink-0 space-y-1 overflow-y-auto">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sessions
            </p>
            {(sessions.data ?? []).length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">
                No sessions yet.
              </p>
            )}
            {[...(sessions.data ?? [])].reverse().map((s) => (
              <button
                key={s.session_id}
                type="button"
                onClick={() => setSelectedId(s.session_id)}
                className={cn(
                  "w-full rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted/60",
                  s.session_id === effectiveId && "border-primary/50 bg-muted",
                )}
              >
                <span className="block truncate font-mono">
                  {s.session_id.slice(0, 16)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  {(s.run_ids ?? []).length} runs
                  <span>· {formatRelativeTime(s.created_at)}</span>
                  {s.multi_turn && (
                    <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                      multi-turn
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </aside>

          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-background">
            {selected ? (
              <ChatThread
                key={selected.session_id}
                project={name}
                session={selected}
                disabled={unavailable !== null}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Button
                  onClick={newSession}
                  disabled={openSession.isPending || unavailable !== null}
                >
                  <MessageSquarePlusIcon aria-hidden /> Start a session
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
