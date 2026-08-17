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
 *
 * All three reads follow one rule: a read that FAILED is never rendered as a fact about the
 * world. Two of the three (`/prices`, `/accounts`) are behind `requireBillingOperator`, so for
 * most members of a product a 403 is the ORDINARY response and not an incident — and the
 * natural-looking "no rows, so show the empty state" collapses that into a confident falsehood
 * ("nobody has bought anything", "no Stripe prices are visible") that the reader has no way to
 * disprove from where they are standing. Hence a leading error branch on every section, keyed on
 * the STATUS — `errorStatus` separates "you may not see this" from "this broke", and the two need
 * different words. `error` alone cannot: it is the flattened message string.
 *
 * Three statuses earn their own words, and they are not interchangeable. `requireBillingOperator`
 * asks the `billing` ecosystem flag FIRST and answers 404 when it is off — a fact about the
 * PRODUCT, and the one 4xx here an owner can act on. Only after that does it answer 403 for a
 * caller who does not own the ecosystem — a fact about the READER. 409 is Stripe not being usable.
 * Everything else takes the generic branch, a 401 included: a dead session is the auth layer's to
 * resolve, not a sentence in a billing pane. `errorStatus` is null for a transport or parse
 * failure, which has no status — so those land there too, which is where they belong.
 */
