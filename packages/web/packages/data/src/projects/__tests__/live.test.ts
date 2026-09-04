// The board's live wake. Only the SSE transport is mocked — the refcounting, the
// coalescing window and the teardown run for real, because those three ARE the module.
//
// What each case is protecting:
//
//   1. **One connection per board.** Eight panes on one board is the ordinary case, and
//      eight EventSources against one route is the failure nobody sees locally — it looks
//      identical until a server that caps concurrent connections is in front of it.
//   2. **The last unsubscribe closes it.** A leaked stream survives navigating away, so a
//      session that visits ten boards ends up holding ten open connections forever.
//   3. **A burst is one refetch.** A bulk edit, a template instantiation and an iteration
//      rollover each write many rows and each row wakes; without the trailing window every
//      pane refetches once per row, which is worse than the staleness it is fixing.
//   4. **Unsubscribing beats a pending wake.** The timer outlives the unmount, so a fired
//      callback would call `setState` on a gone component.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ConnectSseOptions } from "../../stream";

// The transport is the seam: it owns the token, the EventSource and the poll fallback,
// none of which this module decides. Capturing its options is how the URL and event name
// below are asserted at all.
//
// `vi.hoisted` because `vi.mock` is lifted above every declaration in the file, and the
// module under test imports the mocked module at load — a plain `const` would still be in
// its temporal dead zone when the factory runs.
const spy = vi.hoisted(() => ({ close: vi.fn(), opened: [] as unknown[] }));
vi.mock("../../stream", () => ({
  connectSse: vi.fn((opts: unknown) => {
    spy.opened.push(opts);
    return { close: spy.close };
  }),
}));

const close = spy.close;
const opened = spy.opened as ConnectSseOptions[];

import { subscribeToProject } from "../live";

beforeEach(() => {
  vi.useFakeTimers();
  opened.length = 0;
  close.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Fire the stream's `project` event as the backend would: an empty payload. */
function serverSaysChanged(which = 0): void {
  opened[which]!.onEvent("{}", "project");
}

describe("subscribeToProject — the connection", () => {
  it("opens ONE stream for a board however many panes are watching it", () => {
    const stop1 = subscribeToProject("p1", vi.fn());
    const stop2 = subscribeToProject("p1", vi.fn());
    const stop3 = subscribeToProject("p1", vi.fn());
    expect(opened).toHaveLength(1);
    stop1();
    stop2();
    stop3();
  });

  it("names the board in the URL and listens for one event", () => {
    const stop = subscribeToProject("p 1/2", vi.fn());
    expect(opened[0]!.url).toBe("/api/project/projects/p%201%2F2/stream");
    expect(opened[0]!.event).toBe("project");
    stop();
  });

  it("opens a SEPARATE stream per board", () => {
    const stopA = subscribeToProject("p1", vi.fn());
    const stopB = subscribeToProject("p2", vi.fn());
    expect(opened).toHaveLength(2);
    expect(opened[0]!.url).not.toBe(opened[1]!.url);
    stopA();
    stopB();
  });

  it("closes only when the LAST watcher goes away", () => {
    const stop1 = subscribeToProject("p1", vi.fn());
    const stop2 = subscribeToProject("p1", vi.fn());
    stop1();
    expect(close).not.toHaveBeenCalled();
    stop2();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("opens a fresh stream when a board is watched again after going quiet", () => {
    // Re-entering a board after leaving it must not reuse a closed handle.
    subscribeToProject("p1", vi.fn())();
    expect(close).toHaveBeenCalledTimes(1);
    const stop = subscribeToProject("p1", vi.fn());
    expect(opened).toHaveLength(2);
    stop();
  });
});

describe("subscribeToProject — waking", () => {
  it("tells every watcher of that board, and nobody else's", () => {
    const mine = vi.fn();
    const theirs = vi.fn();
    const other = vi.fn();
    const stops = [
      subscribeToProject("p1", mine),
      subscribeToProject("p1", theirs),
      subscribeToProject("p2", other),
    ];
    serverSaysChanged(0);
    vi.runAllTimers();
    expect(mine).toHaveBeenCalledTimes(1);
    expect(theirs).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    stops.forEach((stop) => stop());
  });

  it("folds a BURST of changes into a single refetch", () => {
    const onWake = vi.fn();
    const stop = subscribeToProject("p1", onWake);
    serverSaysChanged();
    serverSaysChanged();
    serverSaysChanged();
    expect(onWake).not.toHaveBeenCalled(); // trailing, so nothing has fired yet
    vi.runAllTimers();
    expect(onWake).toHaveBeenCalledTimes(1);
    stop();
  });

  it("wakes again for a change that arrives after the window closed", () => {
    // The guard is a coalescing window, not a once-per-connection latch.
    const onWake = vi.fn();
    const stop = subscribeToProject("p1", onWake);
    serverSaysChanged();
    vi.runAllTimers();
    serverSaysChanged();
    vi.runAllTimers();
    expect(onWake).toHaveBeenCalledTimes(2);
    stop();
  });

  it("wakes on the poll fallback exactly as it does on a live event", () => {
    // With no SSE (no token yet, or a hard close) the transport polls instead; a board
    // that only refetched on the live path would sit stale for the whole session.
    const onWake = vi.fn();
    const stop = subscribeToProject("p1", onWake);
    opened[0]!.onPoll();
    vi.runAllTimers();
    expect(onWake).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not call a watcher that unsubscribed while a wake was pending", () => {
    const leaving = vi.fn();
    const staying = vi.fn();
    const stopLeaving = subscribeToProject("p1", leaving);
    const stopStaying = subscribeToProject("p1", staying);
    serverSaysChanged();
    stopLeaving();
    vi.runAllTimers();
    expect(leaving).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
    stopStaying();
  });

  it("drops a pending wake when the last watcher leaves", () => {
    const onWake = vi.fn();
    const stop = subscribeToProject("p1", onWake);
    serverSaysChanged();
    stop();
    vi.runAllTimers();
    expect(onWake).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
