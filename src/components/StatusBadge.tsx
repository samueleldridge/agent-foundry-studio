/**
 * One status vocabulary across doctor, health, evals, and runs — the
 * semantic token set (ok / warn / fail) applied consistently.
 */
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleXIcon,
  CircleDashedIcon,
  LoaderIcon,
} from "lucide-react";

type StatusKind = "ok" | "warn" | "fail" | "muted" | "running";

const STATUS_MAP: Record<string, StatusKind> = {
  ok: "ok",
  success: "ok",
  completed: "ok",
  passed: "ok",
  healthy: "ok",
  warn: "warn",
  warning: "warn",
  pending: "warn",
  approval_pending: "warn",
  fail: "fail",
  failed: "fail",
  error: "fail",
  unhealthy: "fail",
  cancelled: "muted",
  skipped: "muted",
  running: "running",
  in_progress: "running",
};

export function StatusBadge({ status }: { status: string }) {
  const kind = STATUS_MAP[status.toLowerCase()] ?? "muted";
  const variant = kind === "running" ? "secondary" : kind;
  const Icon =
    kind === "ok"
      ? CheckCircle2Icon
      : kind === "warn"
        ? CircleAlertIcon
        : kind === "fail"
          ? CircleXIcon
          : kind === "running"
            ? LoaderIcon
            : CircleDashedIcon;
  return (
    <Badge variant={variant} data-status={status}>
      <Icon className={kind === "running" ? "animate-spin" : ""} aria-hidden />
      {status}
    </Badge>
  );
}
