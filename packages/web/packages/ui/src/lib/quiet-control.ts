/**
 * The family's QUIET CONTROL grammar — ONE home for the "small unlabelled (or
 * lightly labelled) affordance parked in chrome" idiom: the "?" help trigger on a
 * section header or a button bar, the "+ New Organization" action on the workspace
 * bar. It sits muted until you reach for it, then brightens to full text colour.
 *
 * `flex items-center` is part of the grammar, not a caller's layout choice — it is
 * what puts a 16px icon on the baseline of the row it shares. Callers add their own
 * METRICS on top (`shrink-0`, `ml-auto`, `ml-1`, `px-1`, a `gap-*` when there is a
 * label, a `text-sm`); they must not restate the look, which is the whole point of
 * this constant.
 *
 * Keyboard focus is the family's gold ring — `focus-visible:ring-2 ring-apt-gold/40`,
 * the same pair the topic-detail chevrons, the split divider, the dialog and toast
 * close buttons, the collapse toggles and the tree rows already use — with `rounded`
 * so the ring traces a pill rather than a hard rectangle. Three call sites used to
 * suppress the UA outline and offer only `focus-visible:text-apt-text` in its place,
 * i.e. a colour change on already-small text as the sole focus indicator; three more
 * (the HelpPopover triggers) styled hover and said nothing about focus at all.
 */
export const quietControlClass =
  "flex items-center rounded text-apt-text-muted outline-none transition-colors hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
