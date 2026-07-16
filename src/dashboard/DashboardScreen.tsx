/**
 * Dashboard — composable widget grid (react-grid-layout, 12 columns):
 * add / remove / drag / resize / per-widget config; multiple named boards;
 * layouts persist via `PUT /api/layouts` (debounced, server-side — they
 * survive reloads, browser resets, and studio restarts).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { GridLayout, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import {
  LayoutGridIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useLayouts, useSaveLayouts } from "@/api/hooks/useLayouts";
import type { LayoutsDocument } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
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
import { WIDGET_REGISTRY } from "@/widgets/registry";
import type { DashboardsDoc } from "@/widgets/types";
import { cn } from "@/lib/utils";
import {
  addBoard,
  addWidgetTo,
  applyGridLayout,
  coerceDoc,
  removeBoard,
  removeWidgetFrom,
  resetBoard,
  updateWidgetConfig,
} from "./dashboards";
import { WidgetFrame } from "./WidgetFrame";

const SAVE_DEBOUNCE_MS = 800;

/** Local doc state + debounced server persistence. */
function usePersistedDashboards() {
  const layouts = useLayouts();
  const save = useSaveLayouts();
  const [doc, setDoc] = useState<DashboardsDoc | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // TanStack Query guarantees `mutate` is a stable reference.
  const saveMutate = save.mutate;

  // Adopt the server document once it loads (defaults if absent/empty).
  useEffect(() => {
    if (layouts.data !== undefined && doc === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot adoption of the fetched document
      setDoc(coerceDoc(layouts.data));
    }
  }, [layouts.data, doc]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback(
    (next: DashboardsDoc) => {
      setDoc((prev) => {
        if (next === prev) return prev;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          saveMutate(next as unknown as LayoutsDocument);
        }, SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [saveMutate],
  );

  return { layouts, doc, update, saving: save.isPending };
}

function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (widgetId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>
            Every widget is the summary form of a full screen and deep-links
            into it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(WIDGET_REGISTRY).map((def) => {
            const Icon = def.icon;
            return (
              <button
                key={def.id}
                type="button"
                className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => {
                  onAdd(def.id);
                  onOpenChange(false);
                }}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{def.title}</span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                    {def.id}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewBoardDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New dashboard</DialogTitle>
          <DialogDescription>Boards are saved server-side by name.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-board-name">Name</Label>
          <Input
            id="new-board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ops board"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={name.trim() === ""}
            onClick={() => {
              onCreate(name);
              setName("");
              onOpenChange(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoardGrid({
  doc,
  boardName,
  update,
}: {
  doc: DashboardsDoc;
  boardName: string;
  update: (next: DashboardsDoc) => void;
}) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 1080 });
  const board = doc.dashboards[boardName];
  if (!board) return null;

  const layout: Layout = board.widgets.map((w) => {
    const def = WIDGET_REGISTRY[w.widget];
    return {
      i: w.id,
      ...w.layout,
      minW: def?.minSize.w,
      minH: def?.minSize.h,
    };
  });

  return (
    <div ref={containerRef} data-slot="dashboard-grid">
      <GridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols: 12, rowHeight: 80, margin: [12, 12] }}
        dragConfig={{ handle: ".widget-drag-handle" }}
        onLayoutChange={(next) => update(applyGridLayout(doc, boardName, next))}
      >
        {board.widgets.map((w) => (
          <div key={w.id}>
            <WidgetFrame
              instance={w}
              onRemove={() => update(removeWidgetFrom(doc, boardName, w.id))}
              onConfigChange={(config) =>
                update(updateWidgetConfig(doc, boardName, w.id, config))
              }
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}

export function DashboardScreen() {
  const { layouts, doc, update, saving } = usePersistedDashboards();
  const [addOpen, setAddOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);

  if (layouts.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <ErrorState error={layouts.error} title="Could not load dashboard layouts" />
      </div>
    );
  }
  if (layouts.isLoading || doc === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const boardNames = Object.keys(doc.dashboards);
  const active = doc.active in doc.dashboards ? doc.active : boardNames[0]!;
  const board = doc.dashboards[active]!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={saving ? "Saving layout…" : "Layouts persist server-side."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => update(resetBoard(doc, active))}>
              <RotateCcwIcon aria-hidden /> Reset board
            </Button>
            {boardNames.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Delete board ${active}`}
                onClick={() => update(removeBoard(doc, active))}
              >
                <Trash2Icon aria-hidden /> Delete board
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon aria-hidden /> Add widget
            </Button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-center gap-1 border-b pb-2"
        role="tablist"
        aria-label="Dashboards"
      >
        {boardNames.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === active}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              name === active && "bg-muted font-medium text-foreground",
            )}
            onClick={() => update({ ...doc, active: name })}
          >
            {name}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-label="New dashboard"
          onClick={() => setNewBoardOpen(true)}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>

      {board.widgets.length === 0 ? (
        <EmptyState
          icon={LayoutGridIcon}
          title="Empty board"
          description="Add widgets to compose this dashboard — chat, forge console, charts, approvals, anything."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon aria-hidden /> Add widget
            </Button>
          }
        />
      ) : (
        <BoardGrid doc={doc} boardName={active} update={update} />
      )}

      <AddWidgetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(widgetId) => update(addWidgetTo(doc, active, widgetId))}
      />
      <NewBoardDialog
        open={newBoardOpen}
        onOpenChange={setNewBoardOpen}
        onCreate={(name) => update(addBoard(doc, name))}
      />
    </div>
  );
}
