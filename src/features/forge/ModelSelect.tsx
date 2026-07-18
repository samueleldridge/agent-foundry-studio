/**
 * Key-aware model picker for the forge launch form.
 *
 * Grouped <Select> of chat models by provider (catalog logic in
 * ./model-catalog.ts). Providers without a key are greyed out with a
 * "no key" affix linking to the Providers panel; an "Advanced: custom
 * model" toggle reveals a free-text input for unlisted models.
 */
import { Link } from "react-router";
import { KeyRoundIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatContextWindow, type ModelCatalog } from "./model-catalog";

export function ForgeModelField({
  catalog,
  value,
  onValueChange,
  customMode,
  onCustomModeChange,
  customValue,
  onCustomValueChange,
  label = "Meta-agent model",
  idPrefix = "forge-model",
}: {
  catalog: ModelCatalog;
  /** Effective "<provider>/<model>" selection (may be the default). */
  value: string;
  onValueChange: (value: string) => void;
  customMode: boolean;
  onCustomModeChange: (custom: boolean) => void;
  customValue: string;
  onCustomValueChange: (value: string) => void;
  /** Reused outside the forge (eval assistant) with its own wording. */
  label?: string;
  idPrefix?: string;
}) {
  const noKeys = catalog.ready && !catalog.hasAnyKey;

  return (
    <div className="space-y-1.5" data-slot="forge-model-field">
      <div className="flex items-center justify-between">
        <Label htmlFor={customMode ? `${idPrefix}-custom` : idPrefix}>
          {label}
        </Label>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => onCustomModeChange(!customMode)}
        >
          {customMode ? "Back to model list" : "Advanced: custom model"}
        </Button>
      </div>

      {customMode ? (
        <>
          <Input
            id={`${idPrefix}-custom`}
            value={customValue}
            onChange={(e) => onCustomValueChange(e.target.value)}
            placeholder="provider/model (unlisted)"
          />
          <p className="text-xs text-muted-foreground">
            Any <code className="font-mono">&lt;provider&gt;/&lt;model&gt;</code>{" "}
            binding — for models not in the manifest. Empty falls back to the
            backend default.
          </p>
        </>
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={idPrefix} aria-label={label}>
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {noKeys && (
              <div
                className="max-w-72 px-2 py-3 text-sm text-muted-foreground"
                data-slot="model-empty-state"
              >
                No provider API key is configured, so no model can be used.{" "}
                <Link
                  to="/providers"
                  className="text-foreground underline underline-offset-2"
                >
                  Add a key in Providers
                </Link>{" "}
                to enable launching.
              </div>
            )}
            {catalog.groups.map(({ provider, models, keyed }) => (
              <SelectGroup key={provider.name}>
                <SelectLabel>
                  {provider.label}
                  {!keyed && (
                    <span className="inline-flex items-center gap-1">
                      <KeyRoundIcon className="size-3" aria-hidden />
                      no key —{" "}
                      <Link
                        to="/providers"
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        add in Providers
                      </Link>
                    </span>
                  )}
                </SelectLabel>
                {models.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={`${provider.name}/${model.id}`}
                    disabled={!keyed}
                    meta={
                      <>
                        {model.reasoning && (
                          <Badge variant="secondary">reasoning</Badge>
                        )}
                        <Badge variant="muted">
                          {formatContextWindow(model.context_window)}
                        </Badge>
                      </>
                    }
                  >
                    <span className="font-mono text-xs">{model.id}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}

      {noKeys && (
        <p
          className="text-xs text-warn-foreground dark:text-warn"
          data-slot="no-keys-copy"
        >
          Launch is blocked: no provider API key configured. Add one in{" "}
          <Link to="/providers" className="underline underline-offset-2">
            Providers
          </Link>{" "}
          first.
        </p>
      )}
    </div>
  );
}
