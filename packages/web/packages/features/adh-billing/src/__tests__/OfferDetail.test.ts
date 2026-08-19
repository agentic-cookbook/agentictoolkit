import { describe, expect, it } from "vitest";
import { offerBlank, offerDiffers, offerNormalize, offerToInput, offerValidate } from "../OfferDetail";
import type { OfferRow } from "../api/billing";

const row = (o: Partial<OfferRow>): OfferRow => ({
  id: "of_x", slug: "pro", name: "Pro", description: null, purpose: "access",
  stripePriceId: "price_1", stripeProductId: null, collectionMethod: "charge_automatically",
  daysUntilDue: null, grantsEcosystemId: null, lapseAction: "none", graceDays: 0,
  isActive: true, ...o,
});

describe("offerValidate", () => {
  it("requires a name, a slug and a price", () => {
    expect(offerValidate(offerBlank(), [])).toMatch(/name/i);
    expect(offerValidate({ ...offerBlank(), name: "Pro" }, [])).toMatch(/slug/i);
    expect(offerValidate({ ...offerBlank(), name: "Pro", slug: "pro" }, [])).toMatch(/price/i);
  });

  it("refuses a slug another offer already holds", () => {
    const d = { ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1" };
    expect(offerValidate(d, [row({ id: "of_1", slug: "pro" })])).toMatch(/already/i);
    expect(offerValidate(d, [row({ id: "of_1", slug: "team" })])).toBeNull();
  });

  // ck_billing_offers_days_until_due — an IFF, in both directions. Getting this wrong is a raw
  // constraint-violation 500 naming a column the operator never saw.
  it("ties daysUntilDue to send_invoice in both directions", () => {
    const base = { ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1" };
    expect(offerValidate({ ...base, collectionMethod: "send_invoice" }, [])).toMatch(/days/i);
    expect(offerValidate({ ...base, daysUntilDue: 30 }, [])).toMatch(/days/i);
    expect(offerValidate({ ...base, collectionMethod: "send_invoice", daysUntilDue: 30 }, [])).toBeNull();
  });

  // ck_billing_offers_grants — a granted ecosystem only makes sense for purpose = access.
  it("allows grantsEcosystemId only when the purpose is access", () => {
    const base = { ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1" };
    expect(offerValidate({ ...base, purpose: "goods", grantsEcosystemId: "eco_2" }, [])).toMatch(/access/i);
    expect(offerValidate({ ...base, purpose: "access", grantsEcosystemId: "eco_2" }, [])).toBeNull();
  });

  it("refuses a negative grace period", () => {
    const base = { ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1" };
    expect(offerValidate({ ...base, graceDays: -1 }, [])).toMatch(/grace/i);
  });
});

describe("offerNormalize", () => {
  it("trims, and turns an emptied optional field into null rather than an empty string", () => {
    const d = offerNormalize({ ...offerBlank(), name: "  Pro  ", slug: " pro ", description: "   ", grantsEcosystemId: "" });
    expect(d.name).toBe("Pro");
    expect(d.slug).toBe("pro");
    expect(d.description).toBeNull();
    expect(d.grantsEcosystemId).toBeNull();
  });
});

describe("offerDiffers", () => {
  // The dirty signal drives Save and the unsaved-changes guard, so a false positive costs the
  // operator a confirm dialog for an edit that changed nothing.
  it("does not call a null field edited when the input hands back an empty string", () => {
    const saved = offerToInput(row({ description: null, grantsEcosystemId: null }));
    expect(offerDiffers(saved, { ...saved, description: "", grantsEcosystemId: "" })).toBe(false);
  });

  it("does not call a field edited when only surrounding whitespace changed", () => {
    const saved = offerToInput(row({ name: "Pro" }));
    expect(offerDiffers(saved, { ...saved, name: "  Pro  " })).toBe(false);
  });

  // `offerToInput` spreads a row while `offerBlank` writes a literal, so two drafts holding the
  // same values can disagree on key ORDER — which a bare JSON.stringify comparison would report
  // as an edit.
  it("ignores key order", () => {
    const saved = offerToInput(row({}));
    const reordered = Object.fromEntries(
      Object.entries(saved).reverse(),
    ) as unknown as typeof saved;
    expect(offerDiffers(saved, reordered)).toBe(false);
  });

  it("still reports a real edit", () => {
    const saved = offerToInput(row({ name: "Pro" }));
    expect(offerDiffers(saved, { ...saved, name: "Team" })).toBe(true);
    expect(offerDiffers(saved, { ...saved, graceDays: 3 })).toBe(true);
  });
});
