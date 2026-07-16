/**
 * WidgetFrame — the chrome around every dashboard tile: drag-handle title
 * bar, per-widget config dialog, deep link into the full screen, remove.
 * Unknown widget ids render a placeholder tile (forward compatibility),
 * never a crash.
 */
import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRightIcon,
  PuzzleIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { useProjects } from "@/api/hooks/useProjects";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIDGET_REGISTRY } from "@/widgets/registry";
import type {
  WidgetConfigField,
  WidgetDefinition,
  WidgetInstance,
} from "@/widgets/types";

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: WidgetConfigField;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: projects } = useProjects();
  const id = `widget-config-${field.key}`;

  if (field.kind === "project") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} aria-label={field.label}>
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.kind === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} aria-label={field.label}>
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function WidgetConfigDialog({
  def,
  instance,
  open,
  onOpenChange,
  onSave,
}: {
  def: WidgetDefinition;
  instance: WidgetInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(instance.config);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configure “{def.title}”</DialogTitle>
          <DialogDescription>
            Widget settings are part of the dashboard layout and persist
            server-side.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {def.configFields.map((field) => (
            <ConfigFieldInput
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(
                Object.fromEntries(
                  Object.entries(draft).filter(([, v]) => v !== ""),
                ),
              );
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WidgetFrame({
  instance,
  onRemove,
  onConfigChange,
}: {
  instance: WidgetInstance;
  onRemove: () => void;
  onConfigChange: (config: Record<string, string>) => void;
}) {
  const def = WIDGET_REGISTRY[instance.widget];
  const [configOpen, setConfigOpen] = useState(false);

  if (!def) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-4 text-center"
        data-slot="unknown-widget"
      >
        <PuzzleIcon className="size-6 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium">
          Unknown widget “{instance.widget}”
        </p>
        <p className="text-xs text-muted-foreground">
          This tile was saved by a newer studio. It is preserved in the
          layout — remove it or upgrade.
        </p>
        <Button size="sm" variant="outline" onClick={onRemove}>
          <XIcon aria-hidden /> Remove
        </Button>
      </div>
    );
  }

  const Icon = def.icon;
  const Component = def.component;

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm"
      data-slot="widget-frame"
      data-widget={def.id}
    >
      <div className="widget-drag-handle flex shrink-0 cursor-move items-center gap-1.5 border-b bg-muted/40 px-2.5 py-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs font-medium">{def.title}</span>
        {instance.config.project && (
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {instance.config.project}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          {def.configFields.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={`Configure ${def.title}`}
              onClick={() => setConfigOpen(true)}
            >
              <Settings2Icon className="size-3.5" aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Open ${def.title}`}
            asChild
          >
            <Link to={def.deepLink(instance.config)}>
              <ArrowUpRightIcon className="size-3.5" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Remove ${def.title}`}
            onClick={onRemove}
          >
            <XIcon className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Component config={instance.config} />
      </div>
      {configOpen && (
        <WidgetConfigDialog
          def={def}
          instance={instance}
          open={configOpen}
          onOpenChange={setConfigOpen}
          onSave={onConfigChange}
        />
      )}
    </div>
  );
}
