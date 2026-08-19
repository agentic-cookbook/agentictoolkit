"use client";

import { useId, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { CopyButton } from "@agentic-toolkit/ui/components/copy-button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { FieldFootnote } from "@agentic-toolkit/ui/blocks/field";
import { fieldCaptionClass } from "@agentic-toolkit/ui/lib/typography";
import { setEcosystemFlag } from "./api/feature-flags";
import type { BillingContextResolution } from "./useBillingContext";

/** The description stamped on the flag row the first time it is created. */
const FLAG_DESCRIPTION = "Sell offers through Stripe and track who is paying.";

/**
 * The event types the receiver ACTS on, and no others.
 *
 * Derived from `projectEvent` (backend/src/adh/src/billing/status.ts), which is the only place an
 * event moves an account: three whole families plus ONE member of a fourth. `charge.refunded` is
 * that member — a full refund revokes access (`case 'charge.refunded'`, status.ts) — and it is
 * listed by name rather than as `charge.*` because no other charge event moves anything, so
 * subscribing to the family would fill the ledger with rows that terminate unapplied.
 *
 * Anything outside this list yields facts every caller reads as "nothing to apply". Subscribing to
 * more in the Stripe dashboard is not harmless-but-noisy — it fills the ledger with rows that will
 * never process and can never be made to, which is indistinguishable at a glance from the failure
 * the Events member exists to surface. `SetupPane.test.tsx` pins this list against that handler,
 * because the two files are the operator's instruction and the code it describes: they drift
 * silently, and the cost of the drift is an entitlement that never changes.
 */
const EVENT_FAMILIES = [
  "checkout.session.*",
  "customer.subscription.*",
  "invoice.*",
  "charge.refunded",
] as const;

/**
 * The Stripe status row's copy, keyed by `BillingContext.stripeStatus`.
 *
 * Records rather than nested ternaries so the set is TOTAL over the union: a fourth state added to
 * the API type makes these fail to compile instead of falling silently into an `else` branch
 * written for a different state.
 *
 * `unknown` is what earns the shape. See the API type's docstring: that value means the connection
 * read THREW, which in this fleet means a missing or rotated `SECRETS_ENCRYPTION_KEY`. Rendering
 * it as "Not connected" with a "Connect Stripe" button sends the operator to re-paste a key that
 * was never the problem — and the row does not change when they do. So it says what happened, and
 * its button is a neutral way in rather than an instruction to do the wrong thing.
 */
const STATUS_TEXT: Record<BillingContextResolution["stripeStatus"], string> = {
  connected: "Connected",
  not_connected: "Not connected",
  unknown: "Could not be checked",
};

const STATUS_ACTION: Record<BillingContextResolution["stripeStatus"], string> = {
  connected: "Manage",
  not_connected: "Connect Stripe",
  unknown: "Open Stripe settings",
};

const KEYS_HINT =
  "Keys are entered on the Stripe topic, which is the same integration record the Integrations site configures.";

const STATUS_HINT: Record<BillingContextResolution["stripeStatus"], string> = {
  connected: KEYS_HINT,
  not_connected: KEYS_HINT,
  unknown:
    "The stored key could not be READ, which is not a claim that none is configured — usually the server's encryption key is missing or was rotated. Check the server before re-entering credentials.",
};

/**
 * Setup — the `billing` kill switch, the Stripe connection's state, and the webhook endpoint.
 *
 * It REPORTS the Stripe connection and does not edit it: editing lives on the Stripe member,
 * which is `IntegrationsPane` itself. Two edit surfaces for one credential is exactly what this
 * design exists to avoid, and a "just a small key field here too" is how that starts.
 */
export function SetupPane({
  context,
  onChanged,
  onOpenStripe,
}: {
  context: BillingContextResolution;
  /** Re-read `GET /billing/context`. Every other member's gate is derived from it, so a write
   *  here re-derives all of them from one place rather than from local optimistic state. */
  onChanged: () => void | Promise<void>;
  /** Select the `stripe` member. A callback rather than a link because the group owns the URL —
   *  the same component is mounted with internal selection on two of its three hosts. Optional
   *  so that "no way to get there" is a state the type can express: omitted hides the button
   *  instead of rendering one that cannot work. */
  onOpenStripe?: () => void;
}): ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ecosystemId, billingEnabled, canManage, stripeStatus, webhookPath } = context;

  async function toggle(next: boolean) {
    if (!ecosystemId) return;
    setSaving(true);
    setError(null);
    try {
      await setEcosystemFlag(ecosystemId, "billing", next, FLAG_DESCRIPTION);
    } catch (e) {
      // Named, not swallowed. The switch is driven by `context`, which has NOT changed, so it
      // springs back on its own — but a control that silently returns to where it was reads as a
      // UI bug rather than as a refusal, and the operator retries it forever.
      setError(e instanceof Error ? e.message : "Could not change this setting.");
      setSaving(false);
      return;
    }
    // The refresh is a SECOND step with its own sentence, because by here the flag is already
    // written. Sharing the catch above reported a successful change as "Could not change this
    // setting." and left the switch showing its old value — a lie in both halves. This is the
    // one state where the truth is split: the write landed, the read did not.
    try {
      await onChanged();
    } catch {
      setError("The setting was saved, but this page could not be refreshed. Reload to see it.");
    }
    setSaving(false);
  }

  // Origin-relative from the server, absolute here: the operator pastes this into Stripe, and a
  // path alone is not something Stripe can call. Guarded because this renders on the server too
  // in a host that prerenders; an empty origin degrades to the path, which is still copyable.
  // `useId` rather than a literal: this pane is a package component, and a literal id would be
  // the same string in every mount. Two mounts on one page — which nothing here forbids — would
  // give the document duplicate ids, and `aria-labelledby` resolves to the FIRST match, so one
  // switch would silently borrow the other's caption.
  const enabledCaptionId = useId();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const webhookUrl = webhookPath ? `${origin}${webhookPath}` : "";

  return (
    <div className="flex flex-col gap-6 p-4">
      <FieldGroup title="Billing enabled">
        {/* Not a Field: Field wraps its children — and FieldFootnote's hint — in a <Label>, and a
            <label> forwards a click on inert content to its first labelable descendant. The
            control here is a Switch (Base UI renders a labelable <button role="switch">) and the
            hint runs to ~200 characters, so drag-selecting it to read or copy would toggle
            billing off for the whole ecosystem. Built by hand for the same reason as PayersPane's
            Resend row and this file's Status/Endpoint rows below.

            The caption also doubles as the Switch's accessible name via aria-labelledby, rather
            than the separate aria-label Field would otherwise need: a visible label and a
            different accessible name is a WCAG 2.5.3 failure, and it breaks voice control — an
            operator saying "click Sell through this ecosystem" would hit nothing. */}
        <div className="flex flex-col items-start gap-1.5">
          <span id={enabledCaptionId} className={fieldCaptionClass}>
            Sell through this ecosystem
          </span>
          <div className="flex items-center gap-3">
            <Switch
              aria-labelledby={enabledCaptionId}
              checked={billingEnabled}
              disabled={!canManage || !ecosystemId || saving}
              onCheckedChange={(next: boolean) => void toggle(next)}
            />
            <span className="text-sm text-apt-text-muted">{billingEnabled ? "On" : "Off"}</span>
          </div>
          <FieldFootnote
            hint={
              billingEnabled
                ? "Offers can be created, and payers, prices and webhook events are readable."
                : "With this off, offers cannot be created and the price, payer and event views all report that billing is not enabled. It is a real kill switch: it is not exempted for platform admins."
            }
          />
        </div>
        <ErrorText error={error} />
      </FieldGroup>

      <FieldGroup title="Stripe connection">
        {/* Not a Field: Field wraps its children in a <Label>, which forwards a click on its
            inert content — the "Status" caption, or the status text — to its first labelable
            descendant, here the Connect/Manage button. Same defect as PayersPane's Resend row;
            built by hand for the same reason. */}
        <div className="flex flex-col items-start gap-1.5">
          <span className={fieldCaptionClass}>Status</span>
          <div className="flex items-center gap-3">
            <span className="text-sm">{STATUS_TEXT[stripeStatus]}</span>
            {/* No handler ⇒ no button, rather than a button that renders enabled and does
                nothing. That inert button is the exact defect this row was just fixed for, and
                leaving the prop required would only have moved it one level up. The hint below
                still names where keys are entered, so the row does not become a dead end. */}
            {onOpenStripe ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenStripe}>
                {STATUS_ACTION[stripeStatus]}
              </Button>
            ) : null}
          </div>
          <FieldFootnote hint={STATUS_HINT[stripeStatus]} />
        </div>
      </FieldGroup>

      <FieldGroup title="Webhook endpoint">
        {/* Not a Field, for the same reason as "Status" above: CopyButton is a labelable
            <button>, and a click on the caption or a drag-select over the endpoint code would
            otherwise fire the copy. */}
        <div className="flex flex-col items-start gap-1.5">
          <span className={fieldCaptionClass}>Endpoint URL</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-apt-input px-2 py-1 text-xs break-all">
              {webhookUrl || webhookPath || "…"}
            </code>
            <CopyButton getText={() => webhookUrl} label="Copy webhook URL" />
          </div>
          <FieldFootnote hint="Paste this into the Stripe dashboard. adh does not register it for you." />
        </div>
        <Field
          label="Events to subscribe to"
          hint="Anything outside this list is stored and never applied."
        >
          <ul className="flex flex-col gap-1 text-sm text-apt-text-muted">
            {EVENT_FAMILIES.map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </Field>
      </FieldGroup>
    </div>
  );
}
