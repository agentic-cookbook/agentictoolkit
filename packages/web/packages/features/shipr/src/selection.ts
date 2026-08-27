import type { NodeRef } from './tree/levels';

/**
 * What the toolbar is pointed at.
 *
 * TWO selections, not one, because they answer different questions. `focus` is the row the
 * rail has highlighted — it also decides what the detail pane shows, so it moves every time
 * someone browses. `checked` only exists while `selecting` is on, and it is a deliberate
 * batch: an operator ticking eleven repositories has said something about all eleven, and a
 * stray click on a twelfth must not join them to it.
 *
 * When both exist, CHECKED WINS. Turning select mode on is the operator saying "the buttons
 * now mean these", and letting the highlighted row silently override that is how a deploy
 * lands on the wrong repository.
 */
export interface Selection {
  focus: NodeRef | null;
  selecting: boolean;
  checked: readonly NodeRef[];
}

export const EMPTY_SELECTION: Selection = {
  focus: null,
  selecting: false,
  checked: [],
};

/** A NodeRef as one string, for a `Set` or a React key. Groups and repositories have
 *  separate id spaces, so the kind has to be in the key or a checkbox could tick two rows. */
export function nodeKey(ref: NodeRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** The rows the buttons act on: the batch if there is one, otherwise the highlighted row. */
export function targetsOf(selection: Selection): NodeRef[] {
  if (selection.selecting && selection.checked.length > 0) {
    return [...selection.checked];
  }
  return selection.focus ? [selection.focus] : [];
}

/** Tick or untick one row, preserving the order rows were ticked in — which is the order
 *  the runs are then queued in, so the log walks the list the way the operator built it. */
export function toggleChecked(
  checked: readonly NodeRef[],
  ref: NodeRef,
): NodeRef[] {
  const key = nodeKey(ref);
  const without = checked.filter((c) => nodeKey(c) !== key);
  return without.length === checked.length ? [...checked, ref] : without;
}

export function isChecked(
  checked: readonly NodeRef[],
  ref: NodeRef,
): boolean {
  const key = nodeKey(ref);
  return checked.some((c) => nodeKey(c) === key);
}
