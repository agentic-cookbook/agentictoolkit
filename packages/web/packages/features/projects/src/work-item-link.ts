// How a single work item is NAMED in a URL — the one representation, shared by the surface that
// reads it and the palette that writes it.
//
// A work item is not a level of the hierarchical stack: the stack's tail is the VIEW (…/work-items/
// board), and every view shows the same cards, so an item is a thing you open ON a view rather than
// a place beneath one. That is why it is a query param and not a sixth path segment — the segment
// would have to mean something to the rail, the breadcrumbs and the back button, and it means
// nothing to any of them.
//
// It is in the URL at all because two different callers need to agree on which card is open: the
// surface (a click, a create) and the command palette (a card on a board the user was not even
// looking at). A `useState` in the surface would leave the palette with no way to say it, deep links
// dead, and a reload showing a different pane than the address bar claims.

/** The query param naming the open work item. Read with `useSearchParam`, written with
 *  `writeSearchParams` — both from `@agenticdevelopertoolkit/ui`. */
export const WORK_ITEM_PARAM = "item";

/** Where an item opens when the caller has no view in mind. Matches the Work Items level's own
 *  `defaultSelectedId`, so arriving from the palette lands where arriving by click does. */
export const DEFAULT_WORK_ITEM_VIEW = "list";

/**
 * The full address of one work item: a project's Work Items topic, a view, and the open card.
 *
 * `basePath` is the feature's base WITH the workspace already in it (what {@link ProjectsFeature}
 * is handed) — this never invents a workspace segment, because which one is in the path is the
 * host's decision and differs between the hub and the projects site.
 */
export function workItemHref(
  basePath: string,
  projectId: string,
  itemId: string,
  view: string = DEFAULT_WORK_ITEM_VIEW,
): string {
  return `${basePath}/${projectId}/work-items/${view}?${WORK_ITEM_PARAM}=${encodeURIComponent(itemId)}`;
}
