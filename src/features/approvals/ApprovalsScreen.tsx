/**
 * Approvals inbox — cross-project pending approvals with approve /
 * reject-with-reason. Resolving here updates the same run the in-chat
 * approval card watches (query invalidation on both surfaces).
 */
import { useState } from "react";
import { Link } from "react-router";
import { ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useApprovals, useResumeRun } from "@/api/hooks/useRuns";
import type { ApprovalItem } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

function ApprovalRow({ item }: { item: ApprovalItem }) {
  const resume = useResumeRun();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const resolve = (decision: "approved" | "rejected") => {
    resume.mutate(
      {
        runId: item.run_id,
        body: {
          approval_id: item.approval_id,
          decision,
          reason: decision === "rejected" ? reason.trim() : null,
        },
      },
      {
        onSuccess: () =>
          toast.success(
            decision === "approved" ? "Approved — run resumed" : "Rejected — run resumed",
          ),
      },
    );
  };

  return (
    <Card data-slot="approval-row">
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="warn">pending</Badge>
          <span className="font-medium">{item.prompt || item.approval_id}</span>
        </div>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>
            project <span className="font-mono">{item.project}</span>
          </span>
          {item.agent_name && (
            <span>
              agent <span className="font-mono">{item.agent_name}</span>
            </span>
          )}
          <Link
            to={`/projects/${item.project}/runs/${item.run_id}`}
            className="font-mono underline-offset-2 hover:underline"
          >
            {item.run_id}
          </Link>
        </p>
        {Object.keys(item.context ?? {}).length > 0 && (
          <pre className="max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
            {JSON.stringify(item.context, null, 2)}
          </pre>
        )}
        {resume.error && (
          <ErrorState error={resume.error} title="Could not resolve approval" />
        )}
        {rejecting ? (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
              rows={2}
              aria-label={`Rejection reason for ${item.approval_id}`}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={resume.isPending || reason.trim() === ""}
                onClick={() => resolve("rejected")}
              >
                Confirm reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={resume.isPending} onClick={() => resolve("approved")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={resume.isPending}
              onClick={() => setRejecting(true)}
            >
              Reject…
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ApprovalsScreen() {
  const approvals = useApprovals();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        description="Pending HITL approvals across every project — resolving here resumes the paused run."
      />
      {approvals.error ? (
        <ErrorState error={approvals.error} title="Could not load approvals" />
      ) : approvals.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (approvals.data ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="No pending approvals"
          description="Runs pause here when a HITL-gated tool needs a human decision."
        />
      ) : (
        <div className="space-y-3">
          {(approvals.data ?? []).map((item) => (
            <ApprovalRow key={`${item.run_id}:${item.approval_id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
