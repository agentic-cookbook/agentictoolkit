/// <reference types="@testing-library/jest-dom/vitest" />
//
// THE RESOLVER SAYS WHEN IT IS READING, NOT ONLY WHEN IT HAS NOTHING.
//
// `isPending` answers "is there an answer yet", so it is false on every mount after the first —
// the resolution is cached. A host wired to it reports the very first visit and then goes quiet
// forever, even though every later mount still re-reads behind the copy already on screen.
// `isFetching` is the wider flag, and the second mount below is the case that separates them: an
// id and a read in flight at the same moment.
import type { ReactElement } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";

// Only the transport, so the hook, its key and its cache are all the real ones.
vi.mock("../../http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../http")>()),
  authedJson: vi.fn(),
}));

import { useWorkspaceDefaultEcosystemId } from "../use-workspace-default-ecosystem";
import { authedJson } from "../../http";

// Notify observers SYNCHRONOUSLY. react-query's default scheduler is a real `setTimeout(fn, 0)`,
// and "a read is in flight" is a state these tests stand in rather than a frame they wait for —
// with the default scheduler each assertion below would have to become a `waitFor`, which also
// passes on the value already rendered and so cannot tell a started read from an unstarted one.
notifyManager.setScheduler((cb) => cb());

const mockedJson = vi.mocked(authedJson);

/** The one infrastructure row the resolver reads `id` and `canManage` off. */
const ROW = [{ id: "eco-1", canManage: true }];

/** One client for the whole file: what makes the second mount a CACHED visit is the cache
 *  outliving the first one, exactly as the app's single toolkit client does. */
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Probe(): ReactElement {
  const { ecosystemId, isPending, isFetching } = useWorkspaceDefaultEcosystemId("acme");
  return (
    <div data-testid="probe" data-pending={isPending} data-fetching={isFetching}>
      {ecosystemId ?? "none"}
    </div>
  );
}

const mount = () =>
  render(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );

const probe = () => screen.getByTestId("probe");

/** Holds the next read open and hands back the lever that lands it, so the in-flight moment is
 *  a place to make assertions from instead of a race. */
function heldRead(): () => Promise<void> {
  let land: () => void = () => {
    throw new Error("the resolution was never requested");
  };
  mockedJson.mockImplementation(
    () => new Promise<unknown>((resolve) => (land = () => resolve(ROW))),
  );
  return async () => {
    await act(async () => {
      land();
    });
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useWorkspaceDefaultEcosystemId", () => {
  it("reports a read in flight on a CACHED mount, where there is nothing pending", async () => {
    const landFirst = heldRead();
    mount();

    // The first visit: no answer yet, so both flags agree.
    expect(probe().dataset.pending).toBe("true");
    expect(probe().dataset.fetching).toBe("true");
    await landFirst();
    expect(probe().textContent).toBe("eco-1");
    expect(probe().dataset.fetching).toBe("false");
    cleanup();

    // The second visit. The id is served from cache with no gap, and the re-read behind it is
    // the whole reason `isFetching` exists here: `isPending` is false throughout.
    const landSecond = heldRead();
    mount();
    expect(probe().textContent).toBe("eco-1");
    expect(probe().dataset.pending).toBe("false");
    expect(probe().dataset.fetching).toBe("true");

    await landSecond();
    expect(probe().dataset.fetching).toBe("false");
  });
});
