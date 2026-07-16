/**
 * RunEvent stream renderer. In 10b it renders persisted event lists (run
 * detail replay); in 10c it is attached to live SSE feeds.
 */
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SSEEvent } from "@/api/sse";

function eventVariant(
  name: string,
): "ok" | "fail" | "warn" | "secondary" | "muted" {
  if (name.endsWith(".failed") || name.includes("sandbox")) return "fail";
  if (name.endsWith(".completed")) return "ok";
  if (name.startsWith("approval")) return "warn";
  if (name.startsWith("llm") || name.startsWith("tool")) return "secondary";
  return "muted";
}

function preview(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  try {
    const s = JSON.stringify(data);
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return String(data);
  }
}

interface EventFeedProps {
  events: SSEEvent[];
  className?: string;
  follow?: boolean;
  emptyMessage?: string;
}

export function EventFeed({
  events,
  className,
  follow = true,
  emptyMessage = "No events.",
}: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (follow && events.length > 0) {
      bottomRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [events.length, follow]);

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      data-slot="event-feed"
      className={cn(
        "max-h-96 space-y-1 overflow-y-auto rounded-lg border bg-card p-2",
        className,
      )}
    >
      {events.map((event, i) => (
        <div
          key={event.id ?? i}
          className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50"
        >
          <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-muted-foreground">
            {event.id ?? i}
          </span>
          <Badge variant={eventVariant(event.event)} className="shrink-0">
            {event.event}
          </Badge>
          <span className="min-w-0 break-all font-mono text-muted-foreground">
            {preview(event.data)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
