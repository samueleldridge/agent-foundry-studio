/**
 * ChatThread — streaming message thread over the session SSE (docs/72 §
 * Chat UX). Each message = one run: streamed llm.delta rendering, a
 * collapsible activity strip (tool calls, node transitions, handoffs),
 * in-thread approval cards, failed-run rendering with retry, per-message
 * run footer, and a session cost ticker.
 *
 * Used by the per-project chat screen and the `chat-panel` widget.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  LoaderIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { apiGet } from "@/api/client";
import { useSSE } from "@/api/sse";
import {
  useResolveChatApproval,
  useSendChatMessage,
} from "@/api/hooks/useChat";
import type { ChatSessionInfo, RunArtifactView } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import {
  reduceThread,
  userTextFromInputs,
  type ActivityItem,
  type ApprovalState,
  type ChatTurn,
} from "./chat-thread";
import { ChatComposer } from "./ChatComposer";

// --- activity strip ---------------------------------------------------------

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon =
    item.status === "running"
      ? LoaderIcon
      : item.status === "fail"
        ? CircleXIcon
        : item.kind === "tool"
          ? WrenchIcon
          : CircleCheckIcon;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon
        className={cn(
          "size-3 shrink-0",
          item.status === "running" && "animate-spin",
          item.status === "fail" && "text-fail",
          item.status === "ok" && "text-ok",
        )}
        aria-hidden
      />
      <span className="font-mono">{item.label}</span>
      {item.durationMs !== undefined && (
        <span>· {formatDuration(item.durationMs)}</span>
      )}
      {item.detail && (
        <span className="min-w-0 truncate" title={item.detail}>
          — {item.detail}
        </span>
      )}
    </div>
  );
}

function ActivityStrip({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const toolCount = items.filter((a) => a.kind === "tool").length;
  return (
    <div className="mt-1.5 rounded-md border bg-muted/40 px-2 py-1" data-slot="activity-strip">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDownIcon className="size-3" aria-hidden />
        ) : (
          <ChevronRightIcon className="size-3" aria-hidden />
        )}
        activity · {items.length} events
        {toolCount > 0 && (
          <span className="ml-1 flex items-center gap-1">
            {items
              .filter((a) => a.kind === "tool")
              .slice(0, 4)
              .map((a, i) => (
                <Badge key={i} variant="secondary" className="px-1 py-0 font-mono text-[10px]">
                  <WrenchIcon className="size-2.5" aria-hidden />
                  {a.label.split("@")[0]}
                </Badge>
              ))}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 border-t pt-1">
          {items.map((item, i) => (
            <ActivityRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- approval card ----------------------------------------------------------

function ApprovalCard({
  approval,
  busy,
  onResolve,
}: {
  approval: ApprovalState;
  busy: boolean;
  onResolve: (decision: "approved" | "rejected", reason: string | null) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (approval.resolved) {
    const approved = approval.resolved.decision === "approved";
    return (
      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
          approved ? "border-ok/40 bg-ok/5 text-ok" : "border-fail/40 bg-fail/5 text-fail",
        )}
        data-slot="approval-resolved"
      >
        {approved ? (
          <CircleCheckIcon className="size-3.5" aria-hidden />
        ) : (
          <CircleXIcon className="size-3.5" aria-hidden />
        )}
        {approved ? "Approved" : "Rejected"}
        {approval.resolved.reason && (
          <span className="text-muted-foreground">— {approval.resolved.reason}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-2 rounded-lg border border-warn/50 bg-warn/5 p-3"
      data-slot="approval-card"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldAlertIcon className="size-4 text-warn" aria-hidden />
        Approval required
      </p>
      <p className="mt-1 text-sm">{approval.prompt}</p>
      {approval.agentName && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          agent: <span className="font-mono">{approval.agentName}</span>
        </p>
      )}
      {Object.keys(approval.context).length > 0 && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
          {JSON.stringify(approval.context, null, 2)}
        </pre>
      )}
      {rejecting ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            rows={2}
            aria-label="Rejection reason"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || reason.trim() === ""}
              onClick={() => onResolve("rejected", reason.trim())}
            >
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onResolve("approved", null)}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            Reject…
          </Button>
        </div>
      )}
    </div>
  );
}

// --- per-run user text (reattach path) ---------------------------------------

function useReplayUserText(runId: string, needed: boolean): string | null {
  const artifact = useQuery({
    queryKey: ["runs", "detail", runId, "artifact"],
    queryFn: () => apiGet<RunArtifactView>(`/api/runs/${runId}/artifact`),
    enabled: needed,
    retry: false,
    staleTime: Infinity,
  });
  if (!needed) return null;
  if (!artifact.data) return null;
  return userTextFromInputs(artifact.data.inputs);
}

// --- one turn -----------------------------------------------------------------

function TurnView({
  project,
  turn,
  userText,
  isReplayed,
  approvalBusy,
  onResolve,
  onRetry,
  compact,
}: {
  project: string;
  turn: ChatTurn;
  userText: string | null;
  isReplayed: boolean;
  approvalBusy: boolean;
  onResolve: (decision: "approved" | "rejected", reason: string | null) => void;
  onRetry: (text: string) => void;
  compact: boolean;
}) {
  const replayText = useReplayUserText(turn.runId, userText === null && isReplayed);
  const shownUserText = userText ?? replayText;

  return (
    <div className="space-y-2" data-slot="chat-turn" data-run-id={turn.runId}>
      {shownUserText !== null && (
        <div className="flex justify-end">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            {shownUserText}
          </div>
        </div>
      )}

      <div className="flex justify-start">
        <div className="max-w-[85%] min-w-0">
          {turn.assistantText !== "" && (
            <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2 text-sm">
              {turn.assistantText}
              {turn.status === "streaming" && (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-foreground/60 align-middle" />
              )}
            </div>
          )}
          {turn.assistantText === "" && turn.status === "streaming" && (
            <div className="flex items-center gap-2 rounded-2xl border bg-card px-3.5 py-2 text-sm text-muted-foreground">
              <LoaderIcon className="size-3.5 animate-spin" aria-hidden />
              thinking…
            </div>
          )}

          <ActivityStrip items={turn.activity} />

          {turn.approvals.map((approval) => (
            <ApprovalCard
              key={approval.approvalId}
              approval={approval}
              busy={approvalBusy}
              onResolve={onResolve}
            />
          ))}

          {turn.status === "failed" && turn.error && (
            <div
              className="mt-2 rounded-lg border border-fail/40 bg-fail/5 p-3 text-sm"
              data-slot="chat-error"
            >
              <p className="flex items-center gap-1.5 font-medium text-fail">
                <CircleXIcon className="size-4" aria-hidden />
                Run failed
                <span className="rounded bg-fail/15 px-1.5 py-0.5 font-mono text-[11px]">
                  {turn.error.error_class}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs">
                {turn.error.message}
              </p>
              {shownUserText !== null && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => onRetry(shownUserText)}
                >
                  <RotateCcwIcon aria-hidden /> Retry message
                </Button>
              )}
            </div>
          )}

          {turn.status !== "streaming" && !compact && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <Link
                to={`/projects/${project}/runs/${turn.runId}`}
                className="font-mono underline-offset-2 hover:underline"
              >
                {turn.runId}
              </Link>
              {turn.tokens !== null && <span>{formatTokens(turn.tokens)} tok</span>}
              {turn.costUsd !== null && <span>{formatCost(turn.costUsd)}</span>}
              {turn.durationMs !== null && turn.durationMs > 0 && (
                <span>{formatDuration(turn.durationMs)}</span>
              )}
              {turn.status === "max_hops" && (
                <Badge variant="warn" className="text-[10px]">max hops</Badge>
              )}
              {turn.status === "cancelled" && (
                <Badge variant="muted" className="text-[10px]">cancelled</Badge>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- the thread ---------------------------------------------------------------

export interface ChatThreadProps {
  project: string;
  session: ChatSessionInfo;
  /** Widget mode: denser, no run footers. */
  compact?: boolean;
  /** Project unavailable (missing runtime secrets): thread renders,
   * composer is disabled — the screen shows the banner. */
  disabled?: boolean;
}

