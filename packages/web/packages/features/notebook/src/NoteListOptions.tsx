"use client";

import { Settings } from "lucide-react";

import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@agenticdevelopertoolkit/ui/components/dropdown-menu";

import {
  PREVIEW_LINES_MAX,
  PREVIEW_LINES_MIN,
  setPreviewLines,
  usePreviewLines,
} from "./preview-lines";

const CHOICES = Array.from(
  { length: PREVIEW_LINES_MAX - PREVIEW_LINES_MIN + 1 },
  (_, i) => PREVIEW_LINES_MIN + i,
);

function choiceLabel(n: number): string {
  if (n === 0) return "No preview";
  return n === 1 ? "1 line" : `${n} lines`;
}

/**
 * The notes list's gear: how much of each note's body its row shows.
 *
 * It sits in the level's `titleActions` rather than in the button bar below the workspace
 * bar, because it is about THIS LIST'S APPEARANCE, not about which notes are in it. The bar
 * holds the axes that change the set (search, category, tags); the gear changes nothing a
 * reader would see as a different result. Keeping the two apart is what makes the `+` the
 * only thing that left this header.
 *
 * The value lives in `preview-lines.ts` — every list in the tab follows a change here
 * immediately, and it survives a reload.
 */
export function NoteListOptions() {
  const lines = usePreviewLines();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Notes list options" />}
      >
        <Settings className="adh-button__icon" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Preview lines</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={String(lines)}
          onValueChange={(next) => setPreviewLines(Number(next))}
        >
          {CHOICES.map((n) => (
            <DropdownMenuRadioItem key={n} value={String(n)}>
              {choiceLabel(n)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
