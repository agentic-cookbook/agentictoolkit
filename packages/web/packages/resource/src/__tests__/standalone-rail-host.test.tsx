/// <reference types="@testing-library/jest-dom/vitest" />
//
// The `onDirtyChange` contract StandaloneRailHost/RailHostBoundary expose so a feature ENTRY
// mounted standalone (no ancestor rail host) can report its dirtiness to whatever app-level
// switch gates leaving it — e.g. personaregistry's left-rail section switch, which has no other
// way to see into the host's private `guards` map. Driven through the REAL `useRailExitGuard`
// hook (the same seam PersonaEditor/ResearchPane use), not a hand-rolled double, so this pins the
// actual publish → host → callback path.
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RailHostContext, useRailExitGuard, type RailHostRegistry } from "../rail-host";
import { RailHostBoundary, StandaloneRailHost } from "../standalone-rail-host";

afterEach(cleanup);

/** A minimal publisher: registers (or withdraws) an exit guard via the real hook, driven by the
 *  `dirty` prop — mirrors how PersonaEditor's `dirty ? { isDirty } : null` toggles its own guard.
 *  Renders nothing; the host is what this file exercises. */
function Publisher({ dirty }: { dirty: boolean }) {
  useRailExitGuard(dirty ? { isDirty: () => true } : null);
  return null;
}

const NOOP_REGISTRY: RailHostRegistry = {
  registerLevels: vi.fn(),
  unregisterLevels: vi.fn(),
  registerExitGuard: vi.fn(),
  toolbarSlot: null,
};

describe("StandaloneRailHost onDirtyChange", () => {
  it("reports true once a publisher registers a guard, and false once it withdraws", () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <StandaloneRailHost onDirtyChange={onDirtyChange}>
        <Publisher dirty={false} />
      </StandaloneRailHost>,
    );
    onDirtyChange.mockClear();

    rerender(
      <StandaloneRailHost onDirtyChange={onDirtyChange}>
        <Publisher dirty={true} />
      </StandaloneRailHost>,
    );
    expect(onDirtyChange).toHaveBeenCalledWith(true);

    onDirtyChange.mockClear();
    rerender(
      <StandaloneRailHost onDirtyChange={onDirtyChange}>
        <Publisher dirty={false} />
      </StandaloneRailHost>,
    );
    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });

  it("reports false on unmount even while a guard is still registered — an unmounting host must not leave the app believing it is dirty", () => {
    const onDirtyChange = vi.fn();
    const { unmount } = render(
      <StandaloneRailHost onDirtyChange={onDirtyChange}>
        <Publisher dirty={true} />
      </StandaloneRailHost>,
    );
    onDirtyChange.mockClear();

    unmount();

    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });

  it("is optional — a host with no onDirtyChange behaves exactly as before", () => {
    expect(() =>
      render(
        <StandaloneRailHost>
          <Publisher dirty={true} />
        </StandaloneRailHost>,
      ),
    ).not.toThrow();
  });
});

describe("RailHostBoundary onDirtyChange", () => {
  it("threads onDirtyChange to the StandaloneRailHost it creates when there is no host above", () => {
    const onDirtyChange = vi.fn();
    render(
      <RailHostBoundary onDirtyChange={onDirtyChange}>
        <Publisher dirty={true} />
      </RailHostBoundary>,
    );
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  // The pass-through case: a host already exists above (the hub's workspace chrome), so the
  // boundary renders children directly and mounts no StandaloneRailHost of its own — the prop
  // must be harmless there, not fire a phantom report the hub never asked for and would double
  // its own dirty-gating on top of.
  it("never invokes onDirtyChange when a host already exists above (pass-through)", () => {
    const onDirtyChange = vi.fn();
    render(
      <RailHostContext.Provider value={NOOP_REGISTRY}>
        <RailHostBoundary onDirtyChange={onDirtyChange}>
          <Publisher dirty={true} />
        </RailHostBoundary>
      </RailHostContext.Provider>,
    );
    expect(onDirtyChange).not.toHaveBeenCalled();
  });
});
