'use client';

import * as React from 'react';

import { Spinner } from '@agenticdevelopertoolkit/ui/components/spinner';

import { LogLines } from '../activity/LogLines';
import { useRunLog } from '../activity/useRunLog';
import type { ShiprClient } from '../client';
import { TERMINAL_STATES, type Run } from '../types';
import { useRepoReport } from './useRepoReport';

/**
 * One repository's latest output, live.
 *
 * The same block twice: on its own under a repository's ladder, and stacked once per
 * repository under a folder. That is the whole reason it is a component — a folder's view
 * is not a summary of its repositories, it is their reports one after another, and a summary
 * would be exactly the "status chip instead of the log" this console was built to avoid.
 *
 * ONLY AN UNFINISHED RUN STREAMS. A finished one has a fixed log, so it is read with plain
 * requests and left alone — a folder of forty repositories otherwise opens forty
 * EventSources against a six-connection limit to replay forty logs that cannot change. The
 * runner is serial, so at most one section on the screen is live at a time.
 */

export interface RepoReportProps {
  client: ShiprClient;
  repoId: string;
  /** The runs a caller has already read for this repository — the repository pane reads the
   *  same document for its ladder, and re-reading it here would double every open. */
  knownRuns?: readonly Run[] | null;
  /** Bumped when a run lands, so the section picks up the run that just started. */
  nonce?: number;
  /** Follow the output as it arrives. On alone under a repository; off inside a folder's
   *  stack, where a page that jumps to whichever section wrote last cannot be read. */
  follow?: boolean;
  className?: string;
}

export function RepoReport({
  client,
  repoId,
  knownRuns = null,
  nonce = 0,
  follow = false,
  className,
}: RepoReportProps): React.ReactElement | null {
  const { run, narrowTo, loading, error } = useRepoReport(
    client,
    repoId,
    knownRuns,
    nonce,
  );
  const live = run !== null && !TERMINAL_STATES.includes(run.state);
  const log = useRunLog(client, run?.id ?? null, narrowTo, live);

  // NOTHING TO SAY, SO NOTHING DRAWN.
  //
  // Two states used to render as a block of furniture around an apology. A repository with
  // no runs got "Latest output" over "nothing has been run against this repository yet",
  // which the ladder above has already said in the form the operator can act on ("never
  // read — run status"). And a repository whose latest run was a folder-wide `status` got
  // its own heading, a tinted STATUS, and one grey line saying the run produced no output
  // here — three lines of chrome to report an absence, once per repository, down a folder
  // of forty.
  //
  // An absence is not output. A `status` run's answer IS the ladder, so when the log is
  // settled and empty this section is not empty-with-a-message, it is over: the section
  // above ends in the commits and the next repository begins.
  const silent = !error && !loading && (!run || (log.done && log.lines.length === 0));
  if (silent) return null;

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col ${className ?? ''}`}
      aria-label="Latest output"
    >
      {/* NO HEADING. The operation word used to stand here, tinted by the run's state — and
          under a repository whose ladder is directly above it, a lone green STATUS is a label
          for something the reader is already looking at (Mike). Every fact it carried is said
          better elsewhere: which repository, by the heading above; what happened, by the log's
          own lines and the dot in the rail. What is left is the output, which is what the pane
          is for. The spinner stays, because a pane that is fetching and a pane with nothing to
          fetch must not look the same. */}
      {loading ? (
        <header className="flex shrink-0 items-center px-3 py-1">
          <Spinner />
        </header>
      ) : null}

      {error ? (
        <p className="px-3 py-2 text-xs text-apt-red">{error}</p>
      ) : (
        <LogLines
          log={log}
          follow={follow}
          // Only ever seen before the first line lands: a run that FINISHES with no output
          // of this repository's renders no section at all (see `silent` above).
          emptyLabel="Waiting for output…"
          className="min-h-0 flex-1"
        />
      )}
    </section>
  );
}
