'use client';

import * as React from 'react';

import type { ShiprClient } from '../client';
import { watchRun, type EndEvent, type LineEvent } from '../live';
import type { RunState } from '../types';

/**
 * How many lines the pane keeps.
 *
 * A `deploy` over a folder of forty repositories is forty clones and forty pushes, and the
 * browser holding every line of it in an array of objects is how a tab left open for an
 * afternoon becomes unresponsive. The OLDEST are dropped, never the newest: what an
 * operator is watching is the end, and the whole log is still one `GET /runs/:id/events`
 * away for anyone who needs the beginning.
 */
export const MAX_LINES = 5000;

export interface RunLog {
  lines: LineEvent[];
  /** The run's state, or null before the first `state` frame arrives. */
  state: RunState | null;
  /** True once the stream said `end`: there will be no more lines. */
  done: boolean;
  /** What the run ended with, when it ended while this pane was watching. */
  end: EndEvent | null;
  /** Dropped because {@link MAX_LINES} was reached — so the pane can say so rather than
   *  silently presenting a truncated log as the whole one. */
  dropped: number;
  /** A failed poll, in the backend's own words. Not fatal: the stream may still be live. */
  error: string | null;
}

const EMPTY: RunLog = {
  lines: [],
  state: null,
  done: false,
  end: null,
  dropped: 0,
  error: null,
};

/**
 * One run's output, live.
 *
 * NO INITIAL FETCH. The stream itself starts at `after=0`, and the backend's first tick
 * therefore replays the whole log in `EVENT_PAGE` chunks before it starts tailing — so a
 * pane opened on a run that finished yesterday and a pane opened on a run starting now
 * take the identical path, and there is no seam between "the page I fetched" and "the
 * lines that arrived" for a duplicate to hide in.
 *
 * `client` is read through a ref: it is recreated whenever the workspace slug changes, and
 * resubscribing the stream for that would restart a twenty-minute log from line one. The
 * run id is the only thing that identifies what this hook is watching.
 *
 * `repo` NARROWS the log to one mirror's slice of a run over a folder, SERVER-SIDE. Null —
 * the usual case — keeps everything, including the `stepId: null` narration a run emits
 * about itself ("→ 4/11 …"). A repo id is strict and drops that narration too: a folder's
 * report stacks eleven of these sections, and eleven copies of the same run-level headers
 * is the noise the sections exist to remove.
 *
 * IT USED TO BE A LIST OF STEP IDS, RESOLVED HERE AND FILTERED HERE, and that is the bug
 * this shape exists to make unrepresentable. A run opens its steps as it reaches each
 * repository, so a list captured when the pane mounted was — for a run queued half a
 * second earlier — EMPTY, and stayed empty: every line the deploy went on to write was
 * dropped, and the pane of the repository being deployed showed nothing at all until the
 * run finished (Mike: "i pressed deploy and it didn't update the details view"). Membership
 * is a question about rows that are still being written, so the side holding the rows is
 * the side that has to answer it.
 *
 * `live: false` READS THE LOG AND STOPS. A run that has already finished has a fixed number
 * of lines and nothing to wait for, and a folder's report can hold forty such sections at
 * once — forty EventSources, over a connection limit of six, to replay forty logs that were
 * never going to change. Pages until `done`, and no stream at all. Live is still the default
 * and is what a run in flight gets.
 */
export function useRunLog(
  client: ShiprClient,
  runId: string | null,
  repo: string | null = null,
  live = true,
): RunLog {
  const [log, setLog] = React.useState<RunLog>(EMPTY);
  const clientRef = React.useRef(client);
  clientRef.current = client;

  React.useEffect(() => {
    setLog(EMPTY);
    if (!runId) return;

    // The high-water mark, held in a ref rather than in state: the poll fallback reads it
    // between renders, and a stale closure over a state value would re-request from zero
    // on every tick.
    let cursor = 0;
    let closed = false;

    const append = (incoming: readonly LineEvent[]) => {
      // Seq-ordered and strictly increasing, which is what makes the poll and the stream
      // safe to run against each other: a line either side already delivered is BELOW the
      // mark and is dropped here rather than rendered twice. Everything that arrives is
      // wanted — the narrowing happened before the wire — so the mark and the render move
      // over exactly the same lines.
      const fresh = incoming.filter((l) => l.seq > cursor);
      if (fresh.length === 0) return;
      cursor = fresh[fresh.length - 1]!.seq;
      setLog((prev) => {
        const lines = [...prev.lines, ...fresh];
        const over = Math.max(0, lines.length - MAX_LINES);
        return {
          ...prev,
          lines: over ? lines.slice(over) : lines,
          dropped: prev.dropped + over,
          error: null,
        };
      });
    };

    /** One page. Answers "stop asking" — the run is done, or the request failed and the
     *  error is on screen. */
    const poll = async (): Promise<boolean> => {
      try {
        const page = await clientRef.current.events(
          runId,
          cursor,
          undefined,
          repo ?? undefined,
        );
        if (closed) return true;
        append(page.events);
        setLog((prev) => ({
          ...prev,
          state: page.state,
          done: prev.done || page.done,
          error: null,
        }));
        return page.done;
      } catch (e) {
        if (closed) return true;
        setLog((prev) => ({ ...prev, error: (e as Error).message }));
        return true;
      }
    };

    if (!live) {
      // Page to the end and stop. A pass that moves the cursor nowhere is the end whatever
      // the page says, which is what keeps this from spinning on a run that never closes.
      void (async () => {
        for (;;) {
          const before = cursor;
          const stop = await poll();
          if (closed || stop || cursor === before) return;
        }
      })();
      return () => {
        closed = true;
      };
    }

    const handle = watchRun({
      runId,
      ...(repo ? { repo } : {}),
      onLine: (line) => {
        if (!closed) append([line]);
      },
      onState: (state) => {
        if (!closed) setLog((prev) => ({ ...prev, state }));
      },
      onEnd: (end) => {
        if (!closed) setLog((prev) => ({ ...prev, done: true, end }));
      },
      onPoll: () => void poll(),
    });

    return () => {
      closed = true;
      handle.close();
    };
  }, [runId, repo, live]);

  return log;
}
