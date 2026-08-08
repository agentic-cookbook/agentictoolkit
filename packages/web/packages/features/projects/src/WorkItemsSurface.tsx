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
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import {
  projectWorkItemsApi,
  type WorkItem,
  type WorkItemMoveTarget,
} from "@agentic-toolkit/data/projects";
import {
  projectIterationsApi,
  projectsApi,
  type EstimateScale,
  type Iteration,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { useResourceList } from "@agentic-toolkit/data";
import { FeatureTitle, useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";
import { WorkItemEditor } from "./WorkItemEditor";
import { NewWorkItemDialog } from "./NewWorkItemDialog";
import { WorkItemFilterBar } from "./WorkItemFilterBar";
import { EMPTY_FILTER, applyWorkItemFilter, isFilterActive, type WorkItemFilter } from "./filters";
import { ListView } from "./views/ListView";
import { BoardView, type BoardCardDrop } from "./views/BoardView";
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
 *    move is instantly reflected in the List too;
 *  - the board DROP: `onCardDrop(itemId, drop)` is the drag's landing — a status
 *    change (the same `onMove`) and/or a place among the card's siblings (`move`).
 *    It composes the two rather than adding a third write path, so a drag that only
 *    crosses columns behaves identically to picking the status from the card's Select.
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
  workspaceSlug,
}: {
  projectId: string;
  title: string;
  leaf: TopicLeaf;
  /** The owning workspace, because ITERATIONS are the workspace's, not the project's — one
   *  sprint holds work from every board its owner runs. Absent, the API answers with the
   *  caller's own scope, exactly as the project list does. */
  workspaceSlug?: string;
}): ReactElement {
  const [moveError, setMoveError] = useState<string | null>(null);
  // The open editor is internal state (the leaf carries the VIEW): `selectedId` is the item being
  // edited. Creating is a MODAL, not a state of this pane — the detail always shows a real,
  // selected record (see NewWorkItemDialog and the recipe's `must-create-in-modal`).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  // The narrowing, held HERE rather than in the bar, for the same reason the items are: every
  // view renders the same subset, so a filter owned by one of them would be a different list per
  // tab. It also survives switching views, which is what makes "the same 12 cards, seen five
  // ways" true — the frame remounts the pane on that navigation, so the state has to sit above
  // the view, and a filter re-typed per view would be no filter at all.
  const [filter, setFilter] = useState<WorkItemFilter>(EMPTY_FILTER);

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
  // The label vocabulary the editor SUGGESTS. Like the pickers above it fails soft to an empty
  // list: labels are typed as readily as they are browsed, so losing the suggestions costs
  // convenience, never the ability to label a card.
  const loadLabels = useCallback(
    () => projectsApi.labels(projectId).catch(() => [] as string[]),
    [projectId],
  );
  // The WORKSPACE's time-boxes, cached under the workspace rather than the project: the same list
  // answers every board its owner runs, so navigating between two projects in one workspace must
  // not re-read it. It fails soft like the pickers above — a card can always be saved without
  // being committed to a cycle.
  const loadIterations = useCallback(
    () =>
      projectIterationsApi
        .list({ workspace: workspaceSlug })
        .catch(() => [] as Iteration[]),
    [workspaceSlug],
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
  const { items: labelRows, reload: reloadLabels } = useResourceList<string>(
    `project:${projectId}:labels`,
    loadLabels,
  );
  const { items: iterationRows } = useResourceList<Iteration>(
    `workspace:${workspaceSlug ?? ""}:iterations`,
    loadIterations,
  );
  const statuses = statusRows ?? [];
  const participants = participantRows ?? [];
  const labelOptions = labelRows ?? [];
  const iterations = iterationRows ?? [];

  // The project's OWN estimate scale — what an estimate's digits mean here. Read from the record
  // rather than passed in by the host, because both hosts would otherwise have to carry it and the
  // one that forgot would silently render an unestimatable board. It is a single record, so it is
  // the plain get-with-an-alive-flag the Overview pane uses, not the list cache.
  //
  // `none` until the record answers, which is the safe way round: the pickers and columns appear
  // when the project is known to estimate, rather than flashing on a project that does not.
  const [estimateScale, setEstimateScale] = useState<EstimateScale>("none");
  useEffect(() => {
    let alive = true;
    void projectsApi.get(projectId).then((p) => {
      if (alive && p) setEstimateScale(p.estimateScale);
    });
    return () => {
      alive = false;
    };
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
  //
  // It answers whether the status was PERSISTED, because `onCardDrop` composes it:
  // a drop's place-in-the-column is a claim about the column it landed in, and if
  // the status write failed the card is not in that column, so there is no order
  // left to write. (`true` for a no-op — the card is already where it was asked to
  // be.) The Select ignores the answer; a callback returning more than its consumer
  // reads is free, whereas a second copy of this write path would not be.
  const onMove = useCallback(
    async (itemId: string, statusId: string): Promise<boolean> => {
      const current = (items ?? []).find((i) => i.id === itemId);
      if (!current || !statusId || statusId === current.statusId) return true;
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
        return true;
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
        return false;
      }
    },
    [items],
  );

  // A card was DROPPED on the board: it may have changed status, taken a new place
  // among its siblings, or both. The two halves are two writes and stay two writes —
  // status is a field on the card, order is a fractional rank the SERVER mints, and
  // the ordering endpoint deliberately refuses to re-parent or re-status anything.
  //
  // Order of operations: status first (it is the half the user sees immediately, and
  // the half that repaints optimistically), then the place. A failed status write
  // abandons the place — the slot the user pointed at was a slot in THAT column, and
  // it describes nothing in the column the card is still in.
  //
  // The rank half is NOT optimistic, and that is deliberate rather than lazy: a rank
  // is a base-62 fractional index minted by the backend beside the neighbours it read
  // under a lock, and a second implementation here would be a second source of truth
  // for the same knowledge — the very thing that makes two clients' concurrent drops
  // diverge. So the card returns to its old slot for one round-trip and settles into
  // the new one when the server names its rank. This matches the List view's
  // ReorderControl, which has always committed-then-reconciled for the same reason.
  //
  // Only `rank` is adopted from the response — never the whole row: a status move that
  // started after this drop must not be clobbered by this reply's older statusId.
  const onCardDrop = useCallback(
    async (itemId: string, drop: BoardCardDrop): Promise<void> => {
      const current = (items ?? []).find((i) => i.id === itemId);
      if (!current) return;
      setMoveError(null);

      // Absent means "the column offered no sibling to name" — not "top of the list".
      // `afterId: null` IS a real target (the top), which is why this tests presence.
      const target: WorkItemMoveTarget | null =
        drop.afterId !== undefined
          ? { afterId: drop.afterId }
          : drop.beforeId !== undefined
            ? { beforeId: drop.beforeId }
            : null;

      // The synthetic "No status" column is not a status anyone can be moved INTO, so a
      // drop there carries no status write (only a reorder among the orphans).
      if (drop.statusId !== null && drop.statusId !== current.statusId) {
        if (!(await onMove(itemId, drop.statusId))) return;
      }
      if (target === null) return;

      try {
        const saved = await projectWorkItemsApi.move(itemId, target);
        if (mounted.current) {
          setItems(
            (cur) => cur?.map((i) => (i.id === itemId ? { ...i, rank: saved.rank } : i)) ?? cur,
          );
        }
      } catch (e) {
        if (mounted.current) {
          setMoveError(e instanceof Error ? e.message : "Failed to reorder the card.");
        }
      }
    },
    [items, onMove],
  );

  // A chip or bar was DRAGGED onto new dates: the Calendar writes `dueDate` alone (a
  // day cell is one date), the Timeline writes both edges together (dragging a bar
  // MOVES the span, so its duration is preserved by construction). One writer for both
  // because it is one fact — "this item's dates are now these" — and splitting it per
  // view would put the same PATCH in two places.
  //
  // Unlike the board's rank, this one IS optimistic: a date is a value the client
  // computed in full and the server only stores, so there is no second source of truth
  // to diverge from. On failure the previous dates are put back from the snapshot taken
  // before the write, rather than re-fetched — the row we are correcting is the one we
  // changed, and a GET could answer with a newer edit we would then present as a revert.
  const onSetDates = useCallback(
    async (itemId: string, dates: { startDate?: string | null; dueDate?: string | null }) => {
      const before = (items ?? []).find((i) => i.id === itemId);
      if (!before) return;
      setMoveError(null);
      setItems((cur) => cur?.map((i) => (i.id === itemId ? { ...i, ...dates } : i)) ?? cur);
      try {
        const saved = await projectWorkItemsApi.update(itemId, dates);
        if (mounted.current) {
          // Only the dates are adopted, for the same reason the board adopts only `rank`:
          // a status move or an edit that landed while this was in flight lives on the
          // same row, and replacing the whole row would answer it with older values.
          setItems(
            (cur) =>
              cur?.map((i) =>
                i.id === itemId
                  ? { ...i, startDate: saved.startDate, dueDate: saved.dueDate }
                  : i,
              ) ?? cur,
          );
        }
      } catch (e) {
        if (mounted.current) {
          setMoveError(e instanceof Error ? e.message : "Failed to change the dates.");
          setItems(
            (cur) =>
              cur?.map((i) =>
                i.id === itemId
                  ? { ...i, startDate: before.startDate, dueDate: before.dueDate }
                  : i,
              ) ?? cur,
          );
        }
      }
    },
    [items],
  );

  // Open the shared editor for an item (from any view's row/card click).
  const onOpenItem = useCallback((id: string) => setSelectedId(id), []);

  const closeEditor = () => setSelectedId(null);

  // A saved edit reloads the shared items and returns to the active view. `reload()` always hits the
  // network, so the row just written is in the list rather than a pre-write snapshot.
  //
  // The label vocabulary reloads alongside it, because a save can GROW it: labelling a card with a
  // name nobody had used mints the keyword, and without this the label the user just invented would
  // be missing from the suggestions on the very next card they open.
  const onSaved = useCallback(async () => {
    setSelectedId(null);
    await Promise.all([reload(), reloadLabels()]);
  }, [reload, reloadLabels]);

  // A create closes the modal, refreshes the views, and OPENS the new item's detail — the record now
  // exists, so it has a detail to show (the modal only asked for what places it).
  const onCreated = useCallback(
    async (created: WorkItem) => {
      setNewOpen(false);
      await reload();
      if (mounted.current) setSelectedId(created.id);
    },
    [reload],
  );

  // What the views render. The WRITES above all still address the full set — a card can be moved
  // or re-dated while a filter hides its neighbours, and the editor's parent/relation pickers
  // must offer the whole board, not the slice someone happens to be looking at. Only the five
  // views see the subset.
  const visibleItems = useMemo(
    () => (items === null ? null : applyWorkItemFilter(items, filter)),
    [items, filter],
  );

  const selected = selectedId ? (items ?? []).find((i) => i.id === selectedId) ?? null : null;
  const showEditor = selected !== null;

  const view = asViewId(leaf.leafId);

  // The views ARE a topic list — one level of the enclosing hierarchical stack, published here so
  // the frame renders it as a rail alongside its siblings. Selecting a row re-routes to that view's
  // leaf segment (`onSelect`), re-clicking it clears back to the bare topic (`onClear`); the header
  // `+` opens the create MODAL, exactly like every other list's create affordance.
  useStackLevel({
    id: "work-items-view",
    title: "Work Items",
    items: VIEW_ITEMS,
    selectedId: view,
    // Choosing Work Items lands on the List view rather than an empty pane asking which view you
    // want — the answer is nearly always List, and it stays a normal selection (URL, breadcrumb,
    // re-click-to-clear all behave as if the row had been clicked). `opts` is forwarded so the
    // stack can REPLACE the bare-topic URL when it applies that default: the user asked for Work
    // Items, so Work Items is what Back should leave, not a stop on a pane they never saw.
    defaultSelectedId: "list",
    onSelect: (id, opts) => leaf.onSelect(id, opts),
    onClear: () => leaf.onSelect(null),
    onNew: () => setNewOpen(true),
    newLabel: "New work item",
    newActive: newOpen,
  });

  const activeView: ReactNode = useMemo(() => {
    if (visibleItems === null) {
      return <p className="text-sm text-apt-text-muted">Loading…</p>;
    }
    const items = visibleItems;
    switch (view) {
      case "list":
        // The List view is a LIST WITH DETAILS: it edits rows in place and shows the selected
        // item's whole record below, so it needs no `onOpenItem` — it never hands off to the editor.
        return (
          <ListView
            projectId={projectId}
            items={items}
            statuses={statuses}
            participants={participants}
            iterations={iterations}
            estimateScale={estimateScale}
            onChanged={reload}
          />
        );
      case "board":
        return (
          <BoardView
            items={items}
            statuses={statuses}
            participants={participants}
            estimateScale={estimateScale}
            onMove={onMove}
            onCardDrop={onCardDrop}
          />
        );
      case "table":
        return (
          <TableView
            items={items}
            statuses={statuses}
            participants={participants}
            iterations={iterations}
            estimateScale={estimateScale}
            onOpenItem={onOpenItem}
            onChanged={reload}
          />
        );
      case "timeline":
        return (
          <TimelineView
            items={items}
            onOpenItem={onOpenItem}
            onSetSpan={(id, startDate, dueDate) => onSetDates(id, { startDate, dueDate })}
          />
        );
      case "calendar":
        return (
          <CalendarView
            items={items}
            onOpenItem={onOpenItem}
            onSetDueDate={(id, dueDate) => onSetDates(id, { dueDate })}
          />
        );
      default:
        return null;
    }
  }, [
    view,
    visibleItems,
    statuses,
    participants,
    iterations,
    estimateScale,
    onOpenItem,
    onMove,
    onCardDrop,
    onSetDates,
    reload,
  ]);

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
              key={selected.id}
              projectId={projectId}
              item={selected}
              statuses={statuses}
              participants={participants}
              workItems={items ?? []}
              labelOptions={labelOptions}
              iterations={iterations}
              estimateScale={estimateScale}
              onSaved={() => void onSaved()}
              onCancel={closeEditor}
            />
          </div>
        ) : view === null ? (
          // No view chosen yet — the stack never auto-selects, so the leaf holds the hint until the
          // user picks one from the Work Items list.
          <TopicSelectHint title="Select a view to see this project's work items." />
        ) : (
          <>
            <WorkItemFilterBar
              filter={filter}
              onChange={setFilter}
              statuses={statuses}
              participants={participants}
              iterations={iterations}
              labelOptions={labelOptions}
            />
            <div className="flex items-center justify-end">
              <span className="text-sm text-apt-text-muted">
                {/* Narrowed, the count says so with BOTH numbers: "3 work items" over a board of
                    forty is indistinguishable from a board of three, and a filter someone forgot
                    they set is exactly when that matters. */}
                {items === null || visibleItems === null
                  ? ""
                  : isFilterActive(filter)
                    ? `${visibleItems.length} of ${items.length} work item${
                        items.length === 1 ? "" : "s"
                      }`
                    : `${items.length} work item${items.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {activeView}
          </>
        )}
      </section>

      {/* Create is a MODAL over the stack, never a blank leaf: the detail pane always shows a real,
          selected record. The dialog returns the created item; we refresh the views and open its
          detail. */}
      {newOpen && (
        <NewWorkItemDialog
          projectId={projectId}
          statuses={statuses}
          onClose={() => setNewOpen(false)}
          onCreated={(created) => void onCreated(created)}
        />
      )}
    </div>
  );
}
