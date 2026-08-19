import { describe, expect, it } from "vitest";
import {
  BILLING_MEMBER_IDS,
  BILLING_MEMBERS_WITH_ENTITY,
  billingMemberTakesEntity,
  isBillingMemberId,
  parseBillingPath,
} from "../parse-path";

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

  // A case per member, driven off the member list itself, so adding a sixth member forces a
  // decision here rather than inheriting whichever branch the loop happens to take.
  it("admits a second segment under exactly the members that have an inner record", () => {
    for (const id of BILLING_MEMBER_IDS) {
      const parsed = parseBillingPath([id, "x_1"]);
      if (billingMemberTakesEntity(id)) {
        expect(parsed).toEqual({ memberId: id, entityId: "x_1" });
      } else {
        expect(parsed).toBeNull();
      }
    }
  });

  // Spelled out as well as looped: `setup` and `events` are the two the loop above proves by
  // absence, and they are the whole point of the rule. Their panes have nothing for a second
  // segment to name, so `/setup/anything` used to 200 with byte-identical content to `/setup` —
  // unbounded distinct URLs over one page, and every typo looking like it worked.
  it("refuses an entity under a member that has no inner record", () => {
    expect(parseBillingPath(["setup", "anything"])).toBeNull();
    expect(parseBillingPath(["events", "evt_1"])).toBeNull();
    expect(parseBillingPath(["stripe", "cfg_1"])).toEqual({ memberId: "stripe", entityId: "cfg_1" });
    expect(parseBillingPath(["payers", "acct_1"])).toEqual({ memberId: "payers", entityId: "acct_1" });
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

describe("billingMemberTakesEntity", () => {
  it("is true for exactly the three members with an inner record", () => {
    expect(BILLING_MEMBER_IDS.filter(billingMemberTakesEntity)).toEqual([...BILLING_MEMBERS_WITH_ENTITY]);
  });

  // Not merely a subset check: a member that admits an entity but is not in the rail's list would
  // be a URL the group cannot render.
  it("names only members that exist", () => {
    for (const id of BILLING_MEMBERS_WITH_ENTITY) expect(isBillingMemberId(id)).toBe(true);
  });
});

describe("isBillingMemberId", () => {
  it("is true for exactly the five members", () => {
    expect(BILLING_MEMBER_IDS.filter(isBillingMemberId)).toEqual([...BILLING_MEMBER_IDS]);
    expect(isBillingMemberId("stripe")).toBe(true);
    expect(isBillingMemberId("")).toBe(false);
  });
});
