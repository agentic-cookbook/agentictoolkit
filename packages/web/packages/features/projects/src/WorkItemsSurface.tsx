"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  List,
  LayoutGrid,
  Table,
  GanttChartSquare,
  CalendarDays,
} from "lucide-react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import {
  projectsApi,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { useResourceList } from "@agentic-toolkit/data";
import { FeatureTitle, useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";
import { WorkItemEditor } from "./WorkItemEditor";
import { ListView } from "./views/ListView";
import { BoardView } from "./views/BoardView";
import { TableView } from "./views/TableView";
import { TimelineView } from "./views/TimelineView";
import { CalendarView } from "./views/CalendarView";

/**
 * The Work Items surface (4e): the five interchangeable VIEWS — List, Board,
 * Table, Timeline, Calendar — over ONE shared work-item query. It loads the
 * project's work items (+ statuses + participants) ONCE, holds the items in state,
 * and owns the two shared concerns so every view stays in sync:
 *
 *  - the WorkItemEditor: any view calls `onOpenItem(id)` (or the header `+`) and the
 *    surface swaps the active view for the editor; a save reloads the shared items
 *    so List and Board repaint together;
 *  - the status move: `onMove(itemId, statusId)` does the optimistic-with-revert
 *    PATCH on the shared items (lifted from the old ProjectBoardPane), so a Board
 *    move is instantly reflected in the List too.
 *
 * The views are a "Work Items" TOPIC LIST — a level of the one hierarchical stack,
 * published via {@link useStackLevel} — not a tab bar inside the leaf. A nested tab
 * shell in a detail pane is exactly the "bolted-on arrangement" the one-stack rule
 * forbids (see the hierarchical-topic-detail recipe: "every list anywhere is a level
 * of the single stack; the deepest pane is only ever a detail"). The active view is
 * the deep-linkable leaf segment, so the URL grammar is unchanged
 * (…/<project>/work-items/<view>); picking a view is just that level's selection.
 *
 * Per the stack's no-auto-select rule, landing on Work Items selects NO view: the
 * list shows with nothing focused and the detail holds an empty hint until the user
 * picks one.
 */

/* ── View catalog ─────────────────────────────────────────────────────────── */

const VIEWS = [
  { id: "list", label: "List", icon: <List size={16} aria-hidden /> },
  { id: "board", label: "Board", icon: <LayoutGrid size={16} aria-hidden /> },
  { id: "table", label: "Table", icon: <Table size={16} aria-hidden /> },
  { id: "timeline", label: "Timeline", icon: <GanttChartSquare size={16} aria-hidden /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays size={16} aria-hidden /> },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];
const VIEW_IDS = VIEWS.map((v) => v.id) as readonly string[];

/** The rows of the "Work Items" level — module scope, so their identity is stable. */
const VIEW_ITEMS = VIEWS.map(({ id, label, icon }) => ({ id, label, icon }));

/** The URL's leaf segment as a view id, or null when it names none (no auto-select). */
function asViewId(value: string | null): ViewId | null {
  return value !== null && VIEW_IDS.includes(value) ? (value as ViewId) : null;
}

/* ── Surface ──────────────────────────────────────────────────────────────── */

export function WorkItemsSurface({
  projectId,
  title,
  leaf,
}: {
  projectId: string;
  title: string;
  leaf: TopicLeaf;
}): ReactElement {
  const [moveError, setMoveError] = useState<string | null>(null);
  // The open editor is internal state (the leaf now carries the VIEW): `creating`
  // for a new item, else `selectedId` for the item being edited.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The items + the pickers' options, each behind the shared tenant-scoped cache. That cache lives
  // at module scope, so it SURVIVES the remount the router performs on every navigation inside the
  // feature's catch-all route — the pane seeds from it and repaints instantly instead of blanking
  // to "Loading…" and re-reading all three lists on every click. Switching the VIEW is one of those
  // navigations, and it must not reload: every view reads the same items.
  const loadItems = useCallback(
    () => projectWorkItemsApi.listForProject(projectId),
    [projectId],
  );
  const loadStatuses = useCallback(
    () => projectsApi.statuses.list(projectId).catch(() => [] as ProjectStatus[]),
    [projectId],
  );
  const loadParticipants = useCallback(
    () => projectsApi.participants.list(projectId).catch(() => [] as ProjectParticipant[]),
    [projectId],
  );
  const {
    items,
    setItems,
    reload,
    error: loadError,
  } = useResourceList<WorkItem>(`project:${projectId}:work-items`, loadItems);
  const { items: statusRows } = useResourceList<ProjectStatus>(
    `project:${projectId}:statuses`,
    loadStatuses,
  );
  const { items: participantRows } = useResourceList<ProjectParticipant>(
    `project:${projectId}:participants`,
    loadParticipants,
  );
  const statuses = statusRows ?? [];
  const participants = participantRows ?? [];

  // Move a card to another status: optimistic (repaint immediately), then settle
  // per-item and GUARDED so overlapping moves on the SAME card never clobber each
  // other. The success reconcile only touches the card when its CURRENT statusId
  // still equals the target THIS call set — if a newer move has since changed it,
  // this stale settle is a no-op (never overwrites the newer move's result). A
  // failed move does NOT revert to the captured source statusId — while another
  // move on the same card is still in flight, that source is itself an
  // unconfirmed optimistic value, and if BOTH moves then fail, reverting to it
  // would leave the card at a status the server never persisted. Instead it
  // re-fetches the item and reconciles to the SERVER's true statusId (same
  // "newer move must not be clobbered" guard). The move lives here (not in
  // BoardView) so it mutates the shared items and the List repaints alongside
  // the Board.
  const onMove = useCallback(
    async (itemId: string, statusId: string): Promise<void> => {
      const current = (items ?? []).find((i) => i.id === itemId);
      if (!current || !statusId || statusId === current.statusId) return;
      setMoveError(null);
      setItems((cur) => cur?.map((i) => (i.id === itemId ? { ...i, statusId } : i)) ?? cur);
      try {
        const saved = await projectWorkItemsApi.update(itemId, { statusId });
        if (mounted.current) {
          // Adopt the saved row ONLY while this move is still the latest on the card
          // (its statusId is still the target we set); a newer move must not be clobbered.
          setItems(
            (cur) =>
              cur?.map((i) => (i.id === itemId && i.statusId === statusId ? saved : i)) ?? cur,
          );
        }
      } catch (e) {
        if (mounted.current) {
          setMoveError(e instanceof Error ? e.message : "Failed to move the card.");
        }
        try {
          const server = await projectWorkItemsApi.get(itemId);
          if (mounted.current && server) {
            // Reconcile to the server's true statusId ONLY while the card still sits at
            // the target we set — a newer move that already moved it on must not be
            // reverted.
            setItems(
              (cur) =>
                cur?.map((i) =>
                  i.id === itemId && i.statusId === statusId
                    ? { ...i, statusId: server.statusId }
                    : i,
                ) ?? cur,
            );
          }
        } catch {
          // The reconcile GET itself failed — leave the optimistic value in place; a
          // future move or reload() will resync it with the server.
        }
      }
    },
    [items],
  );

  // Open the shared editor for an item (from any view's row/card click).
  const onOpenItem = useCallback((id: string) => {
    setCreating(false);
    setSelectedId(id);
  }, []);

  const startCreate = () => {
    setSelectedId(null);
    setCreating(true);
  };

  const closeEditor = () => {
    setCreating(false);
    setSelectedId(null);
  };

  // A saved create/edit reloads the shared items and returns to the active view. `reload()` always
  // hits the network (it bypasses the cache's freshness window), so the item just written is in the
  // list rather than being hidden behind a still-fresh pre-write snapshot.
  const onSaved = useCallback(async () => {
    setCreating(false);
    setSelectedId(null);
    await reload();
  }, [reload]);

  const selected = selectedId ? (items ?? []).find((i) => i.id === selectedId) ?? null : null;
  const showEditor = creating || selected !== null;

  const view = asViewId(leaf.leafId);

  // The views ARE a topic list — one level of the enclosing hierarchical stack, published here so
  // the frame renders it as a rail alongside its siblings. Selecting a row re-routes to that view's
  // leaf segment (`onSelect`), re-clicking it clears back to the bare topic (`onClear`); the header
  // `+` starts a new work item, exactly like every other list's create affordance.
  useStackLevel({
    id: "work-items-view",
    title: "Work Items",
    items: VIEW_ITEMS,
    selectedId: view,
    onSelect: (id) => leaf.onSelect(id),
    onClear: () => leaf.onSelect(null),
    onNew: startCreate,
    newLabel: "New work item",
    newActive: creating,
  });

  const activeView: ReactNode = useMemo(() => {
    if (items === null) {
      return <p className="text-sm text-apt-text-muted">Loading…</p>;
    }
    switch (view) {
      case "list":
        return (
          <ListView
            items={items}
            statuses={statuses}
            participants={participants}
            onOpenItem={onOpenItem}
          />
        );
      case "board":
        return (
          <BoardView
            items={items}
            statuses={statuses}
            participants={participants}
            onMove={onMove}
          />
        );
      case "table":
        return (
          <TableView
            items={items}
            statuses={statuses}
            participants={participants}
            onOpenItem={onOpenItem}
          />
        );
      case "timeline":
        return <TimelineView items={items} onOpenItem={onOpenItem} />;
      case "calendar":
        return <CalendarView items={items} onOpenItem={onOpenItem} />;
      default:
        return null;
    }
  }, [view, items, statuses, participants, onOpenItem, onMove]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FeatureTitle title={title} />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-6 py-4">
        <ErrorText error={loadError} />
        <ErrorText error={moveError} />

        {showEditor ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <WorkItemEditor
              // Remount per target so the seeded draft is always the right item.
              key={creating ? "new" : (selected?.id ?? "new")}
              projectId={projectId}
              item={creating ? null : selected}
              statuses={statuses}
              participants={participants}
              workItems={items ?? []}
              onSaved={() => void onSaved()}
              onCancel={closeEditor}
            />
          </div>
        ) : view === null ? (
          // No view chosen yet — the stack never auto-selects, so the leaf holds the hint until the
          // user picks one from the Work Items list.
          <EmptyState title="Select a view to see this project's work items." />
        ) : (
          <>
            <div className="flex items-center justify-end">
              <span className="text-sm text-apt-text-muted">
                {items === null ? "" : `${items.length} work item${items.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {activeView}
          </>
        )}
      </section>
    </div>
  );
}
