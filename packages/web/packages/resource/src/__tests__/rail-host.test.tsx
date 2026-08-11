/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import { RailHostContext, StackLevels, type RailHostRegistry } from "../rail-host";

const level: TopicLevel = {
  id: "l1",
  title: "T",
  items: [],
  selectedId: null,
  onSelect: () => {},
  onClear: () => {},
};

describe("StackLevels", () => {
  it("no-ops without a host (children still render)", () => {
    render(<StackLevels levels={[level]}>inner</StackLevels>);
    expect(screen.getByText("inner")).toBeInTheDocument();
  });

  it("registers with a host and unregisters on unmount", () => {
    const registry: RailHostRegistry = {
      registerLevels: vi.fn(),
      unregisterLevels: vi.fn(),
      registerExitGuard: vi.fn(),
      popStack: vi.fn(),
      reportMissing: vi.fn(),
      toolbarSlot: null,
    };
    const { unmount } = render(
      <RailHostContext.Provider value={registry}>
        <StackLevels levels={[level]}>inner</StackLevels>
      </RailHostContext.Provider>,
    );
    expect(registry.registerLevels).toHaveBeenCalledOnce();
    unmount();
    expect(registry.unregisterLevels).toHaveBeenCalledOnce();
  });
});
