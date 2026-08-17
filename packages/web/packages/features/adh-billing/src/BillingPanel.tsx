"use client";

import { useCallback } from "react";
import { useResourceList } from "@agentic-toolkit/data";
import {
  listAccounts,
  listOffers,
  listPrices,
  type AccountRow,
  type OfferRow,
  type PriceRow,
} from "./api/billing";

/**
 * The Billing pane: what this product sells, and who is paying for it.
 *
 * Amounts are rendered from the LIVE Stripe price list joined on `stripe_price_id`, never from
 * a stored number — adh keeps no copy of Stripe's catalog (spec §1). An offer whose price no
 * longer resolves renders as "missing in Stripe" rather than as a stale figure, which is the
 * whole benefit of not caching it.
 */
export function BillingPanel({ workspaceSlug }: { workspaceSlug?: string }) {
  const key = `workspace:${workspaceSlug ?? ""}:billing`;
  const loadOffers = useCallback(() => listOffers(), []);
  const loadAccounts = useCallback(() => listAccounts(), []);
  const loadPrices = useCallback(() => listPrices(), []);

  const { items: offers, error: offersError } = useResourceList<OfferRow>(
    `${key}:offers`,
    loadOffers,
  );
  // reportErrors: false for the same reason as prices, and one more. `GET /billing/accounts` is
  // `requireAdmin` — every row carries a payer's email — so a non-admin member of the workspace
  // gets a 403 EVERY time this pane renders. That is the ordinary state for most of a product's
  // members, not an auth incident, and reporting it would file one bug per member per view.
  const { items: accounts, error: accountsError } = useResourceList<AccountRow>(
    `${key}:accounts`,
    loadAccounts,
    { reportErrors: false },
  );
  // reportErrors: false — a product that has not connected Stripe yet is the ORDINARY state, not
  // an auth incident, and reporting it would file a bug on every unconfigured ecosystem.
  const { items: prices } = useResourceList<PriceRow>(`${key}:prices`, loadPrices, {
    reportErrors: false,
  });

  const priceById = new Map((prices ?? []).map((p) => [p.id, p]));
  const noPrices = prices === null || prices.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="text-lg font-semibold">Stripe</h2>
        {noPrices ? (
          // Deliberately does NOT assert which of the two causes this is. `prices === null`
          // covers both the 409 from an ecosystem with no Stripe key AND any other read
          // failure, and an empty array means the key works and the catalog is empty. The
          // panel cannot tell them apart, so it states the observation and names both
          // remedies rather than diagnosing.
          <p className="text-sm text-apt-text-muted">
            No active Stripe prices are visible. Either no restricted Stripe key is connected
            under Integrations, or the connected account has no active prices yet.
          </p>
        ) : (
          <p className="text-sm text-apt-text-muted">
            {prices.length} active price{prices.length === 1 ? "" : "s"} available.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Offers</h2>
        {offersError ? (
          <p className="text-sm text-apt-text-muted">Billing is not enabled for this product.</p>
        ) : (offers ?? []).length === 0 ? (
          <p className="text-sm text-apt-text-muted">Nothing is for sale yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(offers ?? []).map((o) => {
              const price = priceById.get(o.stripePriceId);
              return (
                <li key={o.id} className="flex items-baseline justify-between gap-4">
                  <span>{o.name}</span>
                  <span className="text-sm text-apt-text-muted">
                    {price
                      ? formatPrice(price)
                      : // Deliberately explicit rather than blank: an offer pointing at a deleted
                        // Stripe price sells nothing, and silence would hide that.
                        "missing in Stripe"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Payers</h2>
        {accountsError ? (
          // The failure is reported, never rendered as emptiness. This read is admin-only, so the
          // overwhelmingly common error here is a non-admin's 403 — and showing that as "nobody has
          // bought anything yet" tells a member of a selling product that it has no customers,
          // which is both false and unfalsifiable from where they are standing.
          <p className="text-sm text-apt-text-muted">
            Payer details are visible to product admins only.
          </p>
        ) : (accounts ?? []).length === 0 ? (
          <p className="text-sm text-apt-text-muted">Nobody has bought anything yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(accounts ?? []).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4">
                <span>{a.payerEmail ?? "unknown"}</span>
                <span className="text-sm text-apt-text-muted">
                  {a.status}
                  {a.claimedCustomerId ? "" : " · unclaimed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatPrice(p: PriceRow): string {
  if (p.unitAmount === null) return "custom";
  const amount = (p.unitAmount / 100).toLocaleString(undefined, {
    style: "currency",
    currency: p.currency.toUpperCase(),
  });
  return p.interval ? `${amount}/${p.interval}` : amount;
}
