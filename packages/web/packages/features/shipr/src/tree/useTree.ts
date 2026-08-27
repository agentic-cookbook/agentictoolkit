'use client';

import * as React from 'react';

import type { ShiprClient } from '../client';
import type { TreeResponse } from '../types';

/**
 * The whole tree, in one read.
 *
 * `GET /shipr/repos` answers with every folder and every mirror the caller may see, plus
 * the last status each mirror recorded. ONE request rather than a request per folder,
 * because the rail's job is to let someone find a repository among a hundred and a
 * per-folder fetch turns browsing into a wait — and the answer is a few hundred small rows,
 * not a page of content.
 *
 * It is also therefore the refresh unit: after a run, after a rename, after a move, the
 * console re-reads this and every rail, dot and detail follows. A cache that tried to patch
 * individual rows would have to know what a `register` did to the tree, which is the one
 * thing only the backend knows.
 */
export interface Tree {
  data: TreeResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /**
   * How many times a read has LANDED. Starts at 0 and only ever goes up.
   *
   * This is the signal anything downstream of the tree should re-read on, and it exists
   * because the obvious substitutes are not signals at all. A status run changes what the
   * ladder says without changing a single row of the tree, so `data.items.length` is the
   * same number before and after; `loading` flips to true and back inside one refresh, so
   * a consumer that samples it can see the same value on both sides. Either one leaves a
   * detail pane showing the ladder from before the run that was just watched finish.
   */
  reads: number;
}

/**
 * What a read landed, and WHICH WORKSPACE it was a read of.
 *
 * The workspace travels WITH the rows rather than beside them, because the two are only
 * ever true together: rows from `acme` are not a stale view of `beta`, they are somebody
 * else's data. Holding them in one value is what lets the hook answer `null` for a
 * workspace it has not read yet instead of answering the last one it did.
 */
interface Landed {
  workspace: string | undefined;
  data: TreeResponse | null;
  error: string | null;
}

export function useTree(client: ShiprClient): Tree {
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const workspace = client.workspace;

  const [landed, setLanded] = React.useState<Landed>({
    workspace,
    data: null,
    error: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);
  const [reads, setReads] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let closed = false;
    setLoading(true);
    void (async () => {
      try {
        const next = await clientRef.current.tree();
        if (closed) return;
        setLanded({ workspace, data: next, error: null });
        // Counted here rather than in `finally`: a read that threw kept the previous tree,
        // so nothing downstream has anything new to look at.
        setReads((n) => n + 1);
      } catch (e) {
        if (closed) return;
        // The previous tree is KEPT — but only if it is a tree OF THIS WORKSPACE. A failed
        // refresh mid-deploy should show the operator a slightly stale rail with an error
        // beside it, not an empty one; a failed FIRST read of a workspace they just switched
        // to must show them nothing, because the only rows to fall back on are another
        // workspace's.
        setLanded((prev) => ({
          workspace,
          data: prev.workspace === workspace ? prev.data : null,
          error: (e as Error).message,
        }));
      } finally {
        if (!closed) setLoading(false);
      }
    })();
    return () => {
      closed = true;
    };
  }, [nonce, workspace]);

  // THE GUARD, and the reason the workspace is stored with the rows: between a workspace
  // changing and its first read landing, this hook has rows in hand that belong to the one
  // the operator just left. Answering them for a beat would put another tenant's repository
  // names on the screen — so the match is checked on every render, and a mismatch reads as
  // "nothing has been read here yet".
  const current = landed.workspace === workspace ? landed : null;

  return {
    data: current?.data ?? null,
    loading,
    error: current?.error ?? null,
    refresh,
    reads,
  };
}
