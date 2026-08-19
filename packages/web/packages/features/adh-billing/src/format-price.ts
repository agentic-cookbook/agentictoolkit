import type { PriceRow } from "./api/billing";

export function formatPrice(p: PriceRow): string {
  if (p.unitAmount === null) return "custom";
  const currency = p.currency.toUpperCase();
  const amount = (p.unitAmount / minorUnitFactor(currency)).toLocaleString(undefined, {
    style: "currency",
    currency,
  });
  return p.interval ? `${amount}/${p.interval}` : amount;
}

/**
 * How many of Stripe's minor units make one whole unit of `currency`.
 *
 * Stripe quotes `unit_amount` in the currency's SMALLEST unit, and that is not always a
 * hundredth: JPY, KRW, VND and friends have no minor unit at all, so ¥2500 arrives as 2500 and
 * dividing by 100 renders it as ¥25 — a price off by two orders of magnitude, shown to the
 * operator as fact. A few currencies (BHD, KWD, TND) go the other way with three places.
 *
 * `Intl` already ships that table, so ask it instead of keeping a list here that would go stale
 * silently. A code `Intl` does not know throws, and two places is its own default for that case.
 */
export function minorUnitFactor(currency: string): number {
  try {
    const { maximumFractionDigits } = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).resolvedOptions();
    // `resolvedOptions()` types this as optional — a currency Intl resolves but declines to
    // quantify falls back to the same two places the `catch` below uses.
    return 10 ** (maximumFractionDigits ?? 2);
  } catch {
    return 100;
  }
}
