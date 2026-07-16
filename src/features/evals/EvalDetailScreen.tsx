/**
 * Per-case eval detail for one eval run.
 */
import { Link, useParams } from "react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useEvalRun, type EvalCase } from "@/api/hooks/useEvals";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCost,
  formatDuration,
  formatScore,
  formatTimestamp,
  formatTokens,
} from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

export function EvalDetailScreen() {
  const { name = "", evalRunId = "" } = useParams();
  const { data, isLoading, error } = useEvalRun(evalRunId);

  const cases = (data?.per_case ?? []) as EvalCase[];

  return (
    <div className="space-y-4">
      <PageHeader
        title={data?.eval_name ?? "Eval run"}
        description={evalRunId}
        actions={
          <Button variant="outline" asChild>
            <Link to={`/projects/${name}/evals`}>
              <ArrowLeftIcon aria-hidden /> All evals
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} title="Could not load eval run" />
      ) : isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-4">
              <StatusBadge status={data.passed ? "passed" : "failed"} />
              <Stat
                label="Score / threshold"
                value={`${formatScore(data.score)} / ${formatScore(data.threshold)}`}
              />
              <Stat
                label="Cases"
                value={`${data.cases_passed}/${data.cases_total} passed`}
              />
              <Stat
                label="Duration"
                value={formatDuration(data.duration_ms ?? null)}
              />
              <Stat
                label="Completed"
                value={formatTimestamp(data.completed_at ?? null)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-case results</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Case</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((c) => (
                    <TableRow key={c.case_id}>
                      <TableCell className="font-mono text-xs">{c.case_id}</TableCell>
                      <TableCell>
                        {c.pass === null ? (
                          <Badge variant="muted">{c.status}</Badge>
                        ) : (
                          <StatusBadge status={c.pass ? "passed" : "failed"} />
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatScore(c.score)}
                      </TableCell>
                      <TableCell>{formatDuration(c.duration_ms ?? null)}</TableCell>
                      <TableCell>{formatTokens(c.tokens ?? null)}</TableCell>
                      <TableCell>
                        {formatCost(c.cost_usd == null ? null : Number(c.cost_usd))}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-80 truncate font-mono text-xs text-muted-foreground">
                          {c.error ?? c.actual_preview ?? "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
