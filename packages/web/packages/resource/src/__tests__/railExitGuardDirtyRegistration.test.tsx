import { render, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RailHostContext, useRailExitGuard, type PaneExitGuard } from "../rail-host";

/** A minimal host that records which ids currently hold a guard. */
function makeHost() {
  const live = new Map<string, PaneExitGuard>();
  const registerExitGuard = vi.fn((id: string, g: PaneExitGuard | null) => {
    if (g === null) live.delete(id);
    else live.set(id, g);
  });
  return {
    live,
    registry: {
      registerLevels: vi.fn(),
      unregisterLevels: vi.fn(),
      registerExitGuard,
      popStack: vi.fn(),
      reportMissing: vi.fn(),
      toolbarSlot: null,
    },
  };
}

function Pane({ dirty }: { dirty: boolean }) {
  useRailExitGuard(dirty ? { isDirty: () => dirty } : null);
  return null;
}

describe("rail exit guard — registration tracks dirty", () => {
  it("registers nothing while the pane is clean", () => {
    const host = makeHost();
    render(
      <RailHostContext.Provider value={host.registry}>
        <Pane dirty={false} />
      </RailHostContext.Provider>,
    );
    expect(host.live.size).toBe(0);
  });

  it("registers a guard once the pane goes dirty, and withdraws it when clean again", () => {
    const host = makeHost();
    const { rerender } = render(
      <RailHostContext.Provider value={host.registry}>
        <Pane dirty={false} />
      </RailHostContext.Provider>,
    );
    expect(host.live.size).toBe(0);

    act(() => {
      rerender(
        <RailHostContext.Provider value={host.registry}>
          <Pane dirty={true} />
        </RailHostContext.Provider>,
      );
    });
    expect(host.live.size).toBe(1);

    act(() => {
      rerender(
        <RailHostContext.Provider value={host.registry}>
          <Pane dirty={false} />
        </RailHostContext.Provider>,
      );
    });
    expect(host.live.size).toBe(0);
  });
});
