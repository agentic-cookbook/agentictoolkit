"use client";

import { useCallback } from "react";
import { useResourceList } from "@agentic-toolkit/data";
import { getBillingContext, type BillingContext } from "./api/billing";

/** This module's own react-query key prefix for `GET /billing/context`, interpolated below into
 *  the per-workspace cache key. A named constant rather than an inline literal so the prefix
 *  reads as what it is at the call site instead of as an unexplained string; nothing outside
 *  this file imports it — each of the three hosts gets its resolution via `useBillingContext`,
 *  not by reading the cache key directly. */
const BILLING_CONTEXT_CACHE_KEY = "billing:context";

/**
 * How far the caller got resolving billing's scope — the injected resolution `BillingGroup`
 * gates on.
 *
 * Injected into the group rather than resolved inside it, the same rule `StorageGroup`'s
 * `EcosystemScopeResolution` follows and for the same reason: three hosts fetch it from three
 * places while the GATE — what each outcome shows — must be one decision, not three.
 *
 * The booleans default FALSE while the read is in flight, and that is deliberate: a control
 * rendered on an assumed `true` and then withdrawn is worse than one that appears a beat late.
 * `ecosystemId` undefined is the same "still loading" state, and every pane accepts it.
 */
export interface BillingContextResolution {
  ecosystemId?: string;
  billingEnabled: boolean;
  canManage: boolean;
  stripeConnected: boolean;
  webhookPath?: string;
  isError: boolean;
  /** Re-read the context after a write elsewhere invalidates it. Optional: an embedded host that
   *  cannot re-read its resolution may omit it. */
  reload?: () => void | Promise<void>;
}

/**
 * Read `GET /billing/context` once per session and share it.
 *
 * `useResourceList` rather than a bespoke fetch, because that is the hook whose cache
 * `revalidateResources` can reach — and every write in this feature (the flag switch, connecting
 * Stripe) has to re-derive the other members' gates from ONE place rather than from local
 * optimistic state. A list of one, which is the small cost of that.
 *
 * `reportErrors` is left at its default: unlike `/prices` and `/accounts`, this route is behind
 * `jwtAuth` alone, so it has no ordinary 4xx. A failure here IS an incident and should be filed.
 *
 * `workspaceSlug` partitions the cache key. It is NOT a tenant boundary — the route carries no
 * workspace and scopes by the bearer token — but keying by it is what keeps that honest on the
 * day one of these reads does become workspace-scoped.
 */
export function useBillingContext(
  workspaceSlug?: string,
): BillingContextResolution & { reload: () => Promise<void> } {
  const load = useCallback(async () => [await getBillingContext()], []);
  const { items, error, reload } = useResourceList<BillingContext>(
    `${BILLING_CONTEXT_CACHE_KEY}:${workspaceSlug ?? ""}`,
    load,
  );
  const ctx = items?.[0];
  return {
    ecosystemId: ctx?.ecosystemId,
    billingEnabled: ctx?.billingEnabled ?? false,
    canManage: ctx?.canManage ?? false,
    stripeConnected: ctx?.stripeConnected ?? false,
    webhookPath: ctx?.webhookPath,
    isError: error !== null,
    reload,
  };
}
