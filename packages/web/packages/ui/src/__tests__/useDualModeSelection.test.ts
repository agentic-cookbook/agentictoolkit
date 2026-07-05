import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDualModeSelection } from "../hooks/useDualModeSelection";

describe("useDualModeSelection", () => {
  it("internal mode: selection lives in local state; isUrlDriven is false", () => {
    const { result } = renderHook(() => useDualModeSelection(undefined));
    expect(result.current.selectedId).toBeNull();
    expect(result.current.isUrlDriven).toBe(false);

    act(() => result.current.select("a"));
    expect(result.current.selectedId).toBe("a");

    act(() => result.current.select(null));
    expect(result.current.selectedId).toBeNull();
  });

  it("internal mode: defaultSelectedId seeds the initial selection", () => {
    const { result } = renderHook(() =>
      useDualModeSelection(undefined, { defaultSelectedId: "first" }),
    );
    expect(result.current.selectedId).toBe("first");
  });

  it("URL mode: reads from urlSelection and routes every change through onSelect (no internal write)", () => {
    const onSelect = vi.fn();
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useDualModeSelection({ selectedId: id, onSelect }),
      { initialProps: { id: "x" as string | null } },
    );
    expect(result.current.selectedId).toBe("x");
    expect(result.current.isUrlDriven).toBe(true);

    // A change routes out via onSelect; the value stays the URL's until the prop actually changes
    // (the router owns it) — it must NOT fork into internal state.
    act(() => result.current.select("y"));
    expect(onSelect).toHaveBeenCalledWith("y");
    expect(result.current.selectedId).toBe("x");

    // The router pushed the segment → the prop updates → the hook reflects it.
    rerender({ id: "y" });
    expect(result.current.selectedId).toBe("y");

    act(() => result.current.select(null));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("URL mode: defaultSelectedId is ignored — the URL is the source of truth", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useDualModeSelection({ selectedId: null, onSelect }, { defaultSelectedId: "first" }),
    );
    expect(result.current.selectedId).toBeNull();
  });
});
