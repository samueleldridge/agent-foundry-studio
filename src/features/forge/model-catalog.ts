/**
 * Key-aware model catalog for the forge launch form: joins
 * GET /api/providers (capability manifests) with GET /api/providers/keys
 * (key status) into grouped CHAT-model options (embedding models
 * excluded). Selection values keep the "<provider>/<model>" wire shape.
 */
import { useProviderKeys, useProviders } from "@/api/hooks/useProviders";
import type { ProviderInfo, ProviderModelInfo } from "@/api/types";

/** Mirrors the backend's DEFAULT_META_MODEL_BINDING (docs/60 § model choice). */
export const DEFAULT_META_BINDING = "openai/gpt-5-mini";

export interface ModelGroup {
  provider: ProviderInfo;
  models: ProviderModelInfo[];
  /** Key present via studio-managed store OR environment. */
  keyed: boolean;
}

export interface ModelCatalog {
  /** Providers that ship at least one chat model, manifest order. */
  groups: ModelGroup[];
  /** Both queries settled — until then, don't block or default anything. */
  ready: boolean;
  /** At least one chat-capable provider has a usable key. */
  hasAnyKey: boolean;
  /**
   * "<provider>/<model>" to preselect: the backend's default meta binding
   * when its provider key is set (and the model is listed), else the
   * first model of the first keyed provider, else "".
   */
  defaultBinding: string;
}

export function useModelCatalog(): ModelCatalog {
  const providers = useProviders();
  const keys = useProviderKeys();

  const keyed = new Set(
    (keys.data ?? [])
      .filter(
        (k) => k.set && (k.source === "studio" || k.source === "environment"),
      )
      .map((k) => k.provider),
  );
  const groups: ModelGroup[] = (providers.data ?? [])
    .map((provider) => ({
      provider,
      models: provider.models ?? [],
      keyed: keyed.has(provider.name),
    }))
    .filter((g) => g.models.length > 0);

  const available = groups.filter((g) => g.keyed);
  const hasAnyKey = available.length > 0;

  const [defaultProvider, defaultModel] = DEFAULT_META_BINDING.split("/");
  const metaDefault = available.find(
    (g) =>
      g.provider.name === defaultProvider &&
      g.models.some((m) => m.id === defaultModel),
  );
  const firstModel = available[0]?.models[0];
  const defaultBinding = metaDefault
    ? DEFAULT_META_BINDING
    : available[0] && firstModel
      ? `${available[0].provider.name}/${firstModel.id}`
      : "";

  return {
    groups,
    ready: providers.data !== undefined && keys.data !== undefined,
    hasAnyKey,
    defaultBinding,
  };
}

/** Context-window chip: 200000 → "200k ctx", 1_000_000 → "1M ctx". */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M ctx`;
  }
  return `${Math.round(tokens / 1000)}k ctx`;
}
