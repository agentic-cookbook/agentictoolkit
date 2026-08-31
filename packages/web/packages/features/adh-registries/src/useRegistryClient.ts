'use client';

import { useMemo } from 'react';
import { authedFetch } from '@agentic-toolkit/auth/client';
import { createRegistryClient, type RegistryClient } from '@agentic-toolkit/registry/client';

/**
 * The hub's registry client.
 *
 * Two things it does NOT do, both of which are easy to write by reflex and both wrong here:
 *
 * 1. It does not use a bare `fetch` with `credentials`. This fleet does not authenticate
 *    with cookies — the access token lives in localStorage and rides as an
 *    `Authorization: Bearer` header. `authedFetch` is what reads it, and it is also what
 *    refreshes once and retries on a 401, so a token that expired mid-session recovers
 *    instead of bouncing the registrant to sign-in mid-edit.
 * 2. It does not target a Route Handler. The hub's `/api/*` is a `next.config.ts` rewrite
 *    (`next.config.ts:40-44`), not a BFF that re-signs anything: the browser's own header
 *    is forwarded to the backend as-is.
 *
 * `authedFetch` throws `AuthHttpError` on a non-ok response; `createRegistryClient` allows
 * a fetcher to fail either by throwing or by returning a non-ok Response, so no adapter is
 * needed. `createRegistryClient`'s `Fetcher` declares `init` optional and `authedFetch` now
 * defaults it to `{}` too (`@agentic-toolkit/auth/client`), so it satisfies `Fetcher` directly
 * and can be passed straight through.
 */
export function useRegistryClient(): RegistryClient {
  return useMemo(() => createRegistryClient(authedFetch), []);
}
