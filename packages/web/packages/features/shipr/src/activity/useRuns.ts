'use client';

import * as React from 'react';

import type { ShiprClient } from '../client';
import { watchWorkspaceRuns, type RunTick } from '../live';
import { TERMINAL_STATES, type Run } from '../types';

/**
 * The workspace's runs, live.
 *
 * Two jobs, and they are the same read: it fills the run picker, and it tells the console
 * when a queued run has FINISHED so the next one in a batch can start. Doing that from the
 * workspace channel rather than from each run's own log means a batch of eleven repositories
 * costs one subscription instead of eleven, and a run somebody else started shows up here
 * too — which is the point of a shared pipeline.
 *
 * A tick carries identity and state, never output. When it names a run this hook has never
 * seen — someone else just started one — the list is re-read rather than reconstructed from
 * the tick, because a tick is deliberately not a whole `Run` and inventing the missing
 * fields would put a row in the picker that says things no server ever said.
 */
export interface Runs {
  /** Newest first — the order `GET /runs` answers in. */
  items: Run[];
  /** True until the first read settles, so a picker can stay quiet rather than flash empty. */
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** The run's state if it is known here, else null. */
  stateOf: (runId: string) => Run['state'] | null;
}

export function useRuns(client: ShiprClient, limit?: number): Runs {
  const clientRef = React.useRef(client);
  clientRef.current = client;

  // Bump to force a re-read. A counter rather than a callback in a dep array: the effect
  // below owns the fetch, and a caller's `refresh()` is just a request for another turn of it.
  const [nonce, setNonce] = React.useState(0);
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  const workspace = client.workspace;

  // The rows and the workspace they are rows OF, as one value — the same rule `useTree`
  // follows and for the same reason: a run list is per-tenant, and holding the two
  // separately is what would let a workspace change leave the previous one's runs on the
  // screen for as long as the next read takes.
  const [landed, setLanded] = React.useState<{
    workspace: string | undefined;
    items: Run[];
  }>({ workspace, items: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let closed = false;
    void (async () => {
      try {
        const page = await clientRef.current.runs(limit);
        if (closed) return;
        setLanded({ workspace, items: page.items });
        setError(null);
      } catch (e) {
        if (!closed) setError((e as Error).message);
      } finally {
        if (!closed) setLoading(false);
      }
    })();
    return () => {
      closed = true;
    };
  }, [nonce, limit, workspace]);

  React.useEffect(() => {
    let closed = false;

    const apply = (tick: RunTick) => {
      if (closed) return;
      let known = false;
      setLanded((prev) => {
        // A tick that arrives after the workspace changed belongs to the stream we are
        // tearing down, not to the list on the screen.
        if (prev.workspace !== workspace) return prev;
        return {
          ...prev,
          items: prev.items.map((run) => {
            if (run.id !== tick.id) return run;
            known = true;
            // Only what a tick actually asserts. `startedAt`/`finishedAt`/`summary` are not
            // on the wire here, and guessing them from the state ("it says succeeded, so it
            // must have finished now") would put a fabricated timestamp on the screen.
            return { ...run, state: tick.state, updatedAt: tick.updatedAt };
          }),
        };
      });
      if (!known) refresh();
    };

    const handle = watchWorkspaceRuns({
      workspace,
      onRun: apply,
      onPoll: refresh,
    });
    return () => {
      closed = true;
      handle.close();
    };
  }, [workspace, refresh]);

  // Rows from another workspace read as NO rows — see `useTree`'s guard.
  const items = landed.workspace === workspace ? landed.items : EMPTY_RUNS;

  const stateOf = React.useCallback(
    (runId: string) => items.find((r) => r.id === runId)?.state ?? null,
    [items],
  );

  return { items, loading, error, refresh, stateOf };
}

/** One frozen empty list, so the guard above returns a STABLE value — a fresh `[]` every
 *  render would re-run every memo downstream of it. */
const EMPTY_RUNS: Run[] = [];

/** Has this run stopped? Unknown runs read as NOT finished — a queue that advanced past a
 *  run it has not heard of yet would start two at once. */
export function isFinished(runs: Runs, runId: string): boolean {
  const state = runs.stateOf(runId);
  return state !== null && TERMINAL_STATES.includes(state);
}
