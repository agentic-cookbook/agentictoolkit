import { describe, expect, it } from "vitest";
import { formatPrice, minorUnitFactor } from "../format-price";

describe("minorUnitFactor", () => {
  it("is 100 for a two-place currency", () => expect(minorUnitFactor("USD")).toBe(100));
  // The whole reason this function exists rather than a literal /100: Stripe quotes unit_amount in
  // the SMALLEST unit, and ¥2500 divided by 100 is a price shown to the operator as fact and wrong
  // by two orders of magnitude.
  it("is 1 for a zero-decimal currency", () => expect(minorUnitFactor("JPY")).toBe(1));
  it("is 1000 for a three-decimal currency", () => expect(minorUnitFactor("KWD")).toBe(1000));
  it("falls back to 100 for a code Intl rejects", () => expect(minorUnitFactor("NOPE")).toBe(100));
});

describe("formatPrice", () => {
  const base = { id: "p", productId: "pr", productName: null, currency: "usd", interval: null };
  it("renders a whole-unit amount", () => {
    expect(formatPrice({ ...base, unitAmount: 2500 })).toMatch(/25/);
  });
  it("appends the interval when there is one", () => {
    expect(formatPrice({ ...base, unitAmount: 2500, interval: "month" })).toMatch(/\/month$/);
  });
  it('says "custom" for a null amount rather than rendering a zero', () => {
    expect(formatPrice({ ...base, unitAmount: null })).toBe("custom");
  });
});
