'use client';

import * as React from 'react';

import type { ShiprClient } from '../client';
import type { RunStep } from '../types';
import type { Runs } from './useRuns';

/**
 * Which repositories are being worked on RIGHT NOW.
 *
 * The console knows the runs it started; the rail needs the mirrors those runs are inside
 * of, which is a different question whenever a run names more than one. A `deploy_repo` run
 * answers it for free — its scope IS the mirror. A run over a folder does not: it names the
 * folder, and which of the forty repositories under it the runner has reached is in the
 * run's STEPS.
 *
 * SO THE STEPS ARE POLLED, and that is not an oversight in the stream. The workspace
 * channel ticks on the RUN row, and a run walking from its third repository to its fourth
 * does not change that row — it is still `running`, still the same scope. Streaming step
 * transitions would be a second channel carrying the runner's position, which is worth
 * exactly one small request while something is out.
 *
 * THE SPINNER SHOWED ABOUT A THIRD OF THE TIME (Mike), for three reasons that all had to
 * go together, because each on its own leaves a gap the other two fall into:
 *
 *  1. A QUEUED run counted as nothing. Between the press and the runner claiming the run
 *     — the whole point at which the operator is looking for confirmation — the state is
 *     `queued`, and every filter here demanded `running`. See `LIVE_STATES`.
 *  2. A step BETWEEN repositories counted as nothing. The runner opens a step as
 *     `running` and closes it to a terminal state, so at the instant it has finished
 *     repository three and not yet opened four, no step is `running` and every spinner in
 *     the rail went out. It is serial, so the last step it opened is where it is; see
 *     `newestStep`.
 *  3. Two seconds is longer than a step. `status` over a warm clone finishes in well
 *     under that, so a poll landing either side of a repository's whole turn never saw it
 *     at all. Under a second, and only while something is out.
 */
const POLL_MS = 750;

/** Out, in the sense the rail draws: accepted and not yet finished. `queued` is here for
 *  reason 1 above — a run the operator just started and the runner has not yet claimed is
 *  the state their finger is still on the button for. */
const LIVE_STATES = ['queued', 'running'] as const;

const isLive = (state: string | undefined): boolean =>
  (LIVE_STATES as readonly string[]).includes(state ?? '');

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * Where this run is, out of the steps it has written so far.
 *
 * A step that is `running` is the answer whenever there is one. When there is not — the
 * runner has closed one repository's step and not yet opened the next — the answer is the
 * LAST step it opened, because the runner is serial and is at that moment on its way from
 * that repository to the one after it. Highest `ordinal` wins; they are handed out in the
 * order the walk visits.
 *
 * The caller only asks while the run is live, which is what keeps this from claiming a
 * finished run's final repository is still working.
 */
function newestStep(steps: readonly RunStep[]): RunStep | null {
  let best: RunStep | null = null;
  for (const step of steps) {
    if (step.state === 'running') {
      if (best?.state !== 'running' || step.ordinal > best.ordinal) best = step;
    } else if (best?.state !== 'running') {
      if (!best || step.ordinal > best.ordinal) best = step;
    }
  }
  return best;
}

export function useRunningRepos(
  client: ShiprClient,
  /** The runs this console started, in the order it started them. */
  queue: readonly string[],
  runs: Runs,
): ReadonlySet<string> {
  const clientRef = React.useRef(client);
  clientRef.current = client;

  /** The free half: a run scoped to one mirror IS that mirror working. */
  const direct = React.useMemo(() => {
    const ids = new Set<string>();
    for (const id of queue) {
      const run = runs.items.find((r) => r.id === id);
      if (isLive(run?.state) && run?.scopeKind === 'deploy_repo' && run.scopeId) {
        ids.add(run.scopeId);
      }
    }
    return ids;
  }, [queue, runs.items]);

  /** The fan-out half: the runs whose position has to be asked for. Joined into a string so
   *  the effect below re-runs when the SET changes rather than on every render that rebuilds
   *  an equal array. */
  const fanned = React.useMemo(
    () =>
      queue
        .filter((id) => {
          const run = runs.items.find((r) => r.id === id);
          return isLive(run?.state) && run?.scopeKind !== 'deploy_repo';
        })
        .join(','),
    [queue, runs.items],
  );

  const [stepped, setStepped] = React.useState<ReadonlySet<string>>(EMPTY);

  React.useEffect(() => {
    if (fanned === '') {
      setStepped(EMPTY);
      return;
    }
    const ids = fanned.split(',');
    let closed = false;

    const read = async () => {
      const found = new Set<string>();
      for (const id of ids) {
        try {
          const { steps } = await clientRef.current.runDetail(id);
          const at = newestStep(steps);
          if (at?.deployRepoId) found.add(at.deployRepoId);
        } catch {
          // A poll that failed says nothing about where the runner is, and the next one is
          // two seconds away. Clearing the spinners on a dropped request would make them
          // flicker every time the network hiccuped mid-deploy.
          return;
        }
      }
      if (!closed) setStepped(found);
    };

    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [fanned]);

  return React.useMemo(() => {
    if (stepped.size === 0) return direct;
    const all = new Set(direct);
    for (const id of stepped) all.add(id);
    return all;
  }, [direct, stepped]);
}
