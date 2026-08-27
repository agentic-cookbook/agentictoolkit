'use client';

import * as React from 'react';

import type { LineEvent } from '../live';
import type { RunState } from '../types';
import type { RunLog } from './useRunLog';

/**
 * A run's output, as it would look in a terminal.
 *
 * This was the body of the activity pane. The pane is gone — a single-purpose column that
 * showed whichever run was most recent, beside a detail pane that showed something else —
 * and the output moved to where the thing it is about is: under the repository, or under
 * each repository in a folder. What is left here is the rendering itself, which is the part
 * both of those need and neither should own.
 *
 * A LOG, not a status widget. It renders exactly what the runner wrote, in the order it
 * wrote it, with `stderr` distinguished from `stdout` and the runner's own commentary
 * (`meta`) dimmed — because the question it answers is "what is it doing", and a summarised
 * version of that is a different, worse answer.
 */

export const STREAM_CLASS: Readonly<Record<LineEvent['stream'], string>> = {
  out: 'text-apt-text',
  err: 'text-apt-red',
  // The runner's own narration — "→ 3/11 agenticdeveloperhub" — set apart from the
  // command output it introduces, so the two are never read as one program's writing.
  meta: 'text-apt-text-muted italic',
};

export const STATE_CLASS: Readonly<Record<RunState, string>> = {
  queued: 'text-apt-text-muted',
  running: 'text-apt-blue',
  succeeded: 'text-apt-green',
  failed: 'text-apt-red',
  cancelled: 'text-apt-orange',
};

export interface LogLinesProps {
  log: RunLog;
  /** Shown in place of the lines when there are none yet. */
  emptyLabel?: string;
  /**
   * Follow the end of the output as it arrives, until the operator scrolls away from it.
   *
   * Off for a section inside a longer report: a page of eleven repositories that keeps
   * yanking itself to whichever one wrote last is unreadable, and each section is short
   * enough to read whole.
   */
  follow?: boolean;
  className?: string;
}

export function LogLines({
  log,
  emptyLabel = 'Waiting for output…',
  follow = false,
  className,
}: LogLinesProps): React.ReactElement {
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Pinned to the bottom until the operator scrolls away from it.
   *
   * A pane that always jumps to the end is unreadable during a long deploy — the moment
   * someone scrolls back to read the error that just went past, the next line yanks them
   * away again. So: follow while they are at the bottom, stop the instant they are not,
   * and resume when they come back.
   */
  const [pinned, setPinned] = React.useState(true);

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !follow || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [log.lines, follow, pinned]);

  const onScroll = React.useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    // A few pixels of slack: a fractional scrollHeight (a zoomed browser, a sub-pixel
    // line height) otherwise reads as "scrolled up" on a pane nobody has touched.
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, []);

  return (
    <div className={`flex min-h-0 min-w-0 flex-col ${className ?? ''}`}>
      <div
        ref={bodyRef}
        onScroll={follow ? onScroll : undefined}
        // `aria-live` is deliberately absent. A screen reader announcing every line of a
        // twenty-minute deploy is not accessibility, it is a denial of service; the run's
        // state is the summary worth hearing, and the log is a region to enter.
        role="log"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40"
      >
        {log.dropped > 0 ? (
          <p className="pb-1 text-apt-text-muted">
            … {log.dropped.toLocaleString()} earlier lines dropped
          </p>
        ) : null}
        {log.lines.length === 0 ? (
          <p className="text-apt-text-muted">{emptyLabel}</p>
        ) : (
          log.lines.map((line) => (
            <div
              key={line.seq}
              className={`whitespace-pre-wrap break-words ${STREAM_CLASS[line.stream]}`}
            >
              {line.text}
            </div>
          ))
        )}
        {log.error ? <p className="pt-1 text-apt-red">{log.error}</p> : null}
      </div>

      {follow && !pinned ? (
        <button
          type="button"
          onClick={() => setPinned(true)}
          className="shrink-0 border-t border-apt-border px-3 py-1 text-xs text-apt-text-muted hover:text-apt-text"
        >
          Jump to the end
        </button>
      ) : null}
    </div>
  );
}
