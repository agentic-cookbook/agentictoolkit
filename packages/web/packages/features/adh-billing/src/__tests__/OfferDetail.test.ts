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

  /**
   * Both day counts are Postgres `integer`. `NaN` is the one that got through: it is what
   * `numOrNull` (OffersPane) returns for any non-empty text that does not parse, and every
   * comparison against it is false — so `n.daysUntilDue < 0` passed it straight to the driver,
   * which answers with a type error naming a column, on the one pane whose reason for restating
   * the constraints is that such errors are unactionable.
   */
  it("refuses a day count that is not a finite whole number", () => {
    const base = {
      ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1",
      collectionMethod: "send_invoice" as const,
    };
    expect(offerValidate({ ...base, daysUntilDue: Number.NaN }, [])).toMatch(/whole number/i);
    expect(offerValidate({ ...base, daysUntilDue: 1.5 }, [])).toMatch(/whole number/i);
    expect(offerValidate({ ...base, daysUntilDue: Number.POSITIVE_INFINITY }, [])).toMatch(/whole number/i);
    expect(offerValidate({ ...base, daysUntilDue: 2147483648 }, [])).toMatch(/at most/i);
    expect(offerValidate({ ...base, daysUntilDue: 30 }, [])).toBeNull();

    const auto = { ...base, collectionMethod: "charge_automatically" as const, daysUntilDue: null };
    expect(offerValidate({ ...auto, graceDays: Number.NaN }, [])).toMatch(/whole number/i);
    expect(offerValidate({ ...auto, graceDays: 0.5 }, [])).toMatch(/whole number/i);
    expect(offerValidate({ ...auto, graceDays: 2147483648 }, [])).toMatch(/at most/i);
  });

  // The varchar widths. Over-long text otherwise reaches Postgres as a 22001 that generic CRUD
  // surfaces as a 500 naming no field, which is the same failure mode as the CHECK constraints.
  it("refuses text wider than its column", () => {
    const base = { ...offerBlank(), name: "Pro", slug: "pro", stripePriceId: "price_1" };
    expect(offerValidate({ ...base, name: "n".repeat(256) }, [])).toMatch(/name is at most 255/i);
    expect(offerValidate({ ...base, stripePriceId: `price_${"x".repeat(250)}` }, [])).toMatch(/price id is at most 255/i);
    expect(offerValidate({ ...base, stripeProductId: "p".repeat(256) }, [])).toMatch(/product id is at most 255/i);
    expect(
      offerValidate({ ...base, purpose: "access", grantsEcosystemId: "e".repeat(37) }, []),
    ).toMatch(/ecosystem id is at most 36/i);
    // The boundary itself is legal — an off-by-one here rejects a value the column accepts.
    expect(offerValidate({ ...base, name: "n".repeat(255) }, [])).toBeNull();
    expect(offerValidate({ ...base, grantsEcosystemId: "e".repeat(36) }, [])).toBeNull();
  });
});

describe("offerToInput", () => {
  /**
   * The body a PUT actually carries. `GET /api/billing/offers` is generic CRUD over the whole
   * table, so the parsed JSON holds columns `OfferRow` never declares — and the old
   * `const { id: _id, ...rest } = row` subtracted exactly one of them. TypeScript could not see
   * that (a rest spread gets no excess-property check, and the declared type says the extras do
   * not exist), which is why only a fixture carrying them can catch it.
   */
  const wire = {
    ...row({}),
    ecosystemId: "eco_1",
    ownerKind: "ecosystem",
    ownerId: "eco_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: null,
  } as unknown as OfferRow;

  it("carries exactly the fields a blank draft has, and no server-owned passengers", () => {
    expect(Object.keys(offerToInput(wire)).sort()).toEqual(Object.keys(offerBlank()).sort());
    // Also named one by one: the set comparison above would still pass if a passenger arrived in
    // place of a real field rather than alongside it.
    for (const k of ["id", "ecosystemId", "ownerKind", "ownerId", "createdAt", "updatedAt", "deletedAt"]) {
      expect(offerToInput(wire)).not.toHaveProperty(k);
    }
  });

  it("copies the twelve editable values through unchanged", () => {
    expect(offerToInput(wire)).toEqual({
      slug: "pro", name: "Pro", description: null, purpose: "access",
      stripePriceId: "price_1", stripeProductId: null,
      collectionMethod: "charge_automatically", daysUntilDue: null,
      grantsEcosystemId: null, lapseAction: "none", graceDays: 0, isActive: true,
    });
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

  // A draft reaches `offerDiffers` through the form's `{ ...draft, field: value }` spreads and
  // through callers that rebuild it, so two drafts holding identical values can still disagree on
  // key ORDER — which a bare JSON.stringify comparison would report as an edit.
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
