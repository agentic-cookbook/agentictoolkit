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
  Plus,
  List,
  LayoutGrid,
  Table,
  GanttChartSquare,
  CalendarDays,
} from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@agentic-toolkit/ui/components/toggle-group";
import { Button } from "@agentic-toolkit/ui/components/button";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import {
  projectsApi,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { FeatureTitle, type TopicLeaf } from "@agentic-toolkit/resource";
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
 *  - the WorkItemEditor: any view calls `onOpenItem(id)` (or the "New work item"
 *    action) and the surface swaps the active view for the editor; a save reloads
 *    the shared items so List and Board repaint together;
 *  - the status move: `onMove(itemId, statusId)` does the optimistic-with-revert
 *    PATCH on the shared items (lifted from the old ProjectBoardPane), so a Board
 *    move is instantly reflected in the List too.
 *
 * The active view is the deep-linkable leaf (`leaf.leafId ?? "list"`); a segmented
 * ToggleGroup switches it via `leaf.onSelect(view)`. This replaces 4d's separate
 * Work Items (list) and Board topics with one topic that hosts both as views.
 * Renders inline (publishes no stack level), mirroring the sibling project panes.
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

function asViewId(value: string | null): ViewId {
  return value !== null && VIEW_IDS.includes(value) ? (value as ViewId) : "list";
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
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Load the items + the pickers' options together, ONCE per project. ResourceExplorer
  // keys the topic pane by project id, so a project switch remounts this with fresh
  // state (items null → "Loading…"); switching the VIEW does NOT reload — the
  // shared query is loaded once and every view reads the same items. `alive` drops
  // a response that resolves after unmount.
  useEffect(() => {
    let alive = true;
    Promise.all([
      projectWorkItemsApi.listForProject(projectId),
      projectsApi.statuses.list(projectId).catch(() => [] as ProjectStatus[]),
      projectsApi.participants.list(projectId).catch(() => [] as ProjectParticipant[]),
    ])
      .then(([its, ss, ps]) => {
        if (!alive) return;
        setItems(its);
        setStatuses(ss);
        setParticipants(ps);
      })
      .catch((e) => {
        if (!alive) return;
        setItems([]);
        setLoadError(e instanceof Error ? e.message : "Failed to load work items.");
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Refresh just the list after a write (create/edit), so all views repaint.
  const reload = useCallback(async () => {
    const its = await projectWorkItemsApi.listForProject(projectId);
    if (mounted.current) setItems(its);
  }, [projectId]);

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

  // A saved create/edit reloads the shared items and returns to the active view.
  const onSaved = useCallback(async () => {
    setCreating(false);
    setSelectedId(null);
    await reload();
  }, [reload]);

  const selected = selectedId ? (items ?? []).find((i) => i.id === selectedId) ?? null : null;
  const showEditor = creating || selected !== null;

  const view = asViewId(leaf.leafId);

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
        {loadError && <p className="text-sm text-apt-red">{loadError}</p>}
        {moveError && <p className="text-sm text-apt-red">{moveError}</p>}

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
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <ToggleGroup
                aria-label="Work items view"
                value={[view]}
                onValueChange={(next: string[]) => {
                  const v = next[0];
                  // Single-select: ignore the empty array from re-clicking the active item.
                  if (v && VIEW_IDS.includes(v)) leaf.onSelect(v);
                }}
              >
                {VIEWS.map(({ id, label, icon }) => (
                  <ToggleGroupItem key={id} value={id} aria-label={`${label} view`} title={label}>
                    {icon}
                    <span>{label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex items-center gap-3">
                <span className="text-sm text-apt-text-muted">
                  {items === null
                    ? ""
                    : `${items.length} work item${items.length === 1 ? "" : "s"}`}
                </span>
                <Button size="sm" onClick={startCreate}>
                  <Plus data-icon="inline-start" />
                  New work item
                </Button>
              </div>
            </div>
            {activeView}
          </>
        )}
      </section>
    </div>
  );
}
