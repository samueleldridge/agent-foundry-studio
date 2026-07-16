/**
 * Catalog explorer: kind tabs → artifact list → versions → files (read-only),
 * with the confirm-gated promote / deprecate dialogs.
 */
import { useState } from "react";
import { BookOpenIcon, ArrowUpToLineIcon, ArchiveXIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useCatalog,
  useCatalogArtifact,
  useCatalogFiles,
  useDeprecate,
  usePromote,
} from "@/api/hooks/useCatalog";
import type { CatalogVersion } from "@/api/types";
import { CodeEditor, type EditorLanguage } from "@/components/CodeEditor";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatScore, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "tools", singular: "tool" },
  { value: "connections", singular: "connection" },
  { value: "retrievers", singular: "retriever" },
] as const;

function fileLanguage(path: string): EditorLanguage {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  return "text";
}

function PromoteDialog({
  target,
  open,
  onOpenChange,
}: {
  target: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const promote = usePromote();
  const [floor, setFloor] = useState("0.9");
  const [notes, setNotes] = useState("");

  const submit = () => {
    promote.mutate(
      {
        target,
        floor: Number(floor),
        strict_semver: true,
        allow_breaking: false,
        notes,
        confirm: true,
      },
      {
        onSuccess: (res) => {
          toast.success(`Promoted to ${res.catalog_ref}`, {
            description: `commit ${res.commit_sha.slice(0, 8)}`,
          });
          onOpenChange(false);
        },
        onError: (err) => toast.error(`Promote refused: ${err.message}`),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to catalog</DialogTitle>
          <DialogDescription>
            Human-gated promotion of <code className="font-mono">{target}</code>.
            The eval floor must hold; this replaces the CLI confirmation prompt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="promote-floor">Eval score floor</Label>
            <Input
              id="promote-floor"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promote-notes">Notes</Label>
            <Input
              id="promote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="why this version is promoted"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={promote.isPending}>
            {promote.isPending ? "Promoting…" : "Confirm promote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeprecateDialog({
  refName,
  version,
  open,
  onOpenChange,
}: {
  refName: string;
  version: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deprecate = useDeprecate();
  const [reason, setReason] = useState("");

  const submit = () => {
    deprecate.mutate(
      { ref: refName, version, reason, confirm: true },
      {
        onSuccess: () => {
          toast.success(`Deprecated ${refName}@${version}`);
          onOpenChange(false);
        },
        onError: (err) => toast.error(`Deprecate refused: ${err.message}`),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deprecate version</DialogTitle>
          <DialogDescription>
            Marks <code className="font-mono">{refName}@{version}</code> deprecated
            in versions.json. Consumers keep working; new pins warn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="deprecate-reason">Reason</Label>
          <Input
            id="deprecate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="superseded by v2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!reason.trim() || deprecate.isPending}
          >
            {deprecate.isPending ? "Deprecating…" : "Confirm deprecate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionRow({
  version,
  selected,
  onSelect,
  onDeprecate,
}: {
  version: CatalogVersion;
  selected: boolean;
  onSelect: () => void;
  onDeprecate: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2",
        selected && "border-primary/50 bg-accent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
      >
        <Badge variant={version.deprecated ? "fail" : "secondary"} className="font-mono">
          {version.version}
        </Badge>
        <span className="truncate text-xs text-muted-foreground">
          {version.deprecated
            ? `deprecated: ${version.deprecation_reason ?? "no reason recorded"}`
            : (version.notes ?? "")}
        </span>
      </button>
      <span className="shrink-0 text-xs text-muted-foreground">
        score {formatScore(version.eval_score)}
        {version.created_at && ` · ${formatRelativeTime(version.created_at)}`}
      </span>
      {!version.deprecated && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeprecate}
          aria-label={`Deprecate ${version.version}`}
        >
          <ArchiveXIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

export function CatalogScreen() {
  const [kind, setKind] = useState<string>("tools");
  const [artifact, setArtifact] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [deprecateTarget, setDeprecateTarget] = useState<string | null>(null);

  const { data: entries, isLoading, error } = useCatalog(kind);
  const { data: detail } = useCatalogArtifact(kind, artifact);
  const { data: files } = useCatalogFiles(kind, artifact, version);

  const singular = KINDS.find((k) => k.value === kind)?.singular ?? kind;
  const currentFile =
    (files?.files ?? []).find((f) => f.path === selectedFile) ?? files?.files?.[0] ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog"
        description="Shared, versioned artifacts. Browsing is read-only; promotion is human-gated."
        actions={
          artifact ? (
            <Button variant="outline" onClick={() => setPromoteOpen(true)}>
              <ArrowUpToLineIcon aria-hidden /> Promote…
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={kind}
        onValueChange={(v) => {
          setKind(v);
          setArtifact(null);
          setVersion(null);
          setSelectedFile(null);
        }}
      >
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k.value} value={k.value}>
              {k.value}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <ErrorState error={error} title="Could not load catalog" />
      ) : isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (entries ?? []).length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title={`No ${kind} in the catalog`}
          description={`Promote a project ${singular} to make it shareable.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_20rem_1fr]">
          <div className="space-y-1" aria-label={`${kind} in catalog`}>
            {(entries ?? []).map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => {
                  setArtifact(entry.name);
                  setVersion(entry.latest ?? null);
                  setSelectedFile(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                  artifact === entry.name && "border-primary/50 bg-accent font-medium",
                )}
              >
                <span className="truncate font-mono">{entry.name}</span>
                <Badge variant="muted">{(entry.versions ?? []).length}v</Badge>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {!artifact ? (
              <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                Select an artifact to see its versions.
              </p>
            ) : (
              (detail?.versions ?? []).map((v) => (
                <VersionRow
                  key={v.version}
                  version={v}
                  selected={version === v.version}
                  onSelect={() => {
                    setVersion(v.version);
                    setSelectedFile(null);
                  }}
                  onDeprecate={() => setDeprecateTarget(v.version)}
                />
              ))
            )}
          </div>

          <div className="min-w-0 space-y-2">
            {!files ? (
              <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                Select a version to browse its files.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  {(files.files ?? []).map((f) => (
                    <Button
                      key={f.path}
                      variant={currentFile?.path === f.path ? "secondary" : "ghost"}
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => setSelectedFile(f.path)}
                    >
                      {f.path}
                    </Button>
                  ))}
                </div>
                {currentFile && (
                  <div className="h-[48vh] overflow-hidden rounded-lg border">
                    <CodeEditor
                      value={currentFile.content}
                      language={fileLanguage(currentFile.path)}
                      readOnly
                      className="h-full"
                      aria-label={`Read-only view of ${currentFile.path}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {artifact && (
        <PromoteDialog
          target={`${singular}:${artifact}`}
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
        />
      )}
      {artifact && deprecateTarget && (
        <DeprecateDialog
          refName={`catalog/${artifact}`}
          version={deprecateTarget}
          open={deprecateTarget !== null}
          onOpenChange={(open) => !open && setDeprecateTarget(null)}
        />
      )}
    </div>
  );
}
