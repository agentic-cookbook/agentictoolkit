"use client";

import { useCallback } from "react";
import type { ReactElement } from "react";
import { Tag, Trash2 } from "lucide-react";
import { useResourceList } from "@agentic-toolkit/data";
import {
  RecordSettingsPane,
  useMasterDetailForm,
  useMasterDetailLevel,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import {
  createOffer,
  deleteOffer,
  listOffers,
  listPrices,
  updateOffer,
  type OfferRow,
  type PriceRow,
} from "./api/billing";
import {
  offerBlank,
  offerDiffers,
  offerNormalize,
  offerToInput,
  offerValidate,
  type OfferInput,
} from "./OfferDetail";
import { PriceSelect } from "./PriceSelect";

/**
 * An emptied `<input type="number">` reports `""`, and `Number("")` is 0 — a value the operator
 * never typed. `daysUntilDue` is nullable, and 0 is a MEANING there ("due immediately"), not a
 * blank, so an emptied field has to reach the API as `null`; `offerValidate` names what is
 * missing when it does.
 *
 * `graceDays` is NOT NULL at the table's own default of 0, so an emptied field there ends up as
 * 0 either way — `numOrNull(v) ?? 0` is behaviourally identical to the `Number(v)` it replaced.
 * Its caller uses it anyway so the default is stated explicitly, rather than left resting on
 * `Number("") === 0`, which is a coincidence of JS coercion, not an intention.
 */
const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

/**
 * Offers — what this ecosystem sells, as a master/detail over generic CRUD's `billing.offers`.
 *
 * The write bodies carry NONE of the masked columns: `id`, `createdAt`, `updatedAt` are
 * SERVER_MANAGED; `ownerKind`/`ownerId` are stamped from the creating principal; `deletedAt` is
 * the tombstone. `ecosystemId` is omitted too — technically writable, but the factory fills it
 * from the caller's scope, which is the only correct value.
 *
 * That is kept true by `offerToInput` naming the twelve writable fields explicitly, NOT by the
 * server refusing the rest and not by the `OfferInput = Omit<OfferRow,"id">` type: the type is
 * erased at runtime, and generic CRUD's body schemas are plain `z.object`s (crud/generate.ts's
 * `crudBodySchemas`), which STRIP an undeclared key silently and ACCEPT `ecosystemId`, since that
 * one is the declared scope column. See `api/billing.ts`'s `OfferBody` for the full account.
 *
 * `ecosystemId` is a prop and is not sent anywhere: these routes scope by the bearer token's
 * acting ecosystem. It is here so the resource cache is keyed per ecosystem, which is what keeps
 * two ecosystems in one session from reading each other's rows out of cache.
 */
export function OffersPane({
  ecosystemId,
  leaf,
}: {
  ecosystemId?: string;
  leaf?: TopicLeaf;
}): ReactElement {
  const key = `billing:${ecosystemId ?? ""}`;
  const loadOffers = useCallback(() => listOffers(), []);
  // reportErrors: false — with the `billing` flag off (the ordinary state of a fresh ecosystem)
  // this answers 403 on every render, and with a non-owner reading it, likewise. Reporting those
  // would file one bug per member per view.
  const {
    items: offers,
    reload,
    error: offersError,
    errorStatus: offersStatus,
  } = useResourceList<OfferRow>(`${key}:offers`, loadOffers, { reportErrors: false });

  const loadPrices = useCallback(() => listPrices(), []);
  const {
    items: prices,
    error: pricesError,
    errorStatus: pricesStatus,
  } = useResourceList<PriceRow>(`${key}:prices`, loadPrices, { reportErrors: false });

  /**
   * One sentence for a failed read, used by BOTH surfaces that can show one — the rail's empty
   * caption and the detail's load error. They used to be written separately and disagreed: the
   * detail discriminated on the STATUS (a 403 with the flag off is a fact about the ecosystem an
   * owner can act on) while the rail keyed on error-PRESENCE and said "Offers could not be
   * loaded." beside it, which names a cause the status does not support.
   *
   * The status, not the message: generic CRUD's gate answers 403 both for the flag being off and
   * for a role that does not include billing, and those are the same sentence to the person
   * reading it — one place to look, one thing to check.
   */
  const offersProblem =
    offersStatus === 403
      ? "Offers are not visible here. Either billing is not enabled for this ecosystem, or your role does not include it."
      : offersError
        ? "Offers could not be loaded."
        : null;

  const form = useMasterDetailForm<OfferRow, OfferInput>({
    items: offers,
    getId: (o) => o.id,
    urlSelection: leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined,
    blank: offerBlank,
    toInput: offerToInput,
    validate: offerValidate,
    differs: offerDiffers,
    normalize: offerNormalize,
    create: (input) => createOffer(input),
    update: (id, input) => updateOffer(id, input),
    remove: (o) => deleteOffer(o.id),
    confirmDelete: (o) =>
      `Delete the offer “${o.name}”? Existing payers keep their accounts; nothing new can be bought through it.`,
    refresh: reload,
    createLabel: "New offer",
  });

  useMasterDetailLevel({
    id: "billing-offers",
    title: "Offers",
    form,
    items: offers,
    getId: (o) => o.id,
    getLabel: (o) => o.name,
    getSublabel: (o) => (o.isActive ? o.slug : `${o.slug} · inactive`),
    itemIcon: <Tag size={16} aria-hidden />,
    newLabel: "New offer",
    leaf,
    emptyLabel: offersProblem ?? "Nothing is for sale yet.",
    itemNoun: "offer",
  });

  return (
    <RecordSettingsPane
      form={form}
      items={offers}
      getId={(o) => o.id}
      title="Offer"
      loadError={offersProblem}
      emptyLabel="Select an offer, or create one."
      // `RecordSettingsPane` passes `showDelete={false}` to ButtonBar, so the bar's own Delete
      // never renders — but the confirm modal it drives sits OUTSIDE that guard, so a button
      // here reuses the whole flow (`confirmDelete` → AlertModal → `remove`). Without it the
      // form's `remove`/`confirmDelete` are unreachable and an offer can never be deleted.
      trailing={
        <Button
          size="sm"
          variant="destructive-ghost"
          onClick={form.actions.onDelete}
          disabled={!form.actions.canDelete}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      }
      renderDetail={(draft) => (
        <FieldGroup title="What this offer sells">
          {/* RecordSettingsPane renders only `loadError`; the save/delete failure lives in
              `form.error` and is rendered nowhere else, so it goes here rather than being
              invisible on a failed write. See useMasterDetailForm.ts — `blockedReason` (a
              validation failure) is already surfaced by ButtonBar, so this covers the OTHER
              failure mode: a save or delete that reached the server and came back rejected. */}
          <ErrorText error={form.error} />
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => form.onChange({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Unique within this ecosystem; freed again if the offer is deleted.">
            <Input value={draft.slug} onChange={(e) => form.onChange({ ...draft, slug: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) => form.onChange({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label="Purpose" hint="Only an access offer can grant an ecosystem.">
            <Select
              value={draft.purpose}
              onChange={(e) =>
                form.onChange({
                  ...draft,
                  purpose: e.target.value as OfferInput["purpose"],
                  // Cleared with the purpose, because ck_billing_offers_grants would otherwise
                  // reject the save with a constraint name the operator never saw.
                  grantsEcosystemId: e.target.value === "access" ? draft.grantsEcosystemId : null,
                })
              }
            >
              <option value="access">Access</option>
              <option value="service">Service</option>
              <option value="goods">Goods</option>
            </Select>
          </Field>
          <Field label="Stripe price">
            <PriceSelect
              value={draft.stripePriceId}
              prices={prices}
              error={pricesError}
              errorStatus={pricesStatus}
              // The product id rides along from the chosen price rather than being typed: it is
              // Stripe's own join and there is nothing for an operator to decide about it.
              //
              // `null` price ⇒ `null` product, NOT the one already in the draft. PriceSelect hands
              // back a null price on three paths — the degraded free-text input, the blank option,
              // and the "missing in Stripe" option — and on all three the price has CHANGED while
              // the product id in the draft still belongs to the price it replaced. Keeping it
              // would store a product that does not own this price: a join Stripe would disagree
              // with, written by us and never noticed, because the column is nullable and nothing
              // reads it back. The column is denormalized convenience; unknown is a value it can
              // hold, a wrong id is not.
              onChange={(priceId, price) =>
                form.onChange({
                  ...draft,
                  stripePriceId: priceId,
                  stripeProductId: price ? price.productId : null,
                })
              }
            />
          </Field>
          <Field
            label="Stripe product"
            hint="Filled from the chosen price; blank when the price was entered by hand."
          >
            <Input value={draft.stripeProductId ?? ""} readOnly />
          </Field>
          <Field label="Collection">
            <Select
              value={draft.collectionMethod}
              onChange={(e) => {
                const collectionMethod = e.target.value as OfferInput["collectionMethod"];
                form.onChange({
                  ...draft,
                  collectionMethod,
                  // The IFF in ck_billing_offers_days_until_due, kept true as the control moves:
                  // a default on the way in, null on the way out.
                  daysUntilDue: collectionMethod === "send_invoice" ? (draft.daysUntilDue ?? 30) : null,
                });
              }}
            >
              <option value="charge_automatically">Charge automatically</option>
              <option value="send_invoice">Send invoice</option>
            </Select>
          </Field>
          {draft.collectionMethod === "send_invoice" ? (
            <Field label="Days until due">
              <Input
                type="number"
                min={0}
                value={draft.daysUntilDue ?? ""}
                onChange={(e) => form.onChange({ ...draft, daysUntilDue: numOrNull(e.target.value) })}
              />
            </Field>
          ) : null}
          {draft.purpose === "access" ? (
            <Field label="Grants access to ecosystem" hint="The ecosystem a purchase unlocks.">
              <Input
                value={draft.grantsEcosystemId ?? ""}
                onChange={(e) => form.onChange({ ...draft, grantsEcosystemId: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="When it lapses">
            <Select
              value={draft.lapseAction}
              onChange={(e) =>
                form.onChange({ ...draft, lapseAction: e.target.value as OfferInput["lapseAction"] })
              }
            >
              <option value="none">Nothing</option>
              <option value="read_only">Read only</option>
              <option value="no_access">No access</option>
            </Select>
          </Field>
          <Field label="Grace period (days)">
            <Input
              type="number"
              min={0}
              value={draft.graceDays}
              onChange={(e) => form.onChange({ ...draft, graceDays: numOrNull(e.target.value) ?? 0 })}
            />
          </Field>
          <Field label="Active" hint="An inactive offer stays visible here and cannot be bought.">
            <Switch
              aria-label="Active"
              checked={draft.isActive}
              onCheckedChange={(next: boolean) => form.onChange({ ...draft, isActive: next })}
            />
          </Field>
        </FieldGroup>
      )}
    />
  );
}
