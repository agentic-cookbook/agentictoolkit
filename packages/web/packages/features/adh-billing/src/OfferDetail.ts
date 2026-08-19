import type { OfferBody, OfferRow } from "./api/billing";

/** The editor's draft. Identical to the request body by construction, so there is no third shape
 *  to keep in step and no mapping step where a field can be dropped. */
export type OfferInput = OfferBody;

/** A new offer, at the table's own defaults (db/schema/billing.ts). */
export function offerBlank(): OfferInput {
  return {
    slug: "",
    name: "",
    description: null,
    purpose: "access",
    stripePriceId: "",
    stripeProductId: null,
    collectionMethod: "charge_automatically",
    daysUntilDue: null,
    grantsEcosystemId: null,
    lapseAction: "none",
    graceDays: 0,
    isActive: true,
  };
}

export function offerToInput(row: OfferRow): OfferInput {
  const { id: _id, ...rest } = row;
  return rest;
}

export function offerDiffers(a: OfferInput, b: OfferInput): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** "" is what an emptied text input holds; the column is nullable and `null` is what "unset"
 *  means. Storing the empty string instead makes `grants_ecosystem_id = ''` a value that satisfies
 *  no foreign lookup and fails no NOT NULL check. */
const orNull = (s: string | null): string | null => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

export function offerNormalize(d: OfferInput): OfferInput {
  return {
    ...d,
    slug: d.slug.trim(),
    name: d.name.trim(),
    description: orNull(d.description),
    stripePriceId: d.stripePriceId.trim(),
    stripeProductId: orNull(d.stripeProductId),
    grantsEcosystemId: orNull(d.grantsEcosystemId),
  };
}

/**
 * Everything the row must satisfy before it is worth a round trip — including the table's own
 * CHECK constraints, restated here on purpose.
 *
 * Restating a database constraint in a form is usually duplication worth avoiding. It is not here,
 * because the alternative is what the operator currently gets: Postgres raises 23514 naming
 * `ck_billing_offers_days_until_due`, generic CRUD surfaces it as a 500, and the message names a
 * constraint the operator has never seen attached to no field. The DB stays the authority; this
 * is the sentence a person can act on.
 *
 * `others` is every row except the one being edited, so the slug check is about a genuine
 * collision rather than about the row's own value. The uniqueness is per ECOSYSTEM and partial on
 * the tombstone (uq_billing_offers_slug), which is why a deleted offer's slug is free again — and
 * why `others` must come from the live list rather than from anything wider.
 */
export function offerValidate(d: OfferInput, others: OfferRow[]): string | null {
  const n = offerNormalize(d);
  if (!n.name) return "A name is required.";
  if (!n.slug) return "A slug is required.";
  if (n.slug.length > 128) return "A slug is at most 128 characters.";
  if (!n.stripePriceId) return "Choose the Stripe price this offer sells.";
  if (others.some((o) => o.slug === n.slug)) return `Another offer already uses the slug “${n.slug}”.`;

  // ck_billing_offers_days_until_due: an IFF, both directions.
  if (n.collectionMethod === "send_invoice" && n.daysUntilDue === null) {
    return "Invoiced offers need a number of days until due.";
  }
  if (n.collectionMethod !== "send_invoice" && n.daysUntilDue !== null) {
    return "Days until due applies only to invoiced offers.";
  }
  if (n.daysUntilDue !== null && n.daysUntilDue < 0) return "Days until due cannot be negative.";

  // ck_billing_offers_grants.
  if (n.purpose !== "access" && n.grantsEcosystemId !== null) {
    return "Only an access offer can grant an ecosystem.";
  }

  // ck_billing_offers_grace_days.
  if (n.graceDays < 0) return "The grace period cannot be negative.";
  return null;
}
