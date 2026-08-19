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

/**
 * The saved row, as the editor's draft — built EXPLICITLY, key by key, from the same twelve fields
 * {@link offerBlank} names.
 *
 * It used to be `const { id: _id, ...rest } = row; return rest;`, which subtracted exactly one key
 * and is not what the type says. `OfferInput` is `Omit<OfferRow,"id">`, a COMPILE-time shape; the
 * value at runtime is whatever generic CRUD's `GET /api/billing/offers` actually returned, which is
 * the whole table — so `createdAt`, `updatedAt`, `ecosystemId`, `ownerKind`, `ownerId` and
 * `deletedAt` all rode along on every PUT. A rest spread is not a fresh object literal, so
 * TypeScript performs no excess-property check and nothing complained.
 *
 * An object literal DOES get that check, and — more usefully — a column added to `OfferRow` later
 * becomes a missing-property compile error right here, where a reader can compare this list against
 * the form, instead of a silent passenger on every update.
 */
export function offerToInput(row: OfferRow): OfferInput {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    stripePriceId: row.stripePriceId,
    stripeProductId: row.stripeProductId,
    collectionMethod: row.collectionMethod,
    daysUntilDue: row.daysUntilDue,
    grantsEcosystemId: row.grantsEcosystemId,
    lapseAction: row.lapseAction,
    graceDays: row.graceDays,
    isActive: row.isActive,
  };
}

/** Both sides go through `offerNormalize` first, because the form's text bindings write `""` into
 *  a field the row stores as `null` (`value={draft.description ?? ""}` — clearing a null
 *  description hands back an empty string, not null). Comparing the raw drafts would call that
 *  dirty: Save lights up and the unsaved-changes guard fires for an edit that changed nothing.
 *  Normalizing is also what makes the comparison honest in the other direction — `"" ` and `null`
 *  are the same value to this column, so a difference between them is not an edit.
 *
 *  Keys are sorted rather than compared in insertion order, because `JSON.stringify` is
 *  order-sensitive and neither draft's key order is this function's to rely on. `offerToInput` and
 *  `offerBlank` do now write the same twelve keys in the same order, but a draft reaches here
 *  through the form's `{ ...draft, field: value }` spreads and through callers that rebuild it,
 *  and an order difference between two drafts holding identical values is not an edit. */
const stableKey = (d: OfferInput): string => {
  const n = offerNormalize(d) as unknown as Record<string, unknown>;
  return JSON.stringify(Object.keys(n).sort().map((k) => [k, n[k]]));
};

export function offerDiffers(a: OfferInput, b: OfferInput): boolean {
  return stableKey(a) !== stableKey(b);
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
