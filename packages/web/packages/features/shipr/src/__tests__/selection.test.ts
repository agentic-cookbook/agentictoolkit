import { describe, expect, it } from 'vitest';

import {
  EMPTY_SELECTION,
  isChecked,
  nodeKey,
  targetsOf,
  toggleChecked,
} from '../selection';
import type { NodeRef } from '../tree/levels';

const g = (id: string): NodeRef => ({ kind: 'group', id });
const r = (id: string): NodeRef => ({ kind: 'repo', id });

describe('nodeKey', () => {
  it('keeps the two id spaces apart', () => {
    // A folder and a repository may legitimately share an id; a key without the kind in it
    // would let one checkbox tick both rows.
    expect(nodeKey(g('x'))).not.toBe(nodeKey(r('x')));
  });
});

describe('targetsOf', () => {
  it('is empty when nothing is selected — which means "the whole workspace"', () => {
    expect(targetsOf(EMPTY_SELECTION)).toEqual([]);
  });

  it('is the focused row when select mode is off', () => {
    expect(targetsOf({ ...EMPTY_SELECTION, focus: r('r1') })).toEqual([r('r1')]);
  });

  it('lets the batch win over the highlighted row', () => {
    // Ticking rows is the operator saying "the buttons mean THESE". A stray highlight
    // overriding that is how a deploy lands on the wrong repository.
    const targets = targetsOf({
      focus: r('elsewhere'),
      selecting: true,
      checked: [r('r1'), r('r2')],
    });
    expect(targets).toEqual([r('r1'), r('r2')]);
  });

  it('falls back to the highlight when select mode is on but nothing is ticked', () => {
    expect(
      targetsOf({ focus: g('a'), selecting: true, checked: [] }),
    ).toEqual([g('a')]);
  });

  it('ignores a leftover batch while select mode is off', () => {
    expect(
      targetsOf({ focus: r('r1'), selecting: false, checked: [r('r9')] }),
    ).toEqual([r('r1')]);
  });
});

describe('toggleChecked', () => {
  it('preserves tick order, because that is the order the runs are queued in', () => {
    let checked = toggleChecked([], r('b'));
    checked = toggleChecked(checked, r('a'));
    checked = toggleChecked(checked, r('c'));
    expect(checked.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('unticks a row that is already ticked', () => {
    const checked = toggleChecked([r('a'), r('b')], r('a'));
    expect(checked).toEqual([r('b')]);
  });

  it('does not confuse a folder with a repository of the same id', () => {
    const checked = toggleChecked([g('x')], r('x'));
    expect(checked).toHaveLength(2);
  });

  it('returns a new array rather than mutating the old one', () => {
    const before: NodeRef[] = [r('a')];
    const after = toggleChecked(before, r('b'));
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
  });
});

describe('isChecked', () => {
  it('matches on kind as well as id', () => {
    expect(isChecked([g('x')], g('x'))).toBe(true);
    expect(isChecked([g('x')], r('x'))).toBe(false);
  });
});
