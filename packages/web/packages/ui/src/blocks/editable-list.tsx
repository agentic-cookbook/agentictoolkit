"use client";

import type { ReactElement, ReactNode } from "react";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ResizableSplit } from "../components/resizable-split";
import { Input } from "../components/input";
import { Button } from "../components/button";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
import { errorMessage } from "../lib/errors";
import { TriangleAlert, X } from "lucide-react";
import { ButtonBar } from "./button-bar";
import { cn } from "../lib/utils";
import { FacetMenu } from "./facet-menu";
import { isSortable, type EditableListController } from "./use-editable-list";

/**
 * A details pane under the table, for the row the operator has selected.
 *
 * The list keeps its shape — the bar still holds every verb, the rows still carry no buttons —
 * and gains a second half: a `ResizableSplit` whose bottom pane shows ONE row in full, with the
 * divider doubling as that pane's header bar (the row's name on the left, {@link
 * EditableListDetails.actions} on the right, the disclosure at the far end). It is the same
 * composition `ListWithDetailsPane` has always used, offered to the list shape the platform
 * actually standardised on, rather than a second detail layout invented per feature.
 *
 * ONE row, because a pane is a view of a record and there is no such thing as the details of
 * three: with an empty selection it says so, and with several it asks for one. A plain row click
 * selects exactly that row (`DataTable`'s `selectOne`), so "click a row to see it" costs the
 * operator nothing, while the checkboxes keep meaning what they mean for the bar's verbs.
 */
export interface EditableListDetails<T> {
  /** The pane's body for the selected row — fields, not controls. */
  render: (row: T) => ReactNode;
  /** What the pane is called, on its header bar and to assistive tech. */
  label?: string;
  /**
   * Right-aligned controls on that header bar — Edit, Open, whatever acts on the ONE row the
   * pane is showing. Given `null` when the selection is empty or larger than one, so the caller
   * decides between hiding the control and disabling it.
   *
   * These belong to the pane, not to the row: they are the exception the no-buttons-on-rows rule
   * already names — a verb that means something for one record and nothing across a selection —
   * and putting them here keeps them at one per list instead of one per row.
   */
  actions?: (row: T | null) => ReactNode;
  /** Persist the divider position under this key, so the pane opens at the height it was left. */
  storageKey?: string;
  /** Shown in the pane while nothing is selected. */
  emptyLabel?: string;
  /** Shown in the pane while more than one row is selected. */
  manyLabel?: string;
  /**
   * How tall the table-plus-pane column stands, as a Tailwind class — a CLASS for the same
   * reason {@link EditableListProps.maxHeightClass} is one, and a DEFINITE height rather than a
   * cap because the split sizes its panes as percentages of it: against a content-sized parent
   * that percentage is circular, and the divider then drags nothing.
   */
  heightClass?: string;
}