export function ChatThread({
  project,
  session,
  compact = false,
  disabled = false,
}: ChatThreadProps) {
  const eventsUrl =
    session.events_url ||
    `/api/chat/${project}/sessions/${session.session_id}/events`;
  const { events } = useSSE(eventsUrl);
  const send = useSendChatMessage(project, session.session_id);
  const resolve = useResolveChatApproval(project, session.session_id);

  // run_id → text for messages sent from THIS mount; earlier runs replay
  // their user text from the persisted run artifact.
  const [sentTexts, setSentTexts] = useState<Record<string, string>>({});
  const [initialRunIds] = useState(() => new Set(session.run_ids ?? []));
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const turns = useMemo(() => reduceThread(events), [events]);
  const totalCost = turns.reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
  const streaming = turns.some((t) => t.status === "streaming");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [events.length]);

  const sendText = (text: string) => {
    if (text.trim() === "") return;
    send.mutate(text, {
      onSuccess: (res) => {
        setSentTexts((prev) => ({ ...prev, [res.run_id]: text }));
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="chat-thread">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {turns.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {session.multi_turn
              ? "Start the conversation — prior turns thread into each run."
              : "Send a message — each message runs independently (single-turn project)."}
          </p>
        )}
        {turns.map((turn) => (
          <TurnView
            key={turn.runId}
            project={project}
            turn={turn}
            userText={sentTexts[turn.runId] ?? null}
            isReplayed={initialRunIds.has(turn.runId)}
            approvalBusy={resolve.isPending}
            onResolve={(decision, reason) => {
              const approval = turn.approvals.find((a) => !a.resolved);
              if (!approval) return;
              resolve.mutate({
                approval_id: approval.approvalId,
                decision,
                reason,
              });
            }}
            onRetry={sendText}
            compact={compact}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <ChatComposer
          session={session}
          pending={send.isPending}
          disabled={disabled}
          compact={compact}
          error={send.error}
          onSend={sendText}
        />
        {!compact && (
          <p className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>session {session.session_id.slice(0, 12)}</span>
            <span>· {turns.length} messages</span>
            <span>· {formatCost(totalCost)}</span>
            {streaming && <span className="text-primary">· streaming</span>}
          </p>
        )}
      </div>
    </div>
  );
}
