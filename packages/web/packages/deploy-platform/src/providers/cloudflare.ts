import { withTimeout } from "../util/index.js";
import { pickCanonicalHost } from "./host-pick.js";
import { noteRateLimited } from "../cooldown/provider-cooldown.js";

/** Worker-script listing outcome: the scripts, or WHY it failed — `unreachable`
 *  separates no-response (network/timeout) from a definitive HTTP/API error
 *  (401/403/…), so the self-check can report an auth problem as an auth problem
 *  instead of debouncing it as a network blip. */
export type WorkerScriptsResult =
  | { scripts: string[] }
  | { error: string; unreachable: boolean };

/**
 * List EVERY Worker script in the account so all of them show up — not just a
 * hardcoded set. Failure comes back as an error result (e.g. the token lacks
 * Workers read), so a caller can fall back to the configured list.
 * (R2 buckets are NOT listed here — they're not deploys and need a separate
 * R2-scoped token; the storage Workers that front them DO appear.)
 * Exported for the live deploy-projects enumeration.
 */
export async function listWorkerScripts(accountId: string, token: string, signal: AbortSignal): Promise<WorkerScriptsResult> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) {
      if (res.status === 429) noteRateLimited("cloudflare", res.headers.get("retry-after"));
      return { error: `HTTP ${res.status}`, unreachable: false };
    }
    const body = (await res.json()) as { success?: boolean; result?: { id?: string }[] };
    if (!body.success) return { error: "API reported failure", unreachable: false };
    return { scripts: (body.result ?? []).map((s) => s.id).filter((id): id is string => typeof id === "string" && id.length > 0) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), unreachable: true };
  }
}

/**
 * The account's live Worker custom-domain routing — `hostname → service (worker)` —
 * from `/workers/domains`. This is the SAME mapping Cloudflare itself uses to route a
 * custom host to a Worker, so it's authoritative: it replaces any hand-maintained
 * host→worker guess and stays correct as domains are added/moved. Hostnames are
 * lowercased. Returns null on any failure (token lacks Workers read, network) so a
 * caller can fall back. The deploy-projects enumeration inverts this map (via
 * canonicalHostByWorker) to attach a monitorable domain to each Worker.
 */
export async function listWorkerCustomDomains(
  accountId: string,
  token: string,
  signal: AbortSignal,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; result?: { hostname?: string; service?: string }[] };
    if (!body.success) return null;
    const map: Record<string, string> = {};
    for (const d of body.result ?? []) {
      if (typeof d.hostname === "string" && d.hostname && typeof d.service === "string" && d.service) {
        map[d.hostname.toLowerCase()] = d.service;
      }
    }
    return map;
  } catch (err) {
    console.error(`Cloudflare workers/domains listing failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Invert a host→worker map (from listWorkerCustomDomains) into worker→canonical
 * host — the form the deploy-projects enumeration needs to attach ONE monitorable
 * domain per worker. A worker can front several hostnames (apex + `www.`, or two
 * brand domains), so the host is chosen deterministically via pickCanonicalHost.
 * Workers with no custom domain simply don't appear.
 */
export function canonicalHostByWorker(hostToService: Record<string, string>): Record<string, string> {
  const hostsByWorker: Record<string, string[]> = {};
  for (const [host, worker] of Object.entries(hostToService)) {
    (hostsByWorker[worker] ??= []).push(host);
  }
  const out: Record<string, string> = {};
  for (const [worker, hosts] of Object.entries(hostsByWorker)) {
    const host = pickCanonicalHost(hosts);
    if (host) out[worker] = host;
  }
  return out;
}

/**
 * The account ids this token can see (`GET /accounts`). Returns null on any failure so
 * resolveCfAccountId can degrade. Not exported — only resolveCfAccountId consumes it.
 */
async function listAccounts(token: string, signal: AbortSignal): Promise<string[] | null> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; result?: { id?: string }[] };
    if (!body.success) return null;
    return (body.result ?? []).map((a) => a.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (err) {
    console.error(`Cloudflare /accounts discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Resolve the Cloudflare account id for Workers reads. The account id is the silent
 * single point of failure for CF auto-wiring: BOTH the worker enumeration
 * (listWorkerScripts) and the live host→worker map (listWorkerCustomDomains) need it,
 * so when it is absent CF endpoints never wire even though the token alone is enough to
 * find the account. Resolution order, cheapest first:
 *   1. the configured id (DB integration config), if set;
 *   2. process.env.CLOUDFLARE_ACCOUNT_ID, the deploy-time fallback (the DB config is
 *      seeded from it, but only at integration-create time — this catches the case
 *      where it was set AFTER seeding);
 *   3. the token's own `/accounts` — used ONLY when the token sees exactly one account
 *      (unambiguous). With zero or several we don't guess.
 * Returns null when it can't be resolved, so callers degrade to their static map /
 * empty list rather than throwing.
 */
// Discovered (single) account id per token. The account a token is scoped to never
// changes, so a successful /accounts discovery is cached process-wide — this keeps the
// per-request (auto-wire) and per-cycle (poller) callers from re-probing /accounts every
// time. Only SUCCESSES are cached; a null (transient failure / 0-or-many accounts) is
// re-probed so a blip doesn't permanently disable discovery.
const discoveredAccountByToken = new Map<string, string>();

/** Test-only: clear the discovery memo so cached accounts don't bleed across tests. */
export function _resetCfAccountCache(): void {
  discoveredAccountByToken.clear();
}

export async function resolveCfAccountId(
  configuredId: string | undefined,
  token: string,
  signal: AbortSignal,
): Promise<string | null> {
  const configured = configuredId?.trim();
  if (configured) return configured;
  const fromEnv = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (fromEnv) return fromEnv;
  const cached = discoveredAccountByToken.get(token);
  if (cached) return cached;
  const accounts = await listAccounts(token, signal);
  const resolved = accounts && accounts.length === 1 ? accounts[0]! : null;
  if (resolved) discoveredAccountByToken.set(token, resolved);
  return resolved;
}

/** A provider connection's CF token + (optional) configured account id. */
export interface CfConn {
  token?: string;
  accountId?: string;
}

/**
 * Resolve a connection's CF account id (configured → env → token discovery), each step
 * time-boxed by its own 6s window. Returns null when there's no token or the account
 * can't be resolved. The single place callers reach for "what account does this token
 * use?" so the self-check, poller, and auto-wire all agree.
 */
export async function resolveCfAccountForConn(conn: CfConn): Promise<string | null> {
  if (!conn.token) return null;
  const timer = withTimeout(6_000);
  try {
    return await resolveCfAccountId(conn.accountId, conn.token, timer.signal);
  } finally {
    timer.done();
  }
}

/**
 * Resolve the account, then run `onAccount` with it under its OWN fresh 6s window — so a
 * slow /accounts probe can't eat the downstream call's budget. Returns null when the
 * account can't be resolved (caller falls back). The one home for the
 * "resolve-account-then-call-a-CF-list-endpoint" pattern.
 */
export async function withResolvedCfAccount<T>(
  conn: CfConn,
  onAccount: (accountId: string, token: string, signal: AbortSignal) => Promise<T | null>,
): Promise<T | null> {
  const accountId = await resolveCfAccountForConn(conn);
  if (!accountId || !conn.token) return null;
  const timer = withTimeout(6_000);
  try {
    return await onAccount(accountId, conn.token, timer.signal);
  } finally {
    timer.done();
  }
}
