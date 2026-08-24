"use client";

import * as React from "react";
import { ChevronRight, ChevronDown, Folder, FolderTree } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/dialog";
import { DialogActions } from "../components/dialog-actions";
import { ErrorText } from "../components/error-text";
import { Input } from "../components/input";
import { cn } from "../lib/utils";
import {
  buildCategoryTree,
  categoryKey,
  type CategoryNode,
  type CategoryTreeNode,
} from "./category-tree";

export interface CategoryPickerDialogProps {
  open: boolean;
  /** The owner's whole vocabulary. Folded here so the dialog and the rail see one graph. */
  nodes: readonly CategoryTreeNode[];
  title: string;
  description?: React.ReactNode;
  /** Confirm button copy — the VERB, because the host knows what the pick is for. */
  confirmLabel: string;
  /** Ids the user must not pick: for a move, the category itself and its descendants. */
  disabledIds?: readonly string[];
  /** Offer a "no parent" row that confirms with `null`. A move needs it (a category can be
   *  moved to the top level); a pick that must land on a real category does not. */
  allowRoot?: boolean;
  /** Copy for that row. Defaults to "Top level". */
  rootLabel?: string;
  /** Pre-selected category id, or `null` for the root row. */
  initialSelectedId?: string | null;
  /** A rejected confirm's message, shown above the buttons. The host owns it because only
   *  the host knows whether the write succeeded. */
  error?: string | null;
  busy?: boolean;
  onConfirm: (categoryId: string | null) => void;
  onCancel: () => void;
}

/** One filter hit: the node, and the trail of names above it. */
interface Hit {
  node: CategoryNode;
  trail: string;
}

/** One row the widget currently shows, in the order it renders them — a collapsed node's
 *  children are never in this list, because arrow-key movement must skip what the user
 *  cannot see, and neither is anything the filter excluded. `parentKey` is `null` at the top
 *  level, which is also how "move up" knows to stop; every filter hit is top-level, because
 *  the filter result is a flat listbox. */
interface VisibleRow {
  key: string;
  hasChildren: boolean;
  parentKey: string | null;
}

/** The "Top level" row's key. Never a real `categoryKey` — those are `path.join("/")` over
 *  backend ids, which can't collide with this sentinel. */
const ROOT_KEY = "__root__";

/** A filter hit's row key. Prefixed so it can never collide with a `categoryKey` (a
 *  single-segment path IS the bare id), which would let the two modes' rows fight over one
 *  entry in `rowRefs`. */
function optionKey(id: string): string {
  return `opt:${id}`;
}

/**
 * Every node in the forest, depth-first, each with the "/"-joined names of its ancestors.
 * Flattening is what makes a filter honest — a match three levels down is found by typing
 * its name, not by walking to it first.
 *
 * A category filed under more than one parent is a node the tree already draws once per
 * placement (see `category-tree.ts`), so this walk would surface it once per placement too —
 * two options both named "Budget", one per trail. That is correct for BROWSING (the rail
 * shows exactly the same repetition, because each placement really is a different place),
 * but wrong for a FILTER result, where the id is what gets confirmed and one id should read
 * as one option. So this dedupes by `node.id`, keeping the first (sibling-order) placement's
 * trail — the same tie-break `buildCategoryTree` itself uses for a cycle-orphaned row.
 */
function flattenWithTrails(
  roots: readonly CategoryNode[],
  above: string[] = []
): Hit[] {
  return roots.flatMap((node) => [
    { node, trail: above.join(" / ") },
    ...flattenWithTrails(node.children, [...above, node.name]),
  ]);
}

function dedupeById(hits: Hit[]): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.node.id)) continue;
    seen.add(hit.node.id);
    out.push(hit);
  }
  return out;
}

/**
 * The family's category PICKER: a modal that browses the owner's hierarchy and returns one
 * category (or the top level).
 *
 * This is the structural sibling of `CategoryField`'s chooser, and the difference is
 * the point. `CategoryField` picks a category for a DOCUMENT, where a name is already a
 * unique answer, so its chooser is flat and typing beats walking. This picks a PLACE for a
 * category — a parent — and a place cannot be expressed as a bare name, because the whole
 * question is where in the tree it sits. So the tree is the control, and the filter is the
 * shortcut rather than the other way round.
 *
 * WORDS ARE THE HOST'S: `title`, `description` and `confirmLabel` all arrive as props.
 */
