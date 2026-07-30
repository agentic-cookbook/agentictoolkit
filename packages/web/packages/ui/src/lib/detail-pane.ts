/**
 * Marks the detail pane each hierarchical stack is CURRENTLY showing: `live` on the real one,
 * `ghost` on a crossfade's outgoing DOM snapshot (HTDV clones its pane on the way out — see
 * `DetailCrossfade` in `blocks/hierarchical-topic-detail`). Exactly one `live` pane exists at
 * any instant, mid-fade included.
 *
 * It exists because the ghost is invisible to the accessibility tree (`aria-hidden` + `inert`)
 * but plainly there in the DOM, so anything walking the DOM directly — `getByLabel`/`getByText`,
 * `querySelectorAll`, a screenshot differ — finds two of everything the pane holds for the ~220ms
 * the fade lasts. Scope to `LIVE_DETAIL_PANE` and that ambiguity is gone by construction, without
 * every caller having to know a crossfade exists.
 *
 * Both stacks carry it (HMDV has no clone, but a locator shouldn't have to care which stack is
 * mounted — that's the whole point of the platform flag choosing between them).
 *
 * This is a plain string module, deliberately free of React, so a Playwright spec running in Node
 * can import the selector from the same place the components stamp it, instead of copying the
 * literal into every e2e suite.
 */
export const DETAIL_PANE_ATTR = "data-detail-pane"

/** Ready-made selector for the pane the user is actually looking at. See {@link DETAIL_PANE_ATTR}. */
export const LIVE_DETAIL_PANE = `[${DETAIL_PANE_ATTR}="live"]`
