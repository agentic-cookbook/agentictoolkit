import { describe, it, expect } from "vitest";
import { parseStoragePath, STORAGE_MEMBER_IDS } from "./parse-path";

// What this file is really about is the NULLs. A parse that only reads segments[0] and
// segments[1] passes every "it opens the right pane" case below and still leaves both hosts
// answering 200 to `/<base>/bogus` and to any depth at all — the failure a catch-all route
// invites, and the one no typecheck can see.
describe("parseStoragePath", () => {
  // The one assertion here that is about the PRODUCT rather than the parse. Every other case walks
  // this list, so they all stay green if a member is dropped or the order is shuffled — the rail
  // would simply offer fewer rows, or the same rows rearranged, and say so nowhere. The rail's
  // order IS this array's order (StorageGroup maps over it), so spelling it out is what pins the
  // four rows, in this order, that the Storage surface is specified to show.
  it("offers exactly Buckets, Access, All Data, Tokens, in rail order", () => {
    expect(STORAGE_MEMBER_IDS).toEqual(["buckets", "access", "all-data", "tokens"]);
  });

  it("opens the group unselected for a bare route", () => {
    expect(parseStoragePath(undefined)).toEqual({ memberId: null, entityId: null });
    expect(parseStoragePath([])).toEqual({ memberId: null, entityId: null });
  });

  it("opens EVERY member the rail offers, and an entity inside it", () => {
    // Walked from the exported list rather than spelled out: a member added there without a
    // grammar to reach it is the drift this pairing exists to prevent.
    for (const member of STORAGE_MEMBER_IDS) {
      expect(parseStoragePath([member]), member).toEqual({ memberId: member, entityId: null });
      expect(parseStoragePath([member, "b_1"]), member).toEqual({ memberId: member, entityId: "b_1" });
    }
  });

  it("rejects a first segment that names no member", () => {
    expect(parseStoragePath(["bogus"])).toBeNull();
    expect(parseStoragePath(["bogus", "b_1"])).toBeNull();
    // Including one that is a member of some OTHER rail — nothing here is a catch-all fallback.
    expect(parseStoragePath(["settings"])).toBeNull();
  });

  it("rejects anything deeper than member ▸ entity", () => {
    expect(parseStoragePath(["buckets", "b_1", "extra"])).toBeNull();
    expect(parseStoragePath(["buckets", "b_1", "any", "depth", "at", "all"])).toBeNull();
  });

  it("leaves the entity id alone — only the server can adjudicate it", () => {
    // The asymmetry is the point: the member list is closed and this package owns it, while an
    // entity id is a backend fact. Rejecting an unknown bucket here would need a round trip, and
    // the pane already shows its own not-found for one.
    expect(parseStoragePath(["buckets", "definitely-not-a-bucket"])).toEqual({
      memberId: "buckets",
      entityId: "definitely-not-a-bucket",
    });
  });
});
