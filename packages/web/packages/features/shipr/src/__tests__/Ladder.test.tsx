import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Ladder } from '../ladder/Ladder';
import { columnColor, whenWidth } from '../ladder/columns';
import type { Ladder as LadderData } from '../types';

const COLUMNS = ['main', 'prep', 'ship', 'test', 'stag', 'prod'];

function ladder(
  rows: { sha: string; when: string; subject: string; marks: string[] }[],
  settled = false,
  columns = COLUMNS,
): LadderData {
  return {
    columns,
    rows: rows.map((r) => ({ ...r, settled: false })),
    settled,
  };
}

describe('whenWidth', () => {
  it('measures the widest age actually being drawn', () => {
    expect(whenWidth([{ when: '2 days ago' }, { when: '3 weeks ago' }])).toBe(11);
  });

  it('is zero for an empty ladder rather than a guess', () => {
    expect(whenWidth([])).toBe(0);
  });
});

describe('columnColor', () => {
  it('gives prep and ship different colours — same commit, different repositories', () => {
    expect(columnColor('prep')).not.toBe(columnColor('ship'));
  });

  it('renders an unknown column plainly rather than invisibly', () => {
    expect(columnColor('canary')).toBe('text-apt-text');
  });
});

describe('Ladder', () => {
  it('tells the operator to run status when there is no history', () => {
    const { container } = render(<Ladder ladder={ladder([])} />);
    expect(container.textContent).toMatch(/No history to show/);
    expect(container.textContent).toMatch(/status/);
  });

  it('keeps a rung that is not at this commit as BLANK, never omitted', () => {
    // Closing the gap would slide `prod` under `main` on the next row — the one way this
    // table can lie about where a branch is standing.
    const { container } = render(
      <Ladder
        ladder={ladder([
          { sha: 'aaa1111', when: '2 days ago', subject: 'older', marks: ['prod'] },
          { sha: 'bbb2222', when: '1 day ago', subject: 'newer', marks: ['main'] },
        ])}
      />,
    );
    const rows = container.querySelectorAll('[role="row"]');
    // The label block is the row's first element; its element children ARE the cells (the
    // single-space separators between them are text nodes, not elements).
    const cells = (i: number) =>
      Array.from(rows[i]!.firstElementChild!.children).map((s) => s.textContent);
    // Six four-character cells on every row, whatever is lit. The blanks are non-breaking
    // spaces: an ordinary space is a break opportunity, and a wrapped label block is a
    // scrambled one.
    const BLANK = '\u00a0\u00a0\u00a0\u00a0';
    expect(cells(0)).toEqual([BLANK, BLANK, BLANK, BLANK, BLANK, 'prod']);
    expect(cells(1)).toEqual(['main', BLANK, BLANK, BLANK, BLANK, BLANK]);
  });

  it('draws only the columns the backend sent', () => {
    // A repository that does not deploy to staging has NO staging column: an empty one
    // would read as "behind", which is a different fact.
    const { container } = render(
      <Ladder
        ladder={ladder(
          [{ sha: 'aaa1111', when: 'now', subject: 's', marks: ['main'] }],
          false,
          ['main', 'prep', 'ship'],
        )}
      />,
    );
    const row = container.querySelector('[role="row"]')!;
    expect(row.firstElementChild!.children).toHaveLength(3);
  });

  it('pads the age so the subjects line up', () => {
    const { container } = render(
      <Ladder
        ladder={ladder([
          { sha: 'aaa1111', when: '2 days ago', subject: 'a', marks: [] },
          { sha: 'bbb2222', when: '3 weeks ago', subject: 'b', marks: [] },
        ])}
      />,
    );
    const text = container.textContent ?? '';
    // Padded to the width of the longest age in THESE rows, with non-breaking spaces so the
    // padding survives as one monospace run.
    // The shorter age gets one pad character; the longest gets none. Both are then followed
    // by the same two-space gutter, so the subjects start in the same column.
    expect(text).toContain('2 days ago\u00a0\u00a0\u00a0a');
    expect(text).toContain('3 weeks ago\u00a0\u00a0b');
  });

  it('greens the LAST row only, and only when the pipeline is settled', () => {
    const { container } = render(
      <Ladder
        ladder={ladder(
          [
            { sha: 'aaa1111', when: 'a', subject: 'older', marks: [] },
            { sha: 'bbb2222', when: 'b', subject: 'newer', marks: ['main'] },
          ],
          true,
        )}
      />,
    );
    const rows = container.querySelectorAll('[role="row"]');
    expect(rows[0]!.innerHTML).not.toContain('text-apt-green');
    expect(rows[1]!.innerHTML).toContain('text-apt-green');
  });

  it('leaves every row ungreened when the pipeline is not settled', () => {
    const { container } = render(
      <Ladder
        ladder={ladder([{ sha: 'aaa1111', when: 'a', subject: 's', marks: ['main'] }])}
      />,
    );
    expect(container.innerHTML).not.toContain('text-apt-green');
  });

  it('hands the sha back when a commit is chosen', async () => {
    const onSelectCommit = vi.fn();
    render(
      <Ladder
        ladder={ladder([{ sha: 'aaa1111', when: 'a', subject: 'subject', marks: [] }])}
        onSelectCommit={onSelectCommit}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onSelectCommit).toHaveBeenCalledWith('aaa1111');
  });

  it('offers no buttons at all when there is nowhere to go', () => {
    render(<Ladder ladder={ladder([{ sha: 'aaa1111', when: 'a', subject: 's', marks: [] }])} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // The read time moved onto the view's own header, beside the repository's name, where the
  // last run's time already was. Two timestamps on one pane, in two formats, a few rows
  // apart, were read as two different facts and were the same one.

  it('tints only the SHA of a settled commit, and leaves the row otherwise unchanged', () => {
    const rows = [
      { sha: 'aaa1111', when: '2d', subject: 'older', marks: [] },
      { sha: 'bbb2222', when: '1h', subject: 'newest', marks: ['prod'] },
    ];
    const { container } = render(
      <Ladder ladder={{ columns: ['prod'], rows, settled: true }} />,
    );
    const green = [...container.querySelectorAll('.text-apt-green')].map(
      (el) => el.textContent,
    );
    // The sha, and nothing else: not the age, not the subject, and not the `prod` rung —
    // which keeps the colour that says WHICH environment it is.
    expect(green).toEqual(['bbb2222']);
    expect(container.textContent).toContain('newest');
  });
});
