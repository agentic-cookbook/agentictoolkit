import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_LINES, useRunLog } from '../activity/useRunLog';
import type { WatchRunOptions } from '../live';
import type { ShiprClient } from '../client';
import type { LineEvent } from '../live';

const watchRun = vi.hoisted(() => vi.fn());
vi.mock('../live', () => ({ watchRun, watchWorkspaceRuns: vi.fn() }));

/** The last subscription `useRunLog` opened, so a test can push frames into it. */
let opened: WatchRunOptions;
const close = vi.fn();

beforeEach(() => {
  close.mockClear();
  watchRun.mockReset();
  watchRun.mockImplementation((opts: WatchRunOptions) => {
    opened = opts;
    return { close };
  });
});

function line(seq: number, text = `line ${seq}`): LineEvent {
  return {
    stepId: null,
    seq,
    stream: 'out',
    text,
    at: '2026-08-23T10:00:00Z',
  };
}

/** A line belonging to one repository's step of a folder-wide run. */
function stepLine(seq: number, stepId: string): LineEvent {
  return { ...line(seq), stepId };
}

/** A poll page's rows carry the row id too; the hook only ever reads `seq`. */
function pageLine(seq: number, stepId: string | null = null) {
  return { id: `e${seq}`, runId: 'run1', ...line(seq), stepId };
}

function page(
  events: ReturnType<typeof pageLine>[],
  done = false,
): { events: unknown[]; nextSeq: number; state: string; done: boolean } {
  return {
    events,
    nextSeq: events.at(-1)?.seq ?? 0,
    state: done ? 'succeeded' : 'running',
    done,
  };
}

function stubClient(events = vi.fn()): ShiprClient {
  return { events } as unknown as ShiprClient;
}

describe('useRunLog', () => {
  it('opens no subscription at all without a run', () => {
    renderHook(() => useRunLog(stubClient(), null));
    expect(watchRun).not.toHaveBeenCalled();
  });

  it('does not fetch a first page — the stream replays from zero itself', () => {
    // One path for a run that finished yesterday and a run starting now means no seam
    // between "the page I fetched" and "the lines that arrived" for a duplicate to hide in.
    const events = vi.fn();
    renderHook(() => useRunLog(stubClient(events), 'run1'));
    expect(events).not.toHaveBeenCalled();
  });

  it('appends lines as they arrive', async () => {
    const { result } = renderHook(() => useRunLog(stubClient(), 'run1'));
    act(() => {
      opened.onLine(line(1));
      opened.onLine(line(2));
    });
    expect(result.current.lines.map((l) => l.seq)).toEqual([1, 2]);
  });

  it('drops a line the poll and the stream both delivered', async () => {
    // The high-water mark is what makes the two safe to run against each other.
    const events = vi.fn().mockResolvedValue({
      events: [pageLine(1), pageLine(2)],
      nextSeq: 2,
      state: 'running',
      done: false,
    });
    const { result } = renderHook(() => useRunLog(stubClient(events), 'run1'));
    act(() => {
      opened.onLine(line(1));
      opened.onLine(line(2));
    });
    await act(async () => {
      opened.onPoll();
    });
    await waitFor(() => expect(result.current.state).toBe('running'));
    expect(result.current.lines.map((l) => l.seq)).toEqual([1, 2]);
  });

  it('picks up a line only the poll saw', async () => {
    const events = vi.fn().mockResolvedValue({
      events: [pageLine(1), pageLine(2)],
      nextSeq: 2,
      state: 'running',
      done: false,
    });
    const { result } = renderHook(() => useRunLog(stubClient(events), 'run1'));
    await act(async () => {
      opened.onPoll();
    });
    await waitFor(() => expect(result.current.lines).toHaveLength(2));
    expect(events).toHaveBeenCalledWith('run1', 0, undefined, undefined);
  });

  it('polls from the mark it has already reached, not from zero', async () => {
    const events = vi
      .fn()
      .mockResolvedValue({ events: [], nextSeq: 0, state: 'running', done: false });
    renderHook(() => useRunLog(stubClient(events), 'run1'));
    act(() => {
      opened.onLine(line(7));
    });
    await act(async () => {
      opened.onPoll();
    });
    expect(events).toHaveBeenCalledWith('run1', 7, undefined, undefined);
  });

  it('drops the OLDEST lines past the cap and counts what it dropped', () => {
    const { result } = renderHook(() => useRunLog(stubClient(), 'run1'));
    act(() => {
      for (let i = 1; i <= MAX_LINES + 3; i += 1) opened.onLine(line(i));
    });
    expect(result.current.lines).toHaveLength(MAX_LINES);
    expect(result.current.dropped).toBe(3);
    // What an operator is watching is the END.
    expect(result.current.lines[0]!.seq).toBe(4);
  });

  it('records the end state and stops claiming more is coming', () => {
    const { result } = renderHook(() => useRunLog(stubClient(), 'run1'));
    act(() => {
      opened.onState?.('failed');
      opened.onEnd?.({ state: 'failed', summary: null, finishedAt: null });
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.done).toBe(true);
  });

  it('surfaces a failed poll without discarding the log', async () => {
    const events = vi.fn().mockRejectedValue(new Error('gateway went away'));
    const { result } = renderHook(() => useRunLog(stubClient(events), 'run1'));
    act(() => {
      opened.onLine(line(1));
    });
    await act(async () => {
      opened.onPoll();
    });
    await waitFor(() => expect(result.current.error).toBe('gateway went away'));
    expect(result.current.lines).toHaveLength(1);
  });

  it('resets and resubscribes when the run being watched changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useRunLog(stubClient(), id),
      { initialProps: { id: 'run1' } },
    );
    act(() => {
      opened.onLine(line(1));
    });
    rerender({ id: 'run2' });
    expect(close).toHaveBeenCalled();
    expect(result.current.lines).toEqual([]);
    expect(watchRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ runId: 'run2' }),
    );
  });

  it('does not resubscribe merely because the client object was recreated', () => {
    // The client is rebuilt whenever the workspace slug changes; restarting a twenty-minute
    // log from line one for that would be a bug the operator sees as lost output.
    const { rerender } = renderHook(
      ({ client }: { client: ShiprClient }) => useRunLog(client, 'run1'),
      { initialProps: { client: stubClient() } },
    );
    rerender({ client: stubClient() });
    expect(watchRun).toHaveBeenCalledTimes(1);
  });

  it('closes the subscription on unmount', () => {
    const { unmount } = renderHook(() => useRunLog(stubClient(), 'run1'));
    unmount();
    expect(close).toHaveBeenCalled();
  });
});

