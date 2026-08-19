"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Users } from "lucide-react";
import { useResourceList } from "@agentic-toolkit/data";
import { useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field, FieldGroup, TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { FieldFootnote } from "@agentic-toolkit/ui/blocks/field";
import { fieldCaptionClass } from "@agentic-toolkit/ui/lib/typography";
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
  /**
   * The outcome of the last Resend, carrying WHICH outcome it was rather than only its words.
   *
   * A discriminant, not a string the renderer sniffs: the two branches are set from two different
   * code paths, and re-deriving "did this fail?" from message text would be a second, weaker
   * answer to a question the code already knows — and one that breaks the day a success message
   * happens to contain the word the sniff looks for.
   */
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // The detail is re-rendered, not remounted, when the operator picks a different payer in the
  // rail (there is no keyed subtree here), so a notice left over from A's Resend click would
  // otherwise still be showing under B's Resend button and read as B having just been emailed.
  useEffect(() => setNotice(null), [selectedId]);

  // Tracks the payer currently on screen so onResend can tell, once its request resolves,
  // whether the operator is still looking at the payer it was sent for.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  async function onResend(account: AccountRow) {
    // Race: onResend fires for `account`, the operator selects a different payer before the
    // request settles, and the promise resolves after — without this guard the result would
    // paint under the newly selected payer and read as confirmation about the wrong person.
    const requestedFor = account.id;
    setBusy(true);
    setNotice(null);
    try {
      const r = await resendClaim(account.id);
      if (selectedIdRef.current !== requestedFor) return;
      // The new expiry is the whole content of the success: a claim link that has been re-issued
      // and whose clock the operator cannot see is a link they will re-issue again in ten minutes.
      setNotice({
        ok: true,
        text: `A fresh claim link was sent. It expires ${new Date(r.expiresAt).toLocaleString()}.`,
      });
    } catch (e) {
      if (selectedIdRef.current !== requestedFor) return;
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message : "Could not re-issue the claim link.",
      });
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
            {/* Not a Field: Field wraps its children in a <Label>, and a <label> forwards a click
                on its inert content — the caption text, or the notice paragraph a reader might
                drag-select to copy the expiry — to its first labelable descendant, which here is
                the Resend button. That would mail a real customer a second claim link, so this
                row is built by hand instead of composing Field. */}
            <div className="flex flex-col items-start gap-1.5">
              <span className={fieldCaptionClass}>Claim link</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || Boolean(selected.claimedCustomerId)}
                onClick={() => void onResend(selected)}
              >
                Resend claim link
              </Button>
              {/* A failure is NOT the same surface as a success. Both used to render as the same
                  neutral grey paragraph, differing only in wording — so a 500 read as "text
                  appeared, so it sent", and the operator told a real customer to check an inbox
                  for a link that was never issued. The failure gets the platform's one inline
                  error line, which is red and carries role="alert" so it is also announced. */}
              {notice === null ? null : notice.ok ? (
                <p className="mt-1 text-xs text-apt-text-muted">{notice.text}</p>
              ) : (
                <ErrorText error={notice.text} className="mt-1 text-xs" />
              )}
              <FieldFootnote
                hint={
                  selected.claimedCustomerId
                    ? "Already claimed. Binding is irreversible, so a fresh link cannot be issued."
                    : undefined
                }
              />
            </div>
          </FieldGroup>
        ) : (
          <TopicSelectHint title="Select a payer." />
        )}
      </div>
    </div>
  );
}
