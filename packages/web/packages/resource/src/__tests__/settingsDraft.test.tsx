/// <reference types="@testing-library/jest-dom/vitest" />
/**
 * `useSettingsDraft` — the two things a settings pane's local copy has to get right once its
 * record is CACHED and can therefore change underneath the pane, and which four hand-rolled
 * copies of this pattern each got wrong in a different way:
 *
 *  1. A background refetch must not clobber an edit — and must not be MISTAKEN for one. The
 *     "keep the draft while draft !== loaded" guard those panes shared cannot tell the two
 *     apart, so a refetch of an UNTOUCHED pane pinned the stale value and raised a save bar
 *     nobody asked for.
 *  2. A pane that PUTs only its changed fields must diff against the snapshot the user is
 *     looking at (`seed`), not against a loaded record that has since moved — otherwise a
 *     field this user never touched is "changed" and gets written back stale.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSettingsDraft } from "../use-settings-draft";

interface Record {
  mode: string;
  skin: string;
}
type Draft = Record;

const toDraft = (r: Record): Draft => ({ ...r });

function setup(initial: Record | null) {
  return renderHook(({ loaded }) => useSettingsDraft<Record, Draft>(loaded, toDraft), {
    initialProps: { loaded: initial as Record | null },
  });
}

describe("useSettingsDraft", () => {
  it("stays null until the record lands, then seeds from it", () => {
    const { result, rerender } = setup(null);
    expect(result.current.draft).toBeNull();
    expect(result.current.dirty).toBe(false);

    rerender({ loaded: { mode: "none", skin: "rpg" } });
    expect(result.current.draft).toEqual({ mode: "none", skin: "rpg" });
    expect(result.current.seed).toEqual({ mode: "none", skin: "rpg" });
    expect(result.current.dirty).toBe(false);
  });

  it("follows a refetch of an UNEDITED pane instead of pinning the stale value", () => {
    const { result, rerender } = setup({ mode: "none", skin: "rpg" });

    // Somebody else moved the realm to `game` — the pane has been sitting untouched.
    rerender({ loaded: { mode: "game", skin: "rpg" } });

    expect(result.current.draft).toEqual({ mode: "game", skin: "rpg" });
    expect(result.current.seed).toEqual({ mode: "game", skin: "rpg" });
    // The save bar must stay down: nothing here is this user's edit.
    expect(result.current.dirty).toBe(false);
  });

  it("keeps an edit across a refetch, and freezes `seed` at what the user saw", () => {
    const { result, rerender } = setup({ mode: "none", skin: "rpg" });

    act(() => result.current.patch({ skin: "plain" }));
    expect(result.current.dirty).toBe(true);

    // A revalidation lands mid-edit, carrying a `mode` this user never touched.
    rerender({ loaded: { mode: "game", skin: "rpg" } });

    // The edit survives...
    expect(result.current.draft).toEqual({ mode: "none", skin: "plain" });
    // ...and `seed` did not move, so a partial body diffed against it sends `skin` ONLY —
    // `mode` reads as untouched even though the server's copy now disagrees with the draft.
    expect(result.current.seed).toEqual({ mode: "none", skin: "rpg" });
    expect(result.current.draft!.mode === result.current.seed!.mode).toBe(true);
    // The bar is still up: the draft genuinely differs from what the server has.
    expect(result.current.dirty).toBe(true);
  });

  it("re-seeds from a saved record and lets refetches through again", () => {
    const { result, rerender } = setup({ mode: "none", skin: "rpg" });

    act(() => result.current.patch({ skin: "plain" }));
    act(() => result.current.commit({ mode: "none", skin: "plain" }));
    expect(result.current.seed).toEqual({ mode: "none", skin: "plain" });

    // `commit` cleared the edited flag, so the pane tracks the server again.
    rerender({ loaded: { mode: "game", skin: "plain" } });
    expect(result.current.draft).toEqual({ mode: "game", skin: "plain" });
    expect(result.current.dirty).toBe(false);
  });

  it("throws the edit away on reset, back to the CURRENT record", () => {
    const { result, rerender } = setup({ mode: "none", skin: "rpg" });

    act(() => result.current.patch({ skin: "plain" }));
    rerender({ loaded: { mode: "game", skin: "rpg" } });

    act(() => result.current.reset());

    // Cancel means "show me what is stored", which is the refetched record, not the one the
    // draft happened to be seeded from.
    expect(result.current.draft).toEqual({ mode: "game", skin: "rpg" });
    expect(result.current.seed).toEqual({ mode: "game", skin: "rpg" });
    expect(result.current.dirty).toBe(false);
  });

  it("dirties through a caller's own equality when JSON is the wrong comparison", () => {
    // A draft whose optional field is absent-vs-undefined — structurally different JSON, the
    // same record. This is why `gameDiffers` is passed in by the pane that edits a `GameInput`.
    const { result } = renderHook(() =>
      useSettingsDraft<{ a: string }, { a: string; b?: string }>(
        { a: "x" },
        (r) => ({ a: r.a }),
        (l, r) => l.a === r.a,
      ),
    );

    act(() => result.current.patch({ b: undefined }));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.patch({ a: "y" }));
    expect(result.current.dirty).toBe(true);
  });
});