describe('useRunLog — narrowed to one repository', () => {
  // The narrowing is the SERVER's: a run opens its steps as it walks, so a membership test
  // the browser evaluates against a set it captured when the pane mounted matches nothing
  // for the run that was queued a moment ago — which is the whole run, for the pane that
  // is watching it. What these assert is therefore that the mirror's id reaches the wire,
  // both on the stream and on the poll fallback.

  it('subscribes the stream to that repository', () => {
    renderHook(() => useRunLog(stubClient(), 'run1', 'repo9'));
    expect(watchRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run1', repo: 'repo9' }),
    );
  });

  it('leaves the stream un-narrowed when there is no repository', () => {
    // A run aimed at a single mirror is shown WHOLE, its own narration included — so the
    // parameter is absent rather than null, and the backend's `and(...)` drops the clause.
    renderHook(() => useRunLog(stubClient(), 'run1'));
    expect(watchRun.mock.calls[0]![0]).not.toHaveProperty('repo');
  });

  it('asks the poll fallback for the same slice', async () => {
    const events = vi.fn().mockResolvedValue(page([]));
    renderHook(() => useRunLog(stubClient(events), 'run1', 'repo9'));
    await act(async () => {
      opened.onPoll();
    });
    expect(events).toHaveBeenCalledWith('run1', 0, undefined, 'repo9');
  });

  it('renders every line it is sent, narration included', () => {
    // Nothing is filtered this side any more: what arrives on a narrowed stream is already
    // this repository's, and re-testing it here is how the frozen set got to drop lines.
    const { result } = renderHook(() =>
      useRunLog(stubClient(), 'run1', 'repo9'),
    );
    act(() => {
      opened.onLine(stepLine(1, 's1'));
      opened.onLine(stepLine(2, 's2'));
    });
    expect(result.current.lines.map((l) => l.seq)).toEqual([1, 2]);
  });

  it('resubscribes when the repository changes', () => {
    const { rerender } = renderHook(
      ({ repo }: { repo: string }) => useRunLog(stubClient(), 'run1', repo),
      { initialProps: { repo: 'repo9' } },
    );
    rerender({ repo: 'repo9' });
    expect(watchRun).toHaveBeenCalledTimes(1);
    rerender({ repo: 'repo8' });
    expect(watchRun).toHaveBeenCalledTimes(2);
  });
});

describe('useRunLog — a finished run is read, not streamed', () => {
  it('opens no EventSource and pages to the end instead', async () => {
    // A folder's report can hold forty finished sections at once; forty EventSources over a
    // six-connection limit, to replay forty logs that were never going to change.
    const events = vi
      .fn()
      .mockResolvedValueOnce(page([pageLine(1), pageLine(2)]))
      .mockResolvedValueOnce(page([pageLine(3)], true));
    const { result } = renderHook(() =>
      useRunLog(stubClient(events), 'run1', null, false),
    );
    await waitFor(() => expect(result.current.done).toBe(true));
    expect(watchRun).not.toHaveBeenCalled();
    expect(result.current.lines.map((l) => l.seq)).toEqual([1, 2, 3]);
    // Four arguments: the second page starts at the mark the first one left, and the last
    // two are the page limit and the repository narrowing — both absent for a whole run's log.
    expect(events).toHaveBeenNthCalledWith(2, 'run1', 2, undefined, undefined);
  });

  it('stops on a pass that moved the mark nowhere, however the page answers', async () => {
    // The guard against spinning forever on a run that never says `done`.
    const events = vi.fn().mockResolvedValue(page([pageLine(1)]));
    const { result } = renderHook(() =>
      useRunLog(stubClient(events), 'run1', null, false),
    );
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    await waitFor(() => expect(events).toHaveBeenCalledTimes(2));
    expect(events).toHaveBeenCalledTimes(2);
  });

  it('stops on a failed read rather than hammering the backend', async () => {
    const events = vi.fn().mockRejectedValue(new Error('gateway went away'));
    const { result } = renderHook(() =>
      useRunLog(stubClient(events), 'run1', null, false),
    );
    await waitFor(() => expect(result.current.error).toBe('gateway went away'));
    expect(events).toHaveBeenCalledTimes(1);
  });

  it('starts streaming when the same run becomes live', () => {
    const events = vi.fn().mockResolvedValue(page([], true));
    const { rerender } = renderHook(
      ({ live }: { live: boolean }) =>
        useRunLog(stubClient(events), 'run1', null, live),
      { initialProps: { live: false } },
    );
    expect(watchRun).not.toHaveBeenCalled();
    rerender({ live: true });
    expect(watchRun).toHaveBeenCalledTimes(1);
  });
});