export function BillingPanel({ workspaceSlug }: { workspaceSlug?: string }) {
  const key = `workspace:${workspaceSlug ?? ""}:billing`;
  const loadOffers = useCallback(() => listOffers(), []);
  const loadAccounts = useCallback(() => listAccounts(), []);
  const loadPrices = useCallback(() => listPrices(), []);

  const { items: offers, error: offersError, errorStatus: offersStatus } =
    useResourceList<OfferRow>(`${key}:offers`, loadOffers);
  // `/offers` is NOT admin-gated, but it still answers 403 for two different reasons: the
  // `billing` ecosystem flag being off (crud/factory.ts's `requireEcosystemFlag`, which has no
  // admin exemption — a kill switch an admin walks through is not a kill switch) and the roles
  // gate refusing this caller. The copy below names both rather than picking one, because the
  // status alone cannot tell them apart and guessing produces a confident wrong instruction.
  // reportErrors: false for the same reason as prices, and one more. `GET /billing/accounts` is
  // behind `requireBillingOperator` — every row carries a payer's email — so a member who does not
  // OWN this ecosystem gets a 403 every time this pane renders, and a product with billing not
  // enabled gets a 404. Both are the ordinary state for most of a product's members, not an auth
  // incident, and reporting them would file one bug per member per view.
  const { items: accounts, error: accountsError, errorStatus: accountsStatus } =
    useResourceList<AccountRow>(`${key}:accounts`, loadAccounts, { reportErrors: false });
  // reportErrors: false — a product that has not connected Stripe yet is the ORDINARY state, not
  // an auth incident, and reporting it would file a bug on every unconfigured ecosystem. `/prices`
  // is behind `requireBillingOperator` too, so a non-owner's 403 and a flag-off 404 are just as
  // ordinary and just as unworthy of a bug.
  const { items: prices, error: pricesError, errorStatus: pricesStatus } =
    useResourceList<PriceRow>(`${key}:prices`, loadPrices, { reportErrors: false });

  const priceById = new Map((prices ?? []).map((p) => [p.id, p]));
  const noPrices = prices === null || prices.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="text-lg font-semibold">Stripe</h2>
        {pricesStatus === 404 ? (
          // `requireBillingOperator` answers 404 — not 403 — when the `billing` ecosystem flag is
          // off, and it asks that BEFORE the ownership check, so this branch is about the product
          // and not about the reader. It gets its own branch because it is the one 4xx here that
          // an owner can act on, and folding it into the 403 below would tell them to go find a
          // permission they already have.
          <p className="text-sm text-apt-text-muted">Billing is not enabled for this product.</p>
        ) : pricesStatus === 403 ? (
          // Split out ahead of the empty state, because it is neither an empty catalog nor a
          // missing key: `/prices` is behind `requireBillingOperator`, so this is what every
          // member who does not own the product sees, every render. Left in the branch below it,
          // they would be told to go connect a Stripe key — an instruction that is false, and
          // that they cannot act on.
          <p className="text-sm text-apt-text-muted">
            Stripe details are visible to this product’s owners only.
          </p>
        ) : pricesStatus === 409 ? (
          // The one OUTCOME this panel can state with certainty — Stripe is not usable for this
          // product — and it earns its own branch because it is a setup step rather than a bug:
          // `routes/billing.ts` maps `StripeNotConfiguredError` to 409 precisely so the two are
          // distinguishable. It arrives as an ERROR, not as an empty list, because `listPrices`
          // throws on any non-ok response.
          //
          // The copy names the PLACE, not the remedy, because that error covers three conditions
          // (`stripeClient.ts`: no config row, a row paused with `enabled === false`, or a stored
          // key that is empty) and the status cannot tell them apart. "Add a restricted key" is
          // false for the operator who connected Stripe and then deliberately paused it — the
          // same shape of confident wrong instruction the 403 branch above exists to prevent. All
          // three are fixed in one place, so pointing there is both true and sufficient.
          <p className="text-sm text-apt-text-muted">
            Stripe is not active for this product. Check its Stripe integration under
            Integrations — the connection may be paused, or missing its restricted key.
          </p>
        ) : pricesError ? (
          // Every OTHER failure, ahead of the empty state for the same reason the 403 is: a read
          // that failed is not an observation about Stripe. Without this branch a 500 falls into
          // `noPrices` below and tells the reader to go connect a key — the identical defect the
          // 403 branch above exists to prevent, arriving through a different status.
          <p className="text-sm text-apt-text-muted">Stripe prices could not be loaded.</p>
        ) : noPrices ? (
          // Reached only when the read SUCCEEDED, which is what lets it speak about Stripe at all.
          // The key works and the catalog is genuinely empty, so this asserts nothing it cannot
          // see. (`prices === null` also lands here on the first paint, before the read settles —
          // the whole panel shares that flash, and it self-corrects in one render.)
          <p className="text-sm text-apt-text-muted">
            The connected Stripe account has no active prices yet.
          </p>
        ) : (
          <p className="text-sm text-apt-text-muted">
            {prices.length} active price{prices.length === 1 ? "" : "s"} available.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Offers</h2>
        {offersStatus === 403 ? (
          <p className="text-sm text-apt-text-muted">
            Offers are not visible here. Either billing is not enabled for this product, or your
            role does not include it.
          </p>
        ) : offersError ? (
          <p className="text-sm text-apt-text-muted">Offers could not be loaded.</p>
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
                    {prices === null
                      ? // The prices read has NOT succeeded — it is either still in flight or it
                        // failed. Either way this row's amount is UNKNOWN, and "missing in Stripe"
                        // would be a claim about Stripe's catalog inferred from our own failure to
                        // read it. `/prices` is owners-only, so for every member who does not own
                        // the product that failure is the ORDINARY case on every render: without this branch the
                        // panel tells them their entire catalog is broken. Same defect the three
                        // section headers above each carry their own branch to prevent — it hid
                        // here because this join reads the list rather than its status.
                        pricesError
                        ? "price could not be loaded"
                        : "…"
                      : price
                        ? formatPrice(price)
                        : // Reached only when the read SUCCEEDED, which is what lets it speak about
                          // Stripe at all. Deliberately explicit rather than blank: an offer
                          // pointing at a deleted Stripe price sells nothing, and silence hides it.
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
        {accountsStatus === 404 ? (
          // Billing is off for this product (`requireBillingOperator`'s flag check, asked before
          // the ownership one). Same reason as the prices section: it is the one 4xx an owner can
          // act on, so it must not arrive wearing a permissions message.
          <p className="text-sm text-apt-text-muted">Billing is not enabled for this product.</p>
        ) : accountsStatus === 403 ? (
          // The failure is reported, never rendered as emptiness. This read is owners-only, so the
          // overwhelmingly common error here is a non-owner's 403 — and showing that as "nobody has
          // bought anything yet" tells a member of a selling product that it has no customers,
          // which is both false and unfalsifiable from where they are standing.
          <p className="text-sm text-apt-text-muted">
            Payer details are visible to this product’s owners only.
          </p>
        ) : accountsError ? (
          // An owner hitting a 500 must not be told they lack rights — that is the same
          // defect as the empty state, just pointed the other way: a failed read dressed up as a
          // settled fact, and one that sends the one person who CAN fix it looking at permissions.
          <p className="text-sm text-apt-text-muted">Payer details could not be loaded.</p>
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
