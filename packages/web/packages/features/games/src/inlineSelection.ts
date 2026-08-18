import type { TopicLeaf } from "@agentic-toolkit/resource";

/**
 * Who owns the fifth URL segment.
 *
 * A definition's detail shows TWO inline lists — its effects and its connections — and
 * there is one leaf segment between them (`/<ws>/<gameId>/content/<defId>/<childId>`).
 * Sharing it is deliberate: an id is enough, because whichever list holds that row opens
 * it. What is NOT allowed is a list reacting to a segment that is not its own.
 *
 * `useMasterDetailForm` routes cancel and delete through `onSelect(null)`. Handed a shared
 * segment unguarded, one list's Cancel cleared the URL out from under the OTHER list —
 * whose open, dirty editor then re-hydrated to nothing. Start editing an effect, click
 * "New connection", cancel it, and the effect edit was gone.
 *
 * So a list is URL-driven only while the segment names one of its OWN rows:
 *  - it reads a foreign id as no selection (it must not open something it does not have),
 *  - and it clears the segment only when the segment is currently pointing at one of its
 *    rows — otherwise the clear belongs to the sibling and is not ours to make.
 *
 * There are THREE answers to "is this mine?", not two — and the two questions this module
 * answers want DIFFERENT ones from the third:
 *
 *  - "Should I OPEN this row?" Undecided means don't answer. Saying "not mine" is not free:
 *    a `selectedId` of null is a positive statement to `useMasterDetailForm`, which clears
 *    the draft for it, where an unchanged id falls into its own `selectedId && !row` guard
 *    and holds the draft instead. So undecided passes the segment through untouched and
 *    defers to that guard. Both lists doing so is safe for the same reason the module
 *    exists: neither can open a row it does not have.
 *  - "May I CLEAR this segment?" Undecided means no. Clearing is a positive claim of
 *    ownership, and a list cannot claim what it has not loaded — with both siblings
 *    undecided, allowing it would put the round-one defect back inside the window before
 *    the rows arrive.
 *
 * Which is why the clear is gated on `ownsSelection` — the strict answer — and only the
 * read is gated on `mine`, the lenient one.
 *
 * Kept out of the component so the rule can be tested as the rule it is.
 */
export function inlineUrlSelection<TRow>(
  leaf: TopicLeaf | undefined,
  /** This list's rows, or null while they load. */
  rows: TRow[] | null,
  getId: (row: TRow) => string,
): { selectedId: string | null; onSelect: (id: string | null) => void } | undefined {
  if (!leaf) return undefined;
  const selectedId = leaf.leafId ?? null;
  const undecided = rows === null;
  /** The strict answer: this list HAS the row the segment names, and knows it. */
  const ownsSelection =
    selectedId !== null && rows !== null && rows.some((row) => getId(row) === selectedId);
  /** The lenient one: not known to be somebody else's. */
  const mine = selectedId !== null && (undecided || ownsSelection);
  return {
    selectedId: mine ? selectedId : null,
    onSelect: (id) => {
      // A non-null id is always ours: it is the row we just selected, or the one a create
      // just saved, and claiming the segment for it is the point of a deep link. A clear
      // needs the strict answer — see this file's header.
      if (id === null && !ownsSelection) return;
      leaf.onSelect(id);
    },
  };
}
