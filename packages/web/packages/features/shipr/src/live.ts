'use client';

import { connectSse, type SseHandle } from '@agentic-toolkit/data/stream';

import { BASE } from './client';
import type { Operation, RunState, ScopeKind } from './types';

/**
 * The two live channels, as two functions.
 *
 * Both are thin: they name a URL, name the event names on it, and hand each payload to a
 * typed callback. Reconnection, the token, and the poll fallback are `connectSse`'s —
 * shipr adds nothing to that, and a private copy would be a second thing to fix when the
 * token handling changes.
 *
 * THE TWO CHANNELS SAY DIFFERENT THINGS ON PURPOSE. `watchRun` is a LOG: every line of one
 * run, in `seq` order. `watchWorkspaceRuns` is a WAKE CHANNEL: one small row per run whose
 * state moved, so the tree can put a spinner on a repository someone else's deploy is
 * walking. Sending every line of every run to every open tab would be the same data
 * multiplied by the number of people watching.
 */

/** One line of output, as `event: line` carries it. */
export interface LineEvent {
  seq: number;
  stepId: string | null;
  stream: 'out' | 'err' | 'meta';
  text: string;
  at: string;
}

/** `event: state` — the run moved. Sent only when it CHANGED, not on every poll. */
export interface StateEvent {
  state: RunState;
}

/**
 * `event: end` — there will be no more lines, and the stream is closing.
 *
 * Emitted on the first poll that finds NOTHING new, not the moment the state settles: a
 * run can finish while its last hundred lines are still being read, and ending at the
 * state change would truncate the log at exactly the interesting part.
 */
export interface EndEvent {
  state: RunState;
  summary: unknown;
  finishedAt: string | null;
}

/** `event: run` on the workspace channel — identity and state, no output. */
export interface RunTick {
  id: string;
  operation: Operation;
  scopeKind: ScopeKind;
  scopeId: string | null;
  state: RunState;
  userId: string;
  updatedAt: string;
}

export interface WatchRunOptions {
  runId: string;
  /**
   * The last `seq` already rendered. The stream resumes AFTER it, so a pane that has
   * already fetched a page from `GET /runs/:id/events` continues from where that page
   * stopped rather than replaying it.
   *
   * An automatic EventSource reconnect resumes on its own through `Last-Event-ID` — the
   * backend writes `id:` as the seq for exactly that reason — so this only matters for the
   * FIRST connection.
   */
  after?: number;
  /**
   * Narrow the stream to ONE mirror's steps -- a deploy repo id.
   *
   * Server-side, and deliberately not a filter this side of the wire: a run opens its steps
   * as it reaches each repository, so anything the browser can know about them when the
   * stream opens is already out of date. The backend re-evaluates the membership on every
   * poll, so a step opened a second ago carries its lines a second later.
   */
  repo?: string;
  onLine: (line: LineEvent) => void;
  onState?: (state: RunState) => void;
  onEnd?: (end: EndEvent) => void;
  /** Run when there is no live channel — re-read the page endpoint from the last cursor. */
  onPoll: () => void;
}

/**
 * Parse one event payload, or drop it.
 *
 * A malformed frame is a truncated write or a proxy that reformatted the body; either way
 * the next frame is likely fine, so one bad line must not tear down a twenty-minute
 * deploy's log. Returning `null` rather than throwing is what keeps the listener alive.
 */
function parse<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Watch one run's output.
 *
 * ONE connection carries all three event names — `line`, `state` and `end` are three facts
 * about one run, not three streams, and three EventSources would give the log three
 * independently-reconnecting cursors over the same rows.
 */
export function watchRun(opts: WatchRunOptions): SseHandle {
  const params = new URLSearchParams();
  if (opts.after && opts.after > 0) params.set('after', String(opts.after));
  if (opts.repo) params.set('repo', opts.repo);
  const query = params.size > 0 ? `?${params}` : '';
  return connectSse({
    url: `${BASE}/stream/runs/${encodeURIComponent(opts.runId)}${query}`,
    event: ['line', 'state', 'end'],
    // The backend closes the stream right after `end`; without this the browser would
    // reconnect to a finished run forever, replaying `end` a few dozen times a second.
    closeOn: 'end',
    onEvent: (data, event) => {
      if (event === 'line') {
        const line = parse<LineEvent>(data);
        if (line) opts.onLine(line);
        return;
      }
      if (event === 'state') {
        const state = parse<StateEvent>(data);
        if (state) opts.onState?.(state.state);
        return;
      }
      const end = parse<EndEvent>(data);
      if (end) {
        // `state` before `end`, always: a caller that only listens for one of the two
        // still learns the verdict, and one that listens for both sees them in the order
        // they happened rather than in the order the frames arrived.
        opts.onState?.(end.state);
        opts.onEnd?.(end);
      }
    },
    onPoll: opts.onPoll,
  });
}

export interface WatchWorkspaceOptions {
  /** `?workspace=<slug>`; absent watches the caller's own workspace. */
  workspace?: string;
  onRun: (run: RunTick) => void;
  /** Run when there is no live channel — re-read the tree, which carries the same states. */
  onPoll: () => void;
}

/** Watch the workspace's runs change state. */
export function watchWorkspaceRuns(opts: WatchWorkspaceOptions): SseHandle {
  const ws = opts.workspace
    ? `?workspace=${encodeURIComponent(opts.workspace)}`
    : '';
  return connectSse({
    url: `${BASE}/stream${ws}`,
    event: 'run',
    onEvent: (data) => {
      const run = parse<RunTick>(data);
      if (run) opts.onRun(run);
    },
    onPoll: opts.onPoll,
  });
}

export type { SseHandle };
