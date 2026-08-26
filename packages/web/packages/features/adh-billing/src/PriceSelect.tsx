"use client";

import type { ReactElement } from "react";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { formatPrice } from "./format-price";
import type { PriceRow } from "./api/billing";

/**
 * The offer editor's Stripe price picker — and, when the price list could not be read, a plain
 * text input that says why.
 *
 * The degrade is the whole reason this is a component rather than four lines inside the offer
 * form. `/prices` is behind `requireBillingOperator` AND answers 409 when Stripe is unusable, so a
 * failed read is an ORDINARY state here, not an incident — and the natural-looking "no rows, so
 * render an empty select" turns our own failure to read into a confident statement about Stripe's
 * catalog that the operator cannot disprove from where they are standing. Worse, it strands them:
 * an empty select cannot hold the id they already have.
 *
 * The words are keyed on the STATUS, never on error-presence, because the three of them are not
 * interchangeable — 404 is the Setup switch, 409 is the Stripe topic, and everything else
 * (including a 403, and a null status for a transport failure) is neither.
 */
export function PriceSelect({
  value,
  onChange,
  prices,
  error,
  errorStatus,
}: {
  value: string;
  onChange: (priceId: string, price: PriceRow | null) => void;
  /** null = the read has not succeeded: still in flight, or failed. `error` tells them apart. */
  prices: PriceRow[] | null;
  error: string | null;
  errorStatus: number | null;
}): ReactElement {
  if (error) {
    const why =
      errorStatus === 404
        ? "Billing is not enabled for this ecosystem — turn it on under Setup. Enter the price id by hand in the meantime."
        : errorStatus === 409
          ? "Stripe is not active for this ecosystem. Check the Stripe topic — the connection may be paused, or missing its restricted key. Enter the price id by hand in the meantime."
          : errorStatus === 403
            ? "Stripe prices are visible to this ecosystem's owners only. Enter the price id by hand if you know it."
            : "Stripe prices could not be loaded. Enter the price id by hand in the meantime.";
    return (
      <div className="flex flex-col gap-1">
        <Input
          value={value}
          placeholder="price_…"
          onChange={(e) => onChange(e.target.value, null)}
        />
        <p className="text-xs text-apt-text-muted">{why}</p>
      </div>
    );
  }

  const rows = prices ?? [];
  // A stored id the loaded catalog does not contain. Deliberately explicit rather than blank: adh
  // keeps no copy of Stripe's catalog by design, and an offer pointing at a deleted price sells
  // nothing. Silence would hide that, and a select that simply dropped the value would silently
  // rewrite the offer on the next save.
  const unresolved = value !== "" && !rows.some((p) => p.id === value);

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          onChange(id, rows.find((p) => p.id === id) ?? null);
        }}
      >
        <option value="">{prices === null ? "Loading…" : "Choose a price…"}</option>
        {unresolved ? <option value={value}>{value} — missing in Stripe</option> : null}
        {rows.map((p) => (
          <option key={p.id} value={p.id}>
            {`${p.productName ?? p.productId} — ${formatPrice(p)}`}
          </option>
        ))}
      </Select>
      {unresolved ? (
        <p className="text-xs text-apt-text-muted">
          This offer&rsquo;s price is missing in Stripe, so it currently sells nothing.
        </p>
      ) : null}
    </div>
  );
}
