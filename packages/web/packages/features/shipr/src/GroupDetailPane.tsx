'use client';

import * as React from 'react';

import type { ShiprClient } from './client';
import { RepoView } from './RepoView';
import type { Descendant } from './tree/levels';

/**
 * The detail pane for a folder: every repository under it, drawn EXACTLY as it is drawn on
 * its own.
 *
 * THIS IS WHAT THE ACTIVITY PANE WAS FOR, put where it belongs. A folder is how this console
 * says "these eleven things, as a batch" — it is the unit people press Deploy on — so the
 * question a selected folder asks is "how did the batch go", and the honest answer is the
 * eleven answers, not a summary of them. The old pane answered a different question
 * (whichever run was most recent anywhere in the workspace) from a column that had no idea
 * what was selected beside it.
 *
 * IT OWNS NO REPOSITORY MARKUP OF ITS OWN. It used to draw a heading and hang a bare output
 * block under it, which is how a repository came to look like two different facts depending
 * on which row was highlighted: a ladder in colour in its own pane, and one grey line here.
 * `RepoView` is the single rendering of a repository, and this pane's whole job is to say
 * WHICH ones, in what order — the sections are that component, once per row.
 *
 * IN RAIL ORDER, which is also the order the backend walks the folder in. So the fourth
 * section down is the fourth repository the run touched, and scrolling this pane during a
 * batch is watching it move.
 *
 * Nested folders are flattened rather than nested. A section per repository at one depth is
 * a list to scroll; sections inside sections is a filesystem browser, and the path each
 * section prints on its own heading already says where it came from.
 */

export interface GroupDetailPaneProps {
  client: ShiprClient;
  /** The folder's name. NOT drawn here — the pane's title lives in the detail strip the
   *  stack itself renders, beside the control that hides the rail (see `ShiprConsole`'s
   *  `detailTitle`). It stays because this pane still needs an accessible name, and
   *  "which folder" is that name. */
  title: string;
  /** Everything under it, in rail order — from `descendantsOf`. */
  contents: readonly Descendant[];
  /** Bumped when the folder itself changes — a move, a rename, a settings save, a run
   *  leaving the queue. Deliberately NOT bumped per step of a batch: that would be one read
   *  per section per step, and a section only needs to re-read on its own turn. */
  nonce?: number;
  /** Which repositories the runner is inside right now. Each section takes its own answer out
   *  of this and re-reads when that answer changes, so a batch of forty updates the fourth
   *  section when the runner leaves the fourth repository rather than all forty at the end. */
  runningRepoIds?: ReadonlySet<string>;
  onSelectCommit?: (sha: string) => void;
  className?: string;
}

export function GroupDetailPane({
  client,
  title,
  contents,
  nonce = 0,
  runningRepoIds,
  onSelectCommit,
  className,
}: GroupDetailPaneProps): React.ReactElement {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col ${className ?? ''}`}
      aria-label={`${title} activity`}
    >
      {/* NO HEADER OF ITS OWN (Mike). The folder's name and its count used to be drawn
          here, immediately below the stack's own top strip — two title bars stacked, the
          upper one empty but for the `«`. They are now passed up as `detailTitle` and drawn
          IN that strip, which is what it is for. `title` survives as this pane's accessible
          name. */}
      {contents.length === 0 ? (
        <p className="px-4 py-6 text-sm text-apt-text-muted">
          Nothing is filed in this folder yet. Add a directory or register a
          repository from the gear menu above.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {contents.map(({ repo, relativePath }) => (
            // `relativePath` is a string here and never undefined, which is what tells the
            // view it is one section of a stack rather than a pane of its own: it steps its
            // heading down to an `h3`, prints the sub-folders it is filed under, and drops
            // the "in <folder>" the header above has already said.
            //
            // `follow` is off for the same reason: a page of eleven sections that scrolls to
            // whichever one wrote last cannot be read. The live section is the one the rail's
            // running dot points at, and it is reachable by scrolling to it.
            <RepoView
              key={repo.id}
              client={client}
              repoId={repo.id}
              relativePath={relativePath}
              nonce={nonce}
              running={runningRepoIds?.has(repo.id) ?? false}
              onSelectCommit={onSelectCommit}
              className="shrink-0 border-b border-apt-border last:border-b-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}
