import { describe, expect, it } from "vitest";
import { BILLING_MEMBER_IDS, isBillingMemberId, parseBillingPath } from "../parse-path";

describe("parseBillingPath", () => {
  it("admits the group unselected", () => {
    expect(parseBillingPath()).toEqual({ memberId: null, entityId: null });
    expect(parseBillingPath([])).toEqual({ memberId: null, entityId: null });
  });

  it("admits every member in the list, and only those", () => {
    for (const id of BILLING_MEMBER_IDS) {
      expect(parseBillingPath([id])).toEqual({ memberId: id, entityId: null });
    }
    expect(parseBillingPath(["bogus"])).toBeNull();
    // Near-misses, because a typo that 200s is the failure mode this parse exists to prevent.
    expect(parseBillingPath(["Setup"])).toBeNull();
    expect(parseBillingPath(["payer"])).toBeNull();
  });

  it("admits one entity below a member", () => {
    expect(parseBillingPath(["offers", "of_1"])).toEqual({ memberId: "offers", entityId: "of_1" });
  });

  it("refuses a third segment", () => {
    expect(parseBillingPath(["offers", "of_1", "anything"])).toBeNull();
    expect(parseBillingPath(["offers", "of_1", "any", "depth", "at", "all"])).toBeNull();
  });

  it("does not validate the entity id", () => {
    // Only the server can adjudicate an offer id; the pane shows its own not-found. The member id
    // is different in kind — a fixed, closed list this package owns.
    expect(parseBillingPath(["payers", "🙂"])).toEqual({ memberId: "payers", entityId: "🙂" });
  });
});

describe("isBillingMemberId", () => {
  it("is true for exactly the five members", () => {
    expect(BILLING_MEMBER_IDS.filter(isBillingMemberId)).toEqual([...BILLING_MEMBER_IDS]);
    expect(isBillingMemberId("stripe")).toBe(true);
    expect(isBillingMemberId("")).toBe(false);
  });
});
