/**
 * Providers — per-provider API keys + model browser (backend docs/72 §
 * Provider panel).
 *
 * Keys are stored SERVER-side (<FOUNDRY_HOME>/studio/credentials.env,
 * 0600) and layered under real env vars — the status endpoint only ever
 * reports {set, source, last4}; no key value reaches the browser.
 */
import { useState } from "react";
import {
  BrainIcon,
  CheckCircle2Icon,
  CpuIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteProviderKey,
  useProviderKeys,
  useProviders,
  useSaveProviderKey,
  useVerifyProviderKey,
} from "@/api/hooks/useProviders";
import type {
  ProviderInfo,
  ProviderKeyStatus,
  ProviderKeyVerifyResult,
} from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTokens } from "@/lib/format";

/** Currency with at least two decimals ($2.50, not $2.5), keeping extra
 * precision for sub-cent rates ($0.075). */
function usd(perMillion: number): string {
  return `$${perMillion.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function KeyStatusBadge({ status }: { status: ProviderKeyStatus }) {
  if (status.source === "studio") {
    return (
      <Badge variant="ok">
        <KeyRoundIcon aria-hidden />
        studio key{status.last4 ? ` ·…${status.last4}` : ""}
      </Badge>
    );
  }
  if (status.source === "environment") {
    return (
      <Badge variant="ok">
        <ShieldCheckIcon aria-hidden />
        {`from environment · ${status.var_name}`}
      </Badge>
    );
  }
  return <Badge variant="warn">no key</Badge>;
}

function VerifyResult({ result }: { result: ProviderKeyVerifyResult }) {
  return (
    <p
      className={`flex items-center gap-1.5 text-xs ${
        result.ok ? "text-ok" : "text-fail"
      }`}
      data-slot="verify-result"
    >
      {result.ok ? (
        <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <XCircleIcon className="size-3.5 shrink-0" aria-hidden />
      )}
      {result.detail}
      {result.ok && result.status_code != null && ` (HTTP ${result.status_code})`}
    </p>
  );
}

function KeyPanel({
  provider,
  status,
}: {
  provider: ProviderInfo;
  status: ProviderKeyStatus | undefined;
}) {
  const [draft, setDraft] = useState("");
  const [verifyResult, setVerifyResult] =
    useState<ProviderKeyVerifyResult | null>(null);
  const save = useSaveProviderKey(provider.name);
  const remove = useDeleteProviderKey(provider.name);
  const verify = useVerifyProviderKey(provider.name);
  const inputId = `${provider.name}-api-key`;

  const onSave = () => {
    save.mutate(draft, {
      onSuccess: () => {
        setDraft("");
        setVerifyResult(null);
        toast.success(`${provider.label} key saved`);
      },
      onError: (err) => toast.error(`Save failed: ${err.message}`),
    });
  };

  const onClear = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        setVerifyResult(null);
        toast.success(`${provider.label} key removed`);
      },
      onError: (err) => toast.error(`Clear failed: ${err.message}`),
    });
  };

  const onVerify = () => {
    setVerifyResult(null);
    verify.mutate(undefined, {
      onSuccess: setVerifyResult,
      onError: (err) => toast.error(`Verify failed: ${err.message}`),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {status ? <KeyStatusBadge status={status} /> : <Skeleton className="h-5 w-20" />}
        <Badge variant="outline" className="font-mono">
          {provider.credentials_env}
        </Badge>
      </div>
      {status?.source === "environment" && (
        <p className="text-xs text-muted-foreground">
          loaded from the backend process env — e.g. the repo's .env; manage it
          there
        </p>
      )}
      <Label htmlFor={inputId} className="sr-only">
        {provider.label} API key
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            status?.set ? "Replace key…" : `${provider.credentials_env} value`
          }
        />
        <Button
          onClick={onSave}
          disabled={!draft.trim() || save.isPending}
          aria-label={`Save ${provider.label} key`}
        >
          Save
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onVerify}
          disabled={!status?.set || verify.isPending}
          aria-label={`Verify ${provider.label} key`}
        >
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={status?.source !== "studio" || remove.isPending}
          aria-label={`Clear ${provider.label} key`}
        >
          <Trash2Icon aria-hidden />
          Clear
        </Button>
      </div>
      {verifyResult && <VerifyResult result={verifyResult} />}
    </div>
  );
}

function ModelTable({ provider }: { provider: ProviderInfo }) {
  const models = provider.models ?? [];
  if (models.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Model</TableHead>
          <TableHead>Context</TableHead>
          <TableHead>Max output</TableHead>
          <TableHead>Capabilities</TableHead>
          <TableHead>Pricing / 1M</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((model) => (
          <TableRow key={model.id}>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-xs">{model.id}</code>
                {model.reasoning && (
                  <Badge variant="secondary">
                    <BrainIcon aria-hidden />
                    reasoning
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTokens(model.context_window)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTokens(model.max_output_tokens)}
            </TableCell>
            <TableCell>
              <div className="flex max-w-64 flex-wrap gap-1">
                {(model.capabilities ?? []).map((cap) => (
                  <Badge key={cap} variant="muted" className="font-mono">
                    {cap}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {usd(model.pricing.input_per_1m)} in ·{" "}
              {usd(model.pricing.output_per_1m)} out
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmbeddingTable({ provider }: { provider: ProviderInfo }) {
  const models = provider.embedding_models ?? [];
  if (models.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Embedding models
      </p>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Model</TableHead>
            <TableHead>Dimensions</TableHead>
            <TableHead>Max input</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Pricing / 1M</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => (
            <TableRow key={model.id}>
              <TableCell>
                <code className="font-mono text-xs">{model.id}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {model.dimensions}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatTokens(model.max_input_tokens)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {model.max_batch_size}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {usd(model.input_per_1m)} in
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProviderCard({
  provider,
  status,
}: {
  provider: ProviderInfo;
  status: ProviderKeyStatus | undefined;
}) {
  return (
    <Card data-slot="provider-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CpuIcon className="size-4 text-muted-foreground" aria-hidden />
          {provider.label}
        </CardTitle>
        <div className="flex gap-1.5">
          <Badge variant="muted">
            {provider.kind === "embedder" ? "embeddings" : "LLM"}
          </Badge>
          {provider.stub && <Badge variant="outline">stub</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider.stub ? (
          <p className="text-sm text-muted-foreground">{provider.note}</p>
        ) : (
          <>
            <KeyPanel provider={provider} status={status} />
            <div className="overflow-x-auto">
              <ModelTable provider={provider} />
            </div>
            <div className="overflow-x-auto">
              <EmbeddingTable provider={provider} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProvidersScreen() {
  const { data: providers, isLoading, error } = useProviders();
  const { data: keys } = useProviderKeys();
  const statusByProvider = new Map(
    (keys ?? []).map((row) => [row.provider, row]),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Providers"
        description="API keys and the model catalog per provider — keys are stored server-side (never returned to the browser) and real environment variables always win."
      />
      {error ? (
        <ErrorState error={error} title="Could not load providers" />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (providers ?? []).length === 0 ? (
        <EmptyState
          icon={CpuIcon}
          title="No providers registered"
          description="The backend reported no provider adapters — check the control plane's provider manifest."
        />
      ) : (
        <div className="space-y-4">
          {(providers ?? []).map((provider) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              status={statusByProvider.get(provider.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
