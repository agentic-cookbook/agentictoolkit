import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { isMissingToken, useMintedSecret } from "./token-detail";

/** The full arg set, so each case below states only the field it is about. */
function args(over: Partial<Parameters<typeof isMissingToken>[0]> = {}) {
  return {
    leafId: "t1",
    found: false,
    isFetching: false,
    isError: false,
    mintedId: null,
    ...over,
  };
}

describe("isMissingToken", () => {
  it("says so when the URL names a token the loaded list does not contain", () => {
    expect(isMissingToken(args())).toBe(true);
  });

  it("says nothing when no token is named, or when it was found", () => {
    expect(isMissingToken(args({ leafId: null }))).toBe(false);
    expect(isMissingToken(args({ leafId: "" }))).toBe(false);
    expect(isMissingToken(args({ found: true }))).toBe(false);
  });

  // The footgun this function exists to pin. A revisit with cached data is never `isPending`, so a
  // guard written against `isPending` lets "no longer listed" flash over a list that is already on
  // its way — on exactly the visit the reader is most likely to make.
  it("stays quiet while the list is refetching, not merely while it is pending", () => {
    expect(isMissingToken(args({ isFetching: true }))).toBe(false);
  });

  it("stays quiet on an error — a failed load is not a missing token", () => {
    expect(isMissingToken(args({ isError: true }))).toBe(false);
  });

  // The mint navigates the instant it has the id, so the detail renders BEFORE the invalidated list
  // comes back with the new row. Without this, minting a token flashes "that token is no longer
  // listed" over the secret the same click just revealed.
  it("stays quiet for the id just minted, even though the list has not caught up", () => {
    expect(isMissingToken(args({ mintedId: "t1" }))).toBe(false);
    expect(isMissingToken(args({ mintedId: "other" }))).toBe(true);
  });
});

describe("useMintedSecret", () => {
  afterEach(() => {
    for (const surface of ["api-tokens", "storage-tokens:self"]) {
      const { result, unmount } = renderHook(() => useMintedSecret(surface));
      act(() => result.current.forget());
      unmount();
    }
  });

  it("publishes a remembered secret to the component that is mounted", () => {
    const { result } = renderHook(() => useMintedSecret("api-tokens"));
    expect(result.current.minted).toBeNull();
    act(() => result.current.remember({ id: "t1", secret: "tmp_abc" }));
    expect(result.current.minted).toEqual({ id: "t1", secret: "tmp_abc" });
    act(() => result.current.forget());
    expect(result.current.minted).toBeNull();
  });

  // THE reason the store is a module Map and not `useState`: minting navigates, the route change
  // remounts the whole page subtree, and component state would be reinitialised by the very click
  // that is supposed to reveal the credential — which the server will never show again.
  it("survives the remount the mint's own navigation causes", () => {
    const first = renderHook(() => useMintedSecret("api-tokens"));
    act(() => first.result.current.remember({ id: "t1", secret: "tmp_abc" }));
    first.unmount();

    const second = renderHook(() => useMintedSecret("api-tokens"));
    expect(second.result.current.minted).toEqual({ id: "t1", secret: "tmp_abc" });
  });

  // Two token families render on the same page. A single slot would let a storage token's secret
  // appear under an API token's facts, attributing a live credential to the wrong principal.
  it("keeps surfaces apart", () => {
    const api = renderHook(() => useMintedSecret("api-tokens"));
    const storage = renderHook(() => useMintedSecret("storage-tokens:self"));
    act(() => api.result.current.remember({ id: "t1", secret: "tmp_abc" }));
    expect(storage.result.current.minted).toBeNull();
    act(() => storage.result.current.remember({ id: "s1", secret: "adh_xyz" }));
    expect(api.result.current.minted).toEqual({ id: "t1", secret: "tmp_abc" });
  });
});
