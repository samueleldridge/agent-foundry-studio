/**
 * Unified diff renderer for git-style hunks text (the studio diff route
 * returns raw `git diff` output per file).
 */
import { cn } from "@/lib/utils";

interface DiffViewProps {
  /** Raw unified-diff text (one file's hunks). */
  hunks: string;
  className?: string;
}

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) {
    return "text-muted-foreground font-medium";
  }
  if (line.startsWith("@@")) {
    return "text-primary bg-primary/5";
  }
  if (line.startsWith("+")) {
    return "text-ok bg-ok/10";
  }
  if (line.startsWith("-")) {
    return "text-fail bg-fail/10";
  }
  if (line.startsWith("diff ") || line.startsWith("index ")) {
    return "text-muted-foreground";
  }
  return "text-foreground/80";
}

export function DiffView({ hunks, className }: DiffViewProps) {
  const lines = hunks.split("\n");
  return (
    <pre
      data-slot="diff-view"
      className={cn(
        "overflow-x-auto rounded-lg border bg-card p-3 text-xs leading-5 font-mono",
        className,
      )}
    >
      {lines.map((line, i) => (
        <div key={i} className={cn("px-1 whitespace-pre", lineClass(line))}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
