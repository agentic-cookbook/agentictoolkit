"use client";

import { type ReactElement } from "react";
import { cn } from "@agenticdevelopertoolkit/ui/lib/utils";

/**
 * A work item's KEY (`ADH-42`) — the short human name a card is quoted by in a branch name, a
 * PR title, or out loud. One component rather than a span per view, because a key is the same
 * object wherever it appears and the whole value of it is that it looks the same everywhere: a
 * reader recognises `ADH-42` on the board, in the table, and at the top of the detail pane as
 * ONE thing.
 *
 * Rendered in the platform's identifier metaphor — monospace, dimmed, non-wrapping — the same
 * treatment an rdid gets on a user card, because a key IS an identifier and reads as one. It
 * carries no tone deliberately: a Badge would imply a status the key does not have.
 *
 * A card whose project has no prefix yet has `itemKey === ""`. That renders NOTHING (not a dash,
 * not a placeholder): a missing name is absence, and a dash in the key slot reads like a key
 * whose value is "—".
 */
export function ItemKey({
  itemKey,
  className,
}: {
  /** The rendered key from the backend (`WorkItem.itemKey`); "" when unassigned. */
  itemKey: string;
  className?: string;
}): ReactElement | null {
  if (!itemKey) return null;
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap font-mono text-xs text-apt-text-dim",
        className,
      )}
    >
      {itemKey}
    </span>
  );
}
