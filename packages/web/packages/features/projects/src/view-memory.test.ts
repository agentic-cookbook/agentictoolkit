import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useViewMemory, resetViewMemory } from "./view-memory";
import { EMPTY_FILTER } from "./filters";

beforeEach(resetViewMemory);
afterEach(cleanup);

describe("useViewMemory", () => {
  it("survives the unmount that switching views performs", () => {
    const first = renderHook(() => useViewMemory("p1"));
    act(() => first.result.current[1]({ filter: { ...EMPTY_FILTER, text: "copy" } }));
    expect(first.result.current[0].filter.text).toBe("copy");
    first.unmount();

    // The whole feature is torn down and rebuilt on every navigation below the workspace. If the
    // narrowing did not outlive that, a filter typed on the List would be gone on the Board — and
    // a saved view applied BY navigating would arrive with nothing left to apply.
    const second = renderHook(() => useViewMemory("p1"));
    expect(second.result.current[0].filter.text).toBe("copy");
  });

  it("remembers each project separately", () => {
    const p1 = renderHook(() => useViewMemory("p1"));
    act(() => p1.result.current[1]({ savedViewId: "v1" }));
    p1.unmount();

    const p2 = renderHook(() => useViewMemory("p2"));
    expect(p2.result.current[0].savedViewId).toBeNull();
    expect(p2.result.current[0].filter).toEqual(EMPTY_FILTER);
  });

  it("re-reads when the same mount is handed a different project", () => {
    const p1 = renderHook(() => useViewMemory("p1"));
    act(() => p1.result.current[1]({ filter: { ...EMPTY_FILTER, text: "copy" } }));
    p1.unmount();

    // Derived from the prop rather than synced in an effect, so the previous project's filter is
    // never on screen — not even for the one frame an effect would leave it there.
    const both = renderHook(({ id }) => useViewMemory(id), { initialProps: { id: "p1" } });
    expect(both.result.current[0].filter.text).toBe("copy");
    both.rerender({ id: "p2" });
    expect(both.result.current[0].filter.text).toBe("");
  });

  it("merges a patch rather than replacing the whole memory", () => {
    const { result } = renderHook(() => useViewMemory("p1"));
    act(() => result.current[1]({ filter: { ...EMPTY_FILTER, text: "copy" } }));
    act(() => result.current[1]({ sort: { key: "title", dir: "asc" } }));

    // The three values are set by three different controls — the filter bar, the Table's header,
    // and the saved-view chooser — and none of them knows what the other two currently hold.
    expect(result.current[0]).toEqual({
      filter: { ...EMPTY_FILTER, text: "copy" },
      sort: { key: "title", dir: "asc" },
      savedViewId: null,
    });
  });
});
