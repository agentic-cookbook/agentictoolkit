import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ShiprClient } from '../client';
import type { TreeResponse } from '../types';
import { useTree } from '../tree/useTree';

/**
 * `reads` is what the detail pane re-reads on, and the case that matters is the one where
 * NOTHING ELSE MOVES: a status run rewrites a ladder and leaves the tree's rows byte for
 * byte identical. Any counter derived from the response — row count, a hash of the items —
 * is the same on both sides of that refresh, and the pane keeps showing the ladder from
 * before the run the operator just watched finish.
 */

const EMPTY: TreeResponse = { groups: [], repos: [] } as unknown as TreeResponse;

function clientReturning(
  tree: () => Promise<TreeResponse>,
): ShiprClient {
  return { workspace: 'ws', tree } as unknown as ShiprClient;
}

describe('useTree', () => {
  it('counts a landed read, and counts the next one even when nothing changed', async () => {
    // The SAME response object every time — the tree a status run leaves behind.
    const tree = vi.fn(async () => EMPTY);
    const { result } = renderHook(() => useTree(clientReturning(tree)));

    await waitFor(() => expect(result.current.reads).toBe(1));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.reads).toBe(2));
    expect(tree).toHaveBeenCalledTimes(2);
  });

  it('does not count a read that threw — the old tree is still what is on screen', async () => {
    let fail = false;
    const tree = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return EMPTY;
    });
    const { result } = renderHook(() => useTree(clientReturning(tree)));
    await waitFor(() => expect(result.current.reads).toBe(1));

    fail = true;
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe('offline'));

    expect(result.current.reads).toBe(1);
    // And the rows survive the failure, which is the reason the counter must not move:
    // re-reading a detail pane against a tree that never changed is pure noise.
    expect(result.current.data).toBe(EMPTY);
  });
});
