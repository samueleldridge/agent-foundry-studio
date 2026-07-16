/**
 * Storage — stats per kind, gc / archive with dry-run-first flows, pins.
 */
import { useState } from "react";
import { ArchiveIcon, DatabaseIcon, PinIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  useArchive,
  useGc,
  usePins,
  useStorageStats,
  useUnpin,
} from "@/api/hooks/useStorage";
import type { ArchiveReport, GcReport } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/format";

type StatsKindRow = { kind: string; items: number; bytes: number };

function ReportBlock({
  report,
}: {
  report: GcReport | ArchiveReport;
}) {
  const isGc = "candidates" in report;
  const affected = isGc
    ? (report.dry_run ? (report.candidates ?? []) : (report.deleted ?? []))
    : report.dry_run
      ? ((report as ArchiveReport).archives ?? [])
      : ((report as ArchiveReport).archived ?? []);
  const skippedPinned = report.skipped_pinned ?? [];
  return (
    <div className="mt-3 space-y-1.5 rounded-md border bg-muted/40 p-2.5 text-xs">
      <p className="font-medium">
        {report.dry_run ? "Dry run — nothing changed." : "Applied."}{" "}
        {affected.length} item(s){" "}
        {isGc
          ? report.dry_run
            ? "would be deleted"
            : "deleted"
          : report.dry_run
            ? "would be archived"
            : "archived"}
        {skippedPinned.length > 0 &&
          ` · ${skippedPinned.length} pinned item(s) skipped`}
      </p>
      {affected.length > 0 && (
        <pre className="max-h-32 overflow-auto font-mono">
          {affected.map(String).join("\n")}
        </pre>
      )}
    </div>
  );
}

export function StorageScreen() {
  const stats = useStorageStats();
  const pins = usePins();
  const gc = useGc();
  const archive = useArchive();
  const unpin = useUnpin();

  const [olderThan, setOlderThan] = useState("30d");
  const [gcReport, setGcReport] = useState<GcReport | null>(null);
  const [archiveReport, setArchiveReport] = useState<ArchiveReport | null>(null);

  const runGc = (dryRun: boolean) => {
    gc.mutate(
      { kind: "run", older_than: olderThan, dry_run: dryRun, force: false },
      {
        onSuccess: (report) => {
          setGcReport(report);
          if (!dryRun) toast.success(`GC deleted ${(report.deleted ?? []).length} item(s)`);
        },
        onError: (err) => toast.error(`GC failed: ${err.message}`),
      },
    );
  };

  const runArchive = (dryRun: boolean) => {
    archive.mutate(
      { kind: "run", older_than: olderThan, dry_run: dryRun },
      {
        onSuccess: (report) => {
          setArchiveReport(report);
          if (!dryRun)
            toast.success(`Archived ${(report.archived ?? []).length} item(s)`);
        },
        onError: (err) => toast.error(`Archive failed: ${err.message}`),
      },
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Storage"
        description={`Artifact stores under ${stats.data?.foundry_home ?? "~/.foundry"} — gc and archive preview with dry-run first.`}
      />

      {stats.error ? (
        <ErrorState error={stats.error} title="Could not load storage stats" />
      ) : stats.isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {((stats.data?.kinds ?? []) as StatsKindRow[]).map((row) => (
            <Card key={row.kind}>
              <CardContent className="pt-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DatabaseIcon className="size-3.5" aria-hidden />
                  {row.kind}
                </p>
                <p className="mt-1 text-xl font-semibold">{formatBytes(row.bytes)}</p>
                <p className="text-xs text-muted-foreground">{row.items} item(s)</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2Icon className="size-4 text-muted-foreground" aria-hidden />
              Garbage collection & archive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="older-than">Older than</Label>
                <Input
                  id="older-than"
                  value={olderThan}
                  onChange={(e) => setOlderThan(e.target.value)}
                  className="w-28"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => runGc(true)}
                disabled={gc.isPending}
              >
                Preview gc
              </Button>
              <Button
                variant="destructive"
                onClick={() => runGc(false)}
                disabled={gc.isPending || gcReport === null || !gcReport.dry_run}
              >
                Apply gc
              </Button>
              <Button
                variant="secondary"
                onClick={() => runArchive(true)}
                disabled={archive.isPending}
              >
                <ArchiveIcon aria-hidden /> Preview archive
              </Button>
              <Button
                variant="outline"
                onClick={() => runArchive(false)}
                disabled={
                  archive.isPending ||
                  archiveReport === null ||
                  !archiveReport.dry_run
                }
              >
                Apply
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Apply is enabled only after a dry-run preview — the same
              dry-run-first contract as the CLI.
            </p>
            {gcReport && <ReportBlock report={gcReport} />}
            {archiveReport && <ReportBlock report={archiveReport} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PinIcon className="size-4 text-muted-foreground" aria-hidden />
              Pinned artifacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pins.error ? (
              <ErrorState error={pins.error} title="Could not load pins" />
            ) : (pins.data ?? []).length === 0 ? (
              <EmptyState
                icon={PinIcon}
                title="Nothing pinned"
                description="Pinned runs and artifacts are protected from gc and archive."
                className="py-8"
              />
            ) : (
              <div className="space-y-1.5">
                {(pins.data ?? []).map((pin) => (
                  <div
                    key={`${pin.kind}-${pin.id}`}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <Badge variant="secondary">{pin.kind}</Badge>
                    <code className="min-w-0 flex-1 truncate font-mono text-xs">
                      {pin.id}
                    </code>
                    {pin.reason && (
                      <span className="truncate text-xs text-muted-foreground">
                        {pin.reason}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        unpin.mutate(
                          { kind: pin.kind, artifact_id: pin.id },
                          {
                            onSuccess: () => toast.success(`Unpinned ${pin.id}`),
                            onError: (err) =>
                              toast.error(`Unpin failed: ${err.message}`),
                          },
                        )
                      }
                      aria-label={`Unpin ${pin.id}`}
                    >
                      Unpin
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
