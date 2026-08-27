'use client';

import * as React from 'react';

import type { ShiprClient } from '../client';
import type { Run } from '../types';

/**
 * What one repository's latest run was, and how much of it belongs to that repository.
 *
 * The console used to answer "what happened" with a single pane showing whichever run was
 * most recent anywhere. That pane is gone, and the output now hangs off the thing it is
 * about — which means every place that shows output has to answer two questions first:
 * WHICH RUN, and WHICH LINES OF IT.
 *
 * Which run is `runs[0]`: `GET /shipr/repos/:id` returns every run that touched this
 * repository — aimed straight at it, or naming it in a step — newest first. So a repository
 * swept up in a folder's deploy shows that deploy, which is the honest answer to "what
 * happened here last" and the one a per-repository query would have missed.
 *
 * Which lines follows from the SCOPE. A run aimed at this exact mirror is shown whole,
 * narration included; anything wider is narrowed to this repository — by the SERVER, which
 * is handed the mirror's id and joins it to the run's steps on every read.
 *
 * THAT NARROWING USED TO HAPPEN HERE, and it is why this hook no longer reads the run's
 * steps at all. It fetched them once, kept their ids, and the log dropped every line whose
 * step was not among them. A run opens its steps AS IT WALKS, so for a run queued half a
 * second ago the set was empty — and being frozen, it stayed empty for the whole run. The
 * pane of the repository being deployed showed nothing at all (Mike: "i pressed deploy and
 * it didn't update the details view"). The set was a snapshot of something still being
 * written; the fix was to stop taking snapshots of it, and the second request went with it.
 */
export interface RepoReport {
  /** The latest run that touched this repository, or null if none ever has. */
  run: Run | null;
  /** The mirror to narrow the run's log to, or null to show the run whole. Passed straight
   *  to `useRunLog`. */
  narrowTo: string | null;
  loading: boolean;
  error: string | null;
}

const IDLE: RepoReport = {
  run: null,
  narrowTo: null,
  loading: false,
  error: null,
};

export function useRepoReport(
  client: ShiprClient,
  repoId: string | null,
  /** The runs already read by a caller that has them (the repository pane reads the same
   *  document for its ladder). Null makes this hook read them itself. */
  knownRuns: readonly Run[] | null = null,
  nonce = 0,
): RepoReport {
  const [fetched, setFetched] = React.useState<{
    run: Run | null;
    loading: boolean;
    error: string | null;
  }>({ run: null, loading: false, error: null });
  const clientRef = React.useRef(client);
  clientRef.current = client;

  // The caller's array is fresh on every render; its identity would restart the effect and
  // re-fetch each time. The run id is what actually decides the work.
  const knownRunId = knownRuns === null ? undefined : (knownRuns[0]?.id ?? null);
  const given = knownRuns !== null;

  React.useEffect(() => {
    if (!repoId || given) {
      setFetched({ run: null, loading: false, error: null });
      return;
    }
    let closed = false;
    setFetched((prev) => ({ ...prev, loading: true, error: null }));
    void (async () => {
      try {
        const { runs } = await clientRef.current.repo(repoId);
        if (!closed) setFetched({ run: runs[0] ?? null, loading: false, error: null });
      } catch (e) {
        if (!closed)
          setFetched({ run: null, loading: false, error: (e as Error).message });
      }
    })();
    return () => {
      closed = true;
    };
  }, [repoId, given, knownRunId, nonce]);

  if (!repoId) return IDLE;
  const run = given ? (knownRuns?.[0] ?? null) : fetched.run;
  if (!run) {
    return {
      run: null,
      narrowTo: null,
      loading: given ? false : fetched.loading,
      error: given ? null : fetched.error,
    };
  }
  // Aimed at this mirror alone: nothing to narrow, and narrowing would throw away the run's
  // own narration, which for a single-repository run IS the output.
  const alone = run.scopeKind === 'deploy_repo' && run.scopeId === repoId;
  return {
    run,
    narrowTo: alone ? null : repoId,
    loading: given ? false : fetched.loading,
    error: given ? null : fetched.error,
  };
}