export function CategoryPickerDialog({
  open,
  nodes,
  title,
  description,
  confirmLabel,
  disabledIds = [],
  allowRoot = false,
  rootLabel = "Top level",
  initialSelectedId = null,
  error = null,
  busy = false,
  onConfirm,
  onCancel,
}: CategoryPickerDialogProps): React.ReactElement {
  const [filter, setFilter] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(
    initialSelectedId
  );
  // WHICH DRAWING is selected, as a `categoryKey` (a path), beside the id `selected` that is
  // the dialog's actual answer. A category filed under two parents is two rows sharing one
  // id, so comparing on the id marked BOTH rows `aria-selected` in a single-select tree —
  // a screen reader reads two selections and a sighted user sees two highlights. `null`
  // means "no row has been clicked in tree mode", which the derived key below reads as the
  // first drawing of whatever `selected` names.
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(
    new Set()
  );
  // The tree's roving tab stop — the one row with tabIndex 0. `null` until a row has ever
  // had focus, which `activeRowKey` below reads as "use the first visible row".
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const rowRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // A reopen is a fresh question. Resetting on `open` (rather than unmounting) keeps the
  // Dialog's own exit animation, which a remount would cut off.
  //
  // `initialSelectedId` is read through a ref and is NOT a dependency. Naming it made the
  // reset fire on any change to it, guarded only by `open` — so a prop that moved while the
  // dialog was open (a background refetch reshaping the caller's state) would silently wipe
  // the typed filter, the expansion, and the row the user had already picked, mid-interaction.
  // The reset belongs to the OPEN transition, which is the only thing that makes the question
  // fresh; `open` alone says exactly that.
  const initialRef = React.useRef(initialSelectedId);
  initialRef.current = initialSelectedId;
  React.useEffect(() => {
    if (!open) return;
    setFilter("");
    setSelected(initialRef.current);
    setSelectedKey(null);
    setExpanded(new Set());
    setActiveKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above: `initialSelectedId`
    // is read through `initialRef` so that only opening resets the dialog.
  }, [open]);

  const roots = React.useMemo(() => buildCategoryTree(nodes), [nodes]);
  const forbidden = React.useMemo(() => new Set(disabledIds), [disabledIds]);

  const needle = filter.trim().toLowerCase();
  const hits = React.useMemo(
    () =>
      needle === ""
        ? []
        : dedupeById(
            flattenWithTrails(roots).filter((h) =>
              h.node.name.toLowerCase().includes(needle)
            )
          ),
    [roots, needle]
  );

  // The tree row that renders as selected: the one actually clicked, or — before any click,
  // and after a pick made in the filtered half — the first drawing of `initialSelectedId`.
  const activeSelectedKey = React.useMemo(() => {
    if (selectedKey !== null) return selectedKey;
    if (selected === null) return null;
    const find = (list: readonly CategoryNode[]): string | null => {
      for (const node of list) {
        if (node.id === selected) return categoryKey(node);
        const hit = find(node.children);
        if (hit !== null) return hit;
      }
      return null;
    };
    return find(roots);
  }, [selectedKey, selected, roots]);

  // `selected === null` means "Top level", and that is only an answer the user can be said
  // to have GIVEN while its row is on screen. Under a filter it is not rendered, so Confirm
  // used to sit enabled over a list with no highlight anywhere: filter for "Reports", see
  // one row, press Confirm without clicking it, and the category silently moved to the root.
  const pickable =
    selected === null ? allowRoot && needle === "" : !forbidden.has(selected);

  // Depth-first, exactly the order the rows render below, so ArrowDown/Up and Home/End can
  // never disagree with what is actually on screen. ONE list for both modes: the filter half
  // is a `listbox` and the unfiltered half a `tree`, and the two patterns want the same
  // roving tab stop and the same Up/Down movement — so they read the same list rather than
  // growing a second mechanism that can drift from this one. Only the tree half has depth,
  // so only it answers ArrowRight/Left, and a flat hit list simply reports no children and
  // no parent.
  const visibleRows = React.useMemo<VisibleRow[]>(() => {
    if (needle !== "") {
      return hits.map(({ node }) => ({
        key: optionKey(node.id),
        hasChildren: false,
        parentKey: null,
      }));
    }
    const out: VisibleRow[] = [];
    if (allowRoot)
      out.push({ key: ROOT_KEY, hasChildren: false, parentKey: null });
    const walk = (
      list: readonly CategoryNode[],
      parentKey: string | null
    ): void => {
      for (const node of list) {
        const key = categoryKey(node);
        const hasChildren = node.children.length > 0;
        out.push({ key, hasChildren, parentKey });
        if (hasChildren && expanded.has(key)) walk(node.children, key);
      }
    };
    walk(roots, null);
    return out;
  }, [roots, expanded, allowRoot, needle, hits]);

  // The row that actually owns tabIndex 0: the last one focus landed on, or the first
  // visible row before that has happened, or after that row scrolled out of view (collapsed
  // by an ancestor, or the filter took over the widget entirely).
  const activeRowKey = visibleRows.some((r) => r.key === activeKey)
    ? activeKey
    : visibleRows[0]?.key ?? null;

  function toggle(key: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** The WAI-ARIA tree AND listbox patterns — they agree on this much: one row owns the tab
   *  stop, and arrow keys move it and the focus together instead of making the user Tab
   *  through every row. Filtering must not take that away; a user who has just learned
   *  ArrowDown in the tree finds it dead the moment they narrow, and Tab walks every match.
   *  The two patterns differ only in ArrowRight/Left (expand/collapse), which a flat hit list
   *  answers by having no children and no parent. Enter/Space need nothing here — the rows
   *  are real `<button>`s, so native activation already selects. */
  function onRowsKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (activeRowKey === null) return;
    const index = visibleRows.findIndex((r) => r.key === activeRowKey);
    const current = visibleRows[index];
    if (!current) return;

    function focusRow(key: string): void {
      setActiveKey(key);
      rowRefs.current.get(key)?.focus();
    }

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = visibleRows[index + 1];
        if (next) focusRow(next.key);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = visibleRows[index - 1];
        if (prev) focusRow(prev.key);
        break;
      }
      case "ArrowRight": {
        if (!current.hasChildren) break;
        e.preventDefault();
        if (!expanded.has(current.key)) {
          toggle(current.key);
        } else {
          const next = visibleRows[index + 1];
          if (next && next.parentKey === current.key) focusRow(next.key);
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (current.hasChildren && expanded.has(current.key)) {
          toggle(current.key);
        } else if (current.parentKey !== null) {
          focusRow(current.parentKey);
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        const first = visibleRows[0];
        if (first) focusRow(first.key);
        break;
      }
      case "End": {
        e.preventDefault();
        const last = visibleRows[visibleRows.length - 1];
        if (last) focusRow(last.key);
        break;
      }
      default:
        break;
    }
  }

  function row(
    node: CategoryNode,
    depth: number,
    pos: number,
    size: number
  ): React.ReactElement {
    const key = categoryKey(node);
    const isOpen = expanded.has(key);
    const disabled = forbidden.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <React.Fragment key={key}>
        {/* `presentation`: this wrapper exists to put the twisty beside the row, and a plain
            `div` between a `tree` and its `treeitem`s is a generic group that breaks the
            role chain a screen reader walks. */}
        <div
          role="presentation"
          className="flex items-center"
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              // ArrowRight/Left on the row itself now expand and collapse (the WAI-ARIA
              // tree pattern), so this stays out of the tab sequence — the row below is
              // the tree's only stop, and this remains a plain pointer affordance.
              tabIndex={-1}
              // And out of the accessibility tree with it. A `tree` owns `treeitem`s and
              // groups; a button among them is an interactive control the tree pattern gives
              // keyboard users no way to reach, announced as a real control they cannot get
              // to. Nothing is lost by hiding it: the row's own `aria-expanded` carries the
              // state, and ArrowRight/Left carry the action.
              aria-hidden
              // `title`, not `aria-label`: an aria-hidden element has no accessible name to
              // give, and a tooltip is what a pointer-only affordance actually owes its user.
              title={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
              onClick={() => toggle(key)}
              className="flex size-6 shrink-0 items-center justify-center rounded text-apt-text-dim outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
            >
              {isOpen ? (
                <ChevronDown size={14} aria-hidden />
              ) : (
                <ChevronRight size={14} aria-hidden />
              )}
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            ref={(el) => {
              if (el) rowRefs.current.set(key, el);
              else rowRefs.current.delete(key);
            }}
            role="treeitem"
            tabIndex={activeRowKey === key ? 0 : -1}
            // Depth is the one fact this dialog exists to convey, and it lives only in the
            // left padding — invisible to a screen reader, which would otherwise announce a
            // three-deep row exactly like a root.
            aria-level={depth + 1}
            // Position among SIBLINGS, which is what a tree announces. Without it a reader
            // has to guess from the DOM, and every collapsed branch makes the guess wrong.
            aria-posinset={pos}
            aria-setsize={size}
            aria-selected={activeSelectedKey === key}
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-disabled={disabled || undefined}
            // A forbidden row REFUSES the click rather than taking the selection and letting
            // the confirm button go grey: selecting it would announce the row as selected and
            // disabled at once, discard whatever valid pick the user already had, and give no
            // reason for the dead button. `pickable` stays as belt-and-braces.
            onClick={() => {
              if (disabled) return;
              setSelected(node.id);
              setSelectedKey(key);
            }}
            onFocus={() => setActiveKey(key)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
              activeSelectedKey === key
                ? "bg-apt-gold/15 text-apt-text"
                : "text-apt-text-muted hover:text-apt-text",
              disabled && "opacity-40"
            )}
          >
            <Folder size={14} aria-hidden className="shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
        </div>
        {isOpen &&
          node.children.map((child, i) =>
            row(child, depth + 1, i + 1, node.children.length)
          )}
      </React.Fragment>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Input
          type="search"
          role="searchbox"
          autoFocus
          value={filter}
          aria-label="Filter categories"
          placeholder="Filter categories…"
          disabled={busy}
          onChange={(e) => setFilter(e.target.value)}
        />

        {/* The scroll box is NOT the widget: a `tree` owns `treeitem`s and a `listbox` owns
            `option`s, and the empty-state paragraph below is neither. Sitting inside the role
            it made the widget's own child list wrong — dropped by some readers, counted as an
            item by others. The role moved inward to the element that holds only rows; the
            border, the scrolling and the key handling (events bubble) stayed out here. */}
        <div
          onKeyDown={onRowsKeyDown}
          className="max-h-72 min-h-40 overflow-y-auto rounded border border-apt-border p-1"
        >
          <div
            role={needle === "" ? "tree" : "listbox"}
            aria-label="Categories"
          >
            {needle === "" ? (
              <>
                {allowRoot && (
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) rowRefs.current.set(ROOT_KEY, el);
                      else rowRefs.current.delete(ROOT_KEY);
                    }}
                    role="treeitem"
                    tabIndex={activeRowKey === ROOT_KEY ? 0 : -1}
                    aria-level={1}
                    aria-posinset={1}
                    aria-setsize={roots.length + 1}
                    aria-selected={selected === null}
                    onClick={() => {
                      setSelected(null);
                      setSelectedKey(ROOT_KEY);
                    }}
                    onFocus={() => setActiveKey(ROOT_KEY)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
                      selected === null
                        ? "bg-apt-gold/15 text-apt-text"
                        : "text-apt-text-muted hover:text-apt-text"
                    )}
                  >
                    <FolderTree size={14} aria-hidden className="shrink-0" />
                    <span className="truncate">{rootLabel}</span>
                  </button>
                )}
                {roots.map((node, i) =>
                  row(
                    node,
                    0,
                    allowRoot ? i + 2 : i + 1,
                    allowRoot ? roots.length + 1 : roots.length
                  )
                )}
              </>
            ) : (
              <>
                {hits.map(({ node, trail }, i) => {
                  const disabled = forbidden.has(node.id);
                  const key = optionKey(node.id);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      ref={(el) => {
                        if (el) rowRefs.current.set(key, el);
                        else rowRefs.current.delete(key);
                      }}
                      role="option"
                      // The same roving tab stop the tree half has: one stop for the whole
                      // listbox, moved by Arrow Up/Down, not one Tab stop per match.
                      tabIndex={activeRowKey === key ? 0 : -1}
                      aria-posinset={i + 1}
                      aria-setsize={hits.length}
                      aria-selected={selected === node.id}
                      aria-disabled={disabled || undefined}
                      onClick={() => {
                        if (disabled) return;
                        setSelected(node.id);
                        // A hit is deduped to one row per id, so there is no drawing to pin —
                        // and clearing this lets the tree half fall back to the first drawing
                        // when the filter is cleared, rather than hunting for an `opt:` key
                        // that no tree row will ever carry.
                        setSelectedKey(null);
                      }}
                      onFocus={() => setActiveKey(key)}
                      className={cn(
                        "flex w-full min-w-0 flex-col items-start rounded px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
                        selected === node.id
                          ? "bg-apt-gold/15"
                          : "hover:bg-apt-surface-2",
                        disabled && "opacity-40"
                      )}
                    >
                      <span className="truncate text-sm text-apt-text">
                        {node.name}
                      </span>
                      {trail !== "" && (
                        <span className="truncate font-mono text-xs text-apt-text-dim">
                          {trail}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
          {needle === "" && roots.length === 0 && (
            <p className="px-2 py-1 text-sm text-apt-text-dim">
              No categories yet.
            </p>
          )}
          {needle !== "" && hits.length === 0 && (
            <p className="px-2 py-1 text-sm text-apt-text-dim">
              No categories match "{filter.trim()}".
            </p>
          )}
        </div>

        <ErrorText error={error} />
        <DialogActions
          confirmLabel={confirmLabel}
          onConfirm={() => onConfirm(selected)}
          cancelLabel="Cancel"
          onCancel={onCancel}
          busy={busy}
          confirmDisabled={!pickable}
          focusOnMount={false}
        />
      </DialogContent>
    </Dialog>
  );
}
