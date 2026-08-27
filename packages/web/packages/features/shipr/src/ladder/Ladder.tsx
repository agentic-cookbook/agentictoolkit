'use client';

import * as React from 'react';

import type { Ladder as LadderData, LadderRow } from '../types';
import { columnColor, whenWidth } from './columns';

/**
 * The pipeline as ONE list of commits, with a column per branch saying where each branch
 * is standing.
 *
 * This is the script's `ladder.py` on a screen, and it is the same picture on purpose. One
 * history, oldest at the top, and a fixed block of four-character labels in front of every
 * commit. A label appears on the row of the commit that branch's tip IS — not on every
 * commit that branch contains, which would put every label on the oldest row and say
 * nothing. Read DOWN a column and you see a branch's position; read ACROSS a row and you
 * see which branches are together. The distance between two labels in a column is the
 * number of rows between them, so "how far behind is staging" is answered by looking
 * rather than by a count somebody has to trust.
 *
 * THE COLUMNS ARE FIXED-WIDTH AND ALWAYS IN THE SAME ORDER, which is the whole reason the
 * block reads as columns at all: a rung that is not at this commit leaves its four
 * characters blank rather than closing the gap. That is why every cell below is rendered
 * even when it is empty, and why the whole thing is monospace with non-breaking spaces
 * rather than a flex row — a proportional font makes four blank characters a different
 * width from `stag`, and the table stops being one.
 *
 * WHICH columns appear is the BACKEND's answer (`ladderColumns`), not this component's: an
 * environment a repository does not deploy to has its column DROPPED, because an empty
 * column reads as "behind", and that is a different fact from "not applicable".
 */
export interface LadderProps {
  ladder: LadderData;
  /** Rows are commits, so a caller can open one on the forge. */
  onSelectCommit?: (sha: string) => void;
  className?: string;
}

/** A cell of the label block: the rung's four characters, or four characters of nothing.
 *  NEVER omitted — a block that closed its gaps would put `stag` under `main` on the next
 *  row, which is the one way this table can lie. */
function Cell({ column, lit }: { column: string; lit: boolean }): React.ReactElement {
  return (
    <span
      // A rung keeps ITS OWN colour whatever the commit's state. `prod` is the colour of
      // production on every row it ever lands on; recolouring it because the pipeline happens
      // to be settled would mean the one row where the columns matter most is the row where
      // they all look the same, and the reader would have to count positions to tell them
      // apart — which is exactly what the colours are for.
      className={lit ? columnColor(column) : undefined}
      aria-hidden={!lit}
    >
      {lit ? column : ' '.repeat(column.length)}
    </span>
  );
}

function Row({
  row,
  columns,
  when,
  settled,
  onSelect,
}: {
  row: LadderRow;
  columns: readonly string[];
  when: number;
  settled: boolean;
  onSelect?: (sha: string) => void;
}): React.ReactElement {
  const marks = new Set(row.marks);
  // Padded with non-breaking spaces rather than a CSS width: the whole line is one
  // monospace run, and mixing a measured column into it reintroduces the sub-pixel drift
  // the fixed block exists to avoid.
  const age = row.when + ' '.repeat(Math.max(0, when - row.when.length));
  const body = (
    <>
      {/* THE SHA IS WHAT TURNS GREEN, and nothing else on the row does. Settled is a fact
          about this COMMIT — every branch that exists is standing on it — and the sha is the
          commit's name, so that is where the fact belongs. Painting the age and the subject
          green as well said the same thing three times over and cost the row every other
          distinction it had: the dim age stopped reading as secondary, and a whole line of
          green ran into the green rungs beside it. Green here means "this one is all the way
          through", and it is legible as that only because it is the exception on the row. */}
      <span className={settled ? 'text-apt-green' : 'text-apt-gold'}>{row.sha}</span>
      {'  '}
      <span className="text-apt-text-dim">{age}</span>
      {'  '}
      <span>{row.subject}</span>
    </>
  );

  return (
    <div
      className="flex gap-2 whitespace-pre px-2 py-[1px] hover:bg-apt-surface-2"
      // The list is the semantic structure; each row is one commit.
      role="row"
    >
      <span className="shrink-0">
        {columns.map((column, i) => (
          <React.Fragment key={column}>
            {i > 0 ? ' ' : null}
            <Cell column={column} lit={marks.has(column)} />
          </React.Fragment>
        ))}
      </span>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(row.sha)}
          className="min-w-0 truncate text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-apt-gold/40"
        >
          {body}
        </button>
      ) : (
        <span className="min-w-0 truncate">{body}</span>
      )}
    </div>
  );
}

export function Ladder({
  ladder,
  onSelectCommit,
  className,
}: LadderProps): React.ReactElement {
  const when = React.useMemo(() => whenWidth(ladder.rows), [ladder.rows]);

  if (ladder.rows.length === 0) {
    return (
      <div className={className}>
        <p className="px-2 py-6 text-sm text-apt-text-muted">
          No history to show — run <span className="font-mono">status</span> to read this
          repository&rsquo;s branches.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* NO HEADER ROW. `main prep ship test stag prod` reads as a legend wherever it
          stands, so a row repeating it is a line of the answer spent saying what the
          answer already says — the script dropped its header for the same reason. */}
      <div
        role="table"
        aria-label="Pipeline ladder"
        className="overflow-x-auto font-mono text-xs leading-5"
      >
        {ladder.rows.map((row, i) => (
          <Row
            key={row.sha}
            row={row}
            columns={ladder.columns}
            when={when}
            // Only ever the LAST row: a settled pipeline is one where every branch that
            // exists is standing on the newest thing that exists. It tints the SHA alone —
            // see `body`.
            settled={ladder.settled && i === ladder.rows.length - 1}
            onSelect={onSelectCommit}
          />
        ))}
      </div>
    </div>
  );
}