export interface EditableListProps<T> {
  list: EditableListController<T>;
  /** Names the table for assistive tech, e.g. "Users". */
  ariaLabel: string;
  /**
   * Open the row — double-click, or Enter on the focused row. Distinct from selection, which is
   * what the BAR's actions reach: ticking three users to delete them and opening one to edit it
   * are different gestures, and a list embedded in a master/detail pane needs both.
   *
   * Omitted on a page whose rows go nowhere (admin's lists act through the bar), and the table
   * then leaves Enter to whatever encloses it.
   */
  onRowActivate?: (id: string) => void;
  /** The bar's action buttons — everything that acts on the selection or adds a row. */
  actions?: ReactNode;
  /**
   * Tick boxes on the rows, and a count in the bar. On by default because the bar's actions are
   * the model here — they act on a selection, and without one they have nothing to act on.
   *
   * Turned OFF by a list embedded in a master/detail pane, where the row's own detail is the only
   * thing you do to it: checkboxes with no action behind them are a control that answers nothing,
   * and offering a second reach for a delete the detail already carries is worse than offering
   * none.
   */
  selectable?: boolean;
  searchPlaceholder?: string;
  /** Shown when nothing is filtering and the list is empty. */
  emptyLabel?: string;
  /** Shown when a filter is in force and nothing matched. */
  emptyFilteredLabel?: string;
  loading?: boolean;
  /** Persist dragged column widths under this key, so a table remembers its layout. */
  columnWidthsKey: string;
  /**
   * How tall the scroller may grow, as a Tailwind class. A CLASS rather than a px/vh value
   * because the table's own root is the scroller, so the cap has to reach it through `className`
   * — and an arbitrary value assembled at runtime is a class Tailwind never generates.
   *
   * Ignored when {@link EditableListProps.details} is present: the table is then a pane of a
   * split that owns the height, and a cap inside it would be a second scroller nested in the
   * first — which is also how a sticky header stops sticking.
   */
  maxHeightClass?: string;
  /** Show ONE selected row in full, under the table. See {@link EditableListDetails}. */
  details?: EditableListDetails<T>;
  /**
   * A strip under the table, for what the list itself has to say about its own extent — a
   * {@link WindowFooter} on an append-only log, a caption, a count.
   *
   * NEVER a pager. The distinction is the whole design: a footer that GROWS the list leaves every
   * row already fetched filterable, while one that exchanges one slice for another puts rows the
   * operator asked for behind a control they have to know to press.
   */
  footer?: ReactNode;
  /**
   * Name a row for its selection checkbox. Omit and the table guesses — the row's first non-empty
   * string field that isn't its id — which is fine when that field is the row's name and useless
   * when it isn't: a list keyed BY its descriptive column falls through to the next field, and if
   * that one is a category every checkbox on the page reads "Select customer".
   */
  describeRow?: (row: T) => string;
  /**
   * The list's load failure, if it has one.
   *
   * With NO ROWS the list is REPLACED by the error, because the alternative is the empty state,
   * and "No provider templates yet." is a claim about the catalog that a failed request has no
   * standing to make. The two readings send an operator in opposite directions: one goes and
   * creates the row, the other retries the page.
   *
   * WITH ROWS it is a strip above the table and nothing is taken away. That distinction is not a
   * nicety. React Query leaves `data` intact when a REFETCH fails and flips `status` to error, and
   * `isLoading` is false forever once a query has succeeded once — so gating on "loading" instead
   * of "have rows" made one transient failure blank the bar, the filters, the table and every
   * action button. The likeliest moment to hit it is straight after a bulk run, which invalidates
   * the feeding query, i.e. exactly when the operator most needs to see what happened.
   */
  error?: unknown;
  /** Names the failure — "Couldn't load provider templates". Falls back to the aria label. */
  errorTitle?: string;
  /**
   * What the list has to say about its own COMPLETENESS — "showing the newest 500 of more".
   *
   * A capped list that does not say so is the same lie as an errored list rendering the empty
   * state: the operator searches, finds nothing, and reads "no such user" where the truth is
   * "not in the part I fetched". Rendered as a warning strip above the table, so it is in the way
   * of the search box rather than under the fold.
   */
  truncationNotice?: ReactNode;
  className?: string;
}

/**
 * The one shape every editable list takes — the admin site's pages, and any pane that shows the
 * same rows the same way.
 *
 * A button bar carrying the filters and every action, over a table whose columns resize and sort,
 * whose rows are one line tall and carry a selection checkbox, and which scrolls rather than
 * pages. Rows do NOT carry their own buttons: an action per row is an action repeated once per
 * row, and it forces every list into two competing models — a per-row Delete that acts on one
 * thing and a bar that acts on the selection. The bar is the model; the exceptions are the few
 * controls that genuinely belong to one row and mean nothing across a selection (a role menu, a
 * membership chip), which pages pass in a column of their own.
 *
 * Nothing here paginates. A pager plus a filter is two ways to not see a row, and the second one
 * silently defeats the first — a search that matched forty things showed the operator twenty-five
 * and hid the rest behind a control most of them never pressed. The whole matching list is on
 * screen and scrolls.
 */
