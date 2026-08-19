"use client";

import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { Users } from "lucide-react";
import { useResourceList } from "@agentic-toolkit/data";
import { useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field, FieldGroup, TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import {
  listAccounts,
  listOffers,
  resendClaim,
  type AccountRow,
  type OfferRow,
} from "./api/billing";

/** A stamped value, or the placeholder for one that never fired — never blank, which would read
 *  as a loading state that has already settled. */
function stamp(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/**
 * Payers — who has bought what, read-only, over generic CRUD's `billing.accounts`.
 *
 * Deliberately NOT an editable master/detail: `billing.accounts` is webhook-owned (every row is
 * written by the Stripe event handler, never by an operator), and an editable `status` field here
 * would be a paywall bypass the gate believes actually happened. The one action this pane offers —
 * resending a claim link — is the one write the accounts route itself exposes.
 *
 * Builds its own rail level with `useStackLevel` rather than `useMasterDetailLevel`: that hook
 * always wires a level's `onNew` to `useMasterDetailForm`'s `create` action, which is a defined
 * function (and so renders a "+") whether or not the caller's form config supplies a `create` —
 * there is no create here at all, and a "+" that silently does nothing on click is worse than no
 * "+" (see `useMasterDetailLevel.tsx`'s `onNew: onNew ?? form.actions.onCreate`, and
 * `topic-detail.tsx`'s `const newButton = onNew ? … : null`, which is the only place the button is
 * actually suppressed). Reads/selection use the same primitives those hooks are built on
 * (`useResourceList`, `useDualModeSelection`), so this pane still behaves like every other member's
 * list — deep-linkable via `leaf`, URL-driven when hosted, internal-state when not.
 *
 * Every read here follows one rule: a read that FAILED is never rendered as a fact about the
 * world. `/accounts` is behind `requireBillingOperator`, so for most members of a selling
 * ecosystem a 403 is the ORDINARY response, not an incident — and the natural-looking "no rows, so
 * show the empty state" collapses that into a confident falsehood ("nobody has bought anything")
 * the reader has no way to disprove from where they are standing. Hence `loadError` is keyed on
 * the STATUS, exactly as `OffersPane`'s is, and rendered unconditionally above the detail — visible
 * whether or not a row happens to be selected.
 */
export function PayersPane({
  ecosystemId,
  leaf,
}: {
  ecosystemId?: string;
  leaf?: TopicLeaf;
}): ReactElement {
  const key = `billing:${ecosystemId ?? ""}`;

  const loadAccounts = useCallback(() => listAccounts(), []);
  // reportErrors: false — this read is owners-only, so a non-owner's 403 and a flag-off 404 are
  // the ORDINARY state for most of an ecosystem's members, not an auth incident. Reporting them
  // would file one bug per member per view. See OffersPane's identical rationale for `/offers`.
  const {
    items: accounts,
    error: accountsError,
    errorStatus: accountsStatus,
    isFetching,
  } = useResourceList<AccountRow>(`${key}:accounts`, loadAccounts, { reportErrors: false });

  // For the offer-name join only. Same reportErrors: false as OffersPane's own `/offers` read —
  // a flag-off or non-owner caller sees this fail just as often as `/accounts` does.
  const loadOffers = useCallback(() => listOffers(), []);
  const { items: offers } = useResourceList<OfferRow>(`${key}:offers`, loadOffers, {
    reportErrors: false,
  });
  const offerById = new Map((offers ?? []).map((o) => [o.id, o]));

  const { selectedId, select } = useDualModeSelection(
    leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined,
  );
  const selected = selectedId ? ((accounts ?? []).find((a) => a.id === selectedId) ?? null) : null;

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onResend(account: AccountRow) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await resendClaim(account.id);
      // The new expiry is the whole content of the success: a claim link that has been re-issued
      // and whose clock the operator cannot see is a link they will re-issue again in ten minutes.
      setNotice(`A fresh claim link was sent. It expires ${new Date(r.expiresAt).toLocaleString()}.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not re-issue the claim link.");
    } finally {
      setBusy(false);
    }
  }

  const loadError =
    accountsStatus === 404
      ? "Billing is not enabled for this ecosystem. Turn it on under Setup."
      : accountsStatus === 403
        ? "Payer details are visible to this ecosystem's owners only."
        : accountsError
          ? "Payer details could not be loaded."
          : null;

  useStackLevel({
    id: "billing-payers",
    title: "Payers",
    items: (accounts ?? []).map((a) => ({
      id: a.id,
      label: a.payerEmail ?? "unknown",
      sublabel: a.claimedCustomerId ? a.status : `${a.status} · unclaimed`,
      icon: <Users size={16} aria-hidden />,
    })),
    selectedId,
    onSelect: (id) => select(id),
    onClear: () => select(null),
    emptyLabel: loadError ?? (accounts === null ? "Loading…" : "Nobody has bought anything yet."),
    busy: isFetching,
    itemNoun: "payer",
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={loadError} className="px-6 pt-4" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {selected ? (
          <FieldGroup title="Payer">
            <Field label="Offer">
              <span className="text-sm">{offerById.get(selected.offerId)?.name ?? selected.offerId}</span>
            </Field>
            <Field label="Stripe customer">
              <span className="text-sm">{selected.stripeCustomerId ?? "—"}</span>
            </Field>
            <Field label="Stripe checkout session">
              <span className="text-sm">{selected.stripeCheckoutSessionId ?? "—"}</span>
            </Field>
            <Field label="Stripe subscription">
              <span className="text-sm">{selected.stripeSubscriptionId ?? "—"}</span>
            </Field>
            <Field label="Current period end">
              <span className="text-sm">{stamp(selected.currentPeriodEnd)}</span>
            </Field>
            <Field label="Lapsed at">
              <span className="text-sm">{stamp(selected.lapsedAt)}</span>
            </Field>
            <Field label="Claimed at">
              <span className="text-sm">{stamp(selected.claimedAt)}</span>
            </Field>
            <Field label="Created at">
              <span className="text-sm">{stamp(selected.createdAt)}</span>
            </Field>
            <Field
              label="Claim link"
              hint={
                selected.claimedCustomerId
                  ? "Already claimed. Binding is irreversible, so a fresh link cannot be issued."
                  : undefined
              }
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || Boolean(selected.claimedCustomerId)}
                onClick={() => void onResend(selected)}
              >
                Resend claim link
              </Button>
              {notice ? <p className="mt-1 text-xs text-apt-text-muted">{notice}</p> : null}
            </Field>
          </FieldGroup>
        ) : (
          <TopicSelectHint title="Select a payer." />
        )}
      </div>
    </div>
  );
}
