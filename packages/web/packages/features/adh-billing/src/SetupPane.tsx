"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { CopyButton } from "@agentic-toolkit/ui/components/copy-button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { setEcosystemFlag } from "./api/feature-flags";
import type { BillingContextResolution } from "./useBillingContext";

/** The description stamped on the flag row the first time it is created. */
const FLAG_DESCRIPTION = "Sell offers through Stripe and track who is paying.";

/**
 * The three event families the receiver understands, and no others.
 *
 * `extractFacts` (backend/src/adh/src/billing/eventFacts.ts) recognises exactly these; anything
 * else yields all-null facts that every caller reads as "nothing to apply". Subscribing to more in
 * the Stripe dashboard is not harmless-but-noisy — it fills the ledger with rows that will never
 * process and can never be made to, which is indistinguishable at a glance from the failure the
 * Events member exists to surface.
 */
const EVENT_FAMILIES = ["checkout.session.*", "customer.subscription.*", "invoice.*"] as const;

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
   *  the same component is mounted with internal selection on two of its three hosts. */
  onOpenStripe: () => void;
}): ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ecosystemId, billingEnabled, canManage, stripeConnected, webhookPath } = context;

  async function toggle(next: boolean) {
    if (!ecosystemId) return;
    setSaving(true);
    setError(null);
    try {
      await setEcosystemFlag(ecosystemId, "billing", next, FLAG_DESCRIPTION);
      await onChanged();
    } catch (e) {
      // Named, not swallowed. The switch is driven by `context`, which has NOT changed, so it
      // springs back on its own — but a control that silently returns to where it was reads as a
      // UI bug rather than as a refusal, and the operator retries it forever.
      setError(e instanceof Error ? e.message : "Could not change this setting.");
    } finally {
      setSaving(false);
    }
  }

  // Origin-relative from the server, absolute here: the operator pastes this into Stripe, and a
  // path alone is not something Stripe can call. Guarded because this renders on the server too
  // in a host that prerenders; an empty origin degrades to the path, which is still copyable.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const webhookUrl = webhookPath ? `${origin}${webhookPath}` : "";

  return (
    <div className="flex flex-col gap-6 p-4">
      <FieldGroup title="Billing enabled">
        <Field
          label="Sell through this ecosystem"
          hint={
            billingEnabled
              ? "Offers can be created, and payers, prices and webhook events are readable."
              : "With this off, offers cannot be created and the price, payer and event views all report that billing is not enabled. It is a real kill switch: it is not exempted for platform admins."
          }
        >
          <div className="flex items-center gap-3">
            <Switch
              aria-label="Billing enabled"
              checked={billingEnabled}
              disabled={!canManage || !ecosystemId || saving}
              onCheckedChange={(next: boolean) => void toggle(next)}
            />
            <span className="text-sm text-apt-text-muted">{billingEnabled ? "On" : "Off"}</span>
          </div>
        </Field>
        <ErrorText error={error} />
      </FieldGroup>

      <FieldGroup title="Stripe connection">
        <Field
          label="Status"
          hint="Keys are entered on the Stripe topic, which is the same integration record the Integrations site configures."
        >
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {stripeConnected ? "Connected" : "Not connected"}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onOpenStripe}>
              {stripeConnected ? "Manage" : "Connect Stripe"}
            </Button>
          </div>
        </Field>
      </FieldGroup>

      <FieldGroup title="Webhook endpoint">
        <Field
          label="Endpoint URL"
          hint="Paste this into the Stripe dashboard. adh does not register it for you."
        >
          <div className="flex items-center gap-2">
            <code className="rounded bg-apt-input px-2 py-1 text-xs break-all">
              {webhookUrl || webhookPath || "…"}
            </code>
            <CopyButton getText={() => webhookUrl} label="Copy webhook URL" />
          </div>
        </Field>
        <Field label="Events to subscribe to" hint="Anything outside these three is stored and never applied.">
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
