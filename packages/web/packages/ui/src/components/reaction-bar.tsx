"use client";

import * as React from "react";
import { SmilePlus } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * The emoji reactions on ONE subject — a row of count chips plus a small palette for adding one.
 *
 * Presentational, like every component in this package: the caller fetches the tallies and
 * performs the toggle (data lives in the app, never here). That is what lets one bar serve a
 * work-item comment, a discussion post, or anything else the backend's polymorphic reaction
 * store can name — the component knows about emoji and counts, not about what was reacted to.
 *
 * A chip is a TOGGLE, not a counter: pressing one you are already part of takes your reaction
 * back. `aria-pressed` is what says so, and it is also what a screen reader reads out — hence
 * the chip's accessible name states the emoji, the count, and nothing about "clicking".
 */

/** How one emoji stands on the subject, from the viewer's side. */
export interface ReactionBarItem {
  emoji: string;
  count: number;
  /** true when the viewer is one of the reactors — the chip renders as pressed. */
  mine: boolean;
}

/** A small, sensible palette. Exported so a host can start from it rather than invent one, and
 *  so the default is a single fact rather than a literal repeated per surface. Deliberately
 *  short: a long grid is a picker, and a picker is a different component. */
export const DEFAULT_REACTIONS: readonly string[] = ["👍", "🎉", "👀", "🙏", "😄", "❤️"];

export function ReactionBar({
  reactions,
  onToggle,
  choices = DEFAULT_REACTIONS,
  busy = false,
  disabled = false,
  subjectLabel,
  className,
}: {
  /** The subject's tallies, in the order they should read. */
  reactions: ReactionBarItem[];
  /** Add the emoji when the viewer has not reacted with it, take it back when they have. */
  onToggle: (emoji: string) => void;
  /** What the palette offers. Emoji already on the subject stay offered — picking one is the
   *  same toggle as pressing its chip, so the palette never has to explain a missing entry. */
  choices?: readonly string[];
  /** A write is in flight: everything is inert, but nothing is hidden or re-ordered. */
  busy?: boolean;
  /** The viewer may not react at all (e.g. signed out) — the counts still show. */
  disabled?: boolean;
  /** Names the subject in the controls' accessible labels ("React to Ada's comment"). */
  subjectLabel: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const inert = busy || disabled;

  return (
    <div
      data-slot="reaction-bar"
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {reactions.map((r) => (
        <Button
          key={r.emoji}
          type="button"
          variant={r.mine ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count} on ${subjectLabel}`}
          disabled={inert}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "rounded-full border px-2",
            r.mine ? "border-apt-gold" : "border-apt-border",
          )}
        >
          {/* The glyph is decorative here — the count beside it and the label above carry the
              meaning, so a reader is not told the emoji's CLDR name twice. */}
          <span aria-hidden="true">{r.emoji}</span>
          <span className="tabular-nums text-apt-text-dim">{r.count}</span>
        </Button>
      ))}
      {disabled ? null : (
        <Popover open={open} onOpenChange={setOpen}>
          {/* The trigger is the popover primitive itself, styled inline — the sibling
              OptionMenu / SectionHeader idiom — rather than a Button wrapped in it, which
              would nest two focusable elements. */}
          <PopoverTrigger
            aria-label={`React to ${subjectLabel}`}
            disabled={inert}
            className="flex size-6 items-center justify-center rounded-full text-apt-text-muted outline-none transition-colors hover:bg-apt-surface-2 hover:text-apt-text focus-visible:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SmilePlus size={14} aria-hidden />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1.5" align="start">
            <div className="flex items-center gap-0.5">
              {choices.map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`React ${emoji} to ${subjectLabel}`}
                  onClick={() => {
                    setOpen(false);
                    onToggle(emoji);
                  }}
                >
                  <span aria-hidden="true">{emoji}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