export function EditableList<T>({
  list,
  ariaLabel,
  onRowActivate,
  actions,
  selectable = true,
  searchPlaceholder = "Filter",
  emptyLabel = "Nothing here.",
  emptyFilteredLabel = "Nothing matches these filters.",
  loading = false,
  columnWidthsKey,
  maxHeightClass = "max-h-[60vh]",
  details,
  footer,
  describeRow,
  error,
  errorTitle,
  truncationNotice,
  className,
}: EditableListProps<T>): ReactElement {
  const columns: DataTableColumn<T>[] = list.columns.map((col) => ({
    key: col.key,
    header: col.header,
    // `render` takes the row alone here — the table's drag context is meaningless to a list whose
    // order is a sort, never a hand-arranged one.
    render: col.render
      ? (row: T) => col.render!(row)
      : col.value
        ? (row: T) => {
            const v = col.value!(row);
            return v == null || v === "" ? (
              // An em dash, not an empty cell: "this row has no value here" is a fact worth
              // showing, and a blank reads as a column that failed to load.
              <span className="text-apt-text-dim">—</span>
            ) : (
              String(v)
            );
          }
        : undefined,
    sortable: isSortable(col),
    width: col.width,
    align: col.align,
    resizable: col.resizable,
  }));

  const title = errorTitle ?? `Couldn't load ${ariaLabel.toLowerCase()}`;

  // NOTHING TO SHOW: the list is replaced. A filter over a list that failed to load narrows
  // nothing, and an action bar over an empty table invites the operator to act on a selection that
  // cannot exist. Keyed on "are there rows", NOT on "is it loading" — see the `error` prop.
  if (error != null && list.allRows.length === 0 && !loading) {
    return (
      <Alert variant="error" className={className}>
        <TriangleAlert />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    );
  }

  // How much of the selection the operator cannot currently see. Selection deliberately survives a
  // filter change — narrowing the search must not silently drop rows ticked a keystroke ago — so
  // the set the bar's buttons act on can be larger than the set on screen, and a bulk Delete that
  // reaches rows off the end of a filter is precisely the accident this whole model exists to
  // prevent. Said out loud rather than fixed by resetting, because resetting is the other bug.
  const visibleIds = new Set(list.rows.map(list.getRowId));
  const hiddenSelected = [...list.selectedIds].filter((id) => !visibleIds.has(id)).length;

  // The one row the details pane is about. `selectedRows` is drawn from `allRows`, so a row the
  // filter is hiding still has a pane — which is right: the operator ticked it, the bar's verbs
  // still reach it, and a pane that emptied itself when the search changed would be the only part
  // of the list that disagrees about what is selected.
  const detailRow = list.selectedRows.length === 1 ? list.selectedRows[0]! : null;
  const detailsLabel = details?.label ?? "Details";

  // Inside a split the table is a PANE, not a capped block: it fills the pane and keeps its own
  // scroller (sticky header intact), and gives up the borders the split's root now draws — the
  // divider already supplies the line under it.
  const table = (
    <DataTable<T>
      columns={columns}
      rows={list.rows}
      getRowId={list.getRowId}
      loading={loading}
      emptyLabel={list.filtered ? emptyFilteredLabel : emptyLabel}
      ariaLabel={ariaLabel}
      sort={list.sort ?? undefined}
      onSortChange={list.setSort}
      autoSizeColumns
      columnWidthsKey={columnWidthsKey}
      selectedIds={selectable ? list.selectedIds : undefined}
      onSelectionChange={selectable ? list.setSelectedIds : undefined}
      onRowActivate={onRowActivate}
      showSelectionCheckboxes={selectable}
      describeRow={describeRow}
      className={cn(
        "rounded-t-none border-t-0",
        details ? "h-full rounded-none border-0" : maxHeightClass,
      )}
    />
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <ButtonBar ariaLabel={`${ariaLabel} actions`} className="rounded-t-lg border-x">
        <Input
          type="search"
          aria-label={`Filter ${ariaLabel.toLowerCase()}`}
          placeholder={searchPlaceholder}
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        {list.textFilters.map((filter) => (
          <Input
            key={filter.id}
            type="search"
            aria-label={filter.placeholder}
            placeholder={filter.placeholder}
            value={list.textFilterValues[filter.id] ?? ""}
            onChange={(e) => list.setTextFilterValue(filter.id, e.target.value)}
            className="h-8"
            style={{ width: filter.width ?? "14rem" }}
          />
        ))}
        {list.facets.map((facet) => (
          <FacetMenu
            key={facet.id}
            label={facet.label}
            options={list.facetOptions[facet.id] ?? []}
            selected={list.facetSelection[facet.id] ?? EMPTY_SET}
            onChange={(next) => list.setFacetSelection(facet.id, next)}
            labelOf={facet.labelOf}
          />
        ))}
        <div className="flex-1" />
        {/* The count is the bar's only way of saying what its buttons will act on, and it is a
            BUTTON because saying so is not enough on its own: a selection that outlives a filter
            change has to be undoable in one press, and the table's own select-all header spans
            only the visible rows, so it cannot reach the ones the filter is hiding. */}
        {selectable && list.selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-normal text-apt-text-muted"
            onClick={list.clearSelection}
            aria-live="polite"
          >
            {list.selectedIds.size} selected
            {hiddenSelected > 0 && (
              <span className="text-apt-gold">{` (${hiddenSelected} not shown)`}</span>
            )}
            <X aria-hidden className="size-3" />
            <span className="sr-only">Clear selection</span>
          </Button>
        )}
        {actions}
      </ButtonBar>

      {/* A REFETCH failed while rows are still on screen. Nothing is taken away — the rows are
          real, they are just older than the operator thinks — so this says which, rather than
          replacing a working page with an error box. */}
      {error != null && (
        <Alert variant="error" className="rounded-none border-x border-t-0">
          <TriangleAlert />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            {errorMessage(error)} — showing the last rows that loaded.
          </AlertDescription>
        </Alert>
      )}

      {truncationNotice && (
        <Alert variant="accent" className="rounded-none border-x border-t-0">
          <TriangleAlert />
          <AlertDescription>{truncationNotice}</AlertDescription>
        </Alert>
      )}

      {details ? (
        <ResizableSplit
          // The border and the bottom rounding move here from the table, so the bar, the rows,
          // the divider and the pane read as ONE card rather than two stacked ones.
          className={cn(
            "rounded-b-lg border-x border-b border-apt-border",
            details.heightClass ?? "h-[60vh]",
          )}
          storageKey={details.storageKey}
          bottomLabel={detailsLabel}
          // The bar names the row it is showing — the same thing the checkbox calls it — and
          // falls back to the pane's own name when there is no single row to name.
          header={(detailRow && describeRow?.(detailRow)) || detailsLabel}
          headerActions={details.actions?.(detailRow)}
          top={table}
          bottom={
            <div className="p-4 text-sm text-apt-text">
              {detailRow ? (
                details.render(detailRow)
              ) : (
                <span className="text-apt-text-muted">
                  {list.selectedIds.size > 1
                    ? (details.manyLabel ?? "Select a single row to see its details.")
                    : (details.emptyLabel ?? "Select a row to see its details.")}
                </span>
              )}
            </div>
          }
        />
      ) : (
        table
      )}
      {footer}
    </div>
  );
}

/** One shared empty set, so an unticked facet does not hand the menu a new identity per render. */
const EMPTY_SET: Set<string> = new Set();
