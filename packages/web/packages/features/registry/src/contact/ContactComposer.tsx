'use client';

import { useState } from 'react';
import type { Fetcher } from '../client';
import { noAutofillProps } from '../autofill';

export interface ContactComposerProps {
  registrySlug: string;
  entrySlug: string;
  displayName: string;
  /** Where a signed-out visitor goes. The host builds it with its own return path. */
  signInHref: string;
  /**
   * The authed `fetch` the host supplies — in practice `authedFetch` from
   * `@agentic-toolkit/auth/client`, the same seam `createRegistryClient` takes.
   *
   * Required, not defaulted to `fetch`, on purpose. This fleet authenticates with an
   * `Authorization: Bearer` header read from localStorage, NOT with cookies, so a bare
   * `fetch` would send an unauthenticated request from a signed-in visitor and this
   * composer would offer sign-in to someone already signed in. A default that is wrong
   * everywhere is worse than a prop every host must pass.
   */
  fetcher: Fetcher;
}

type State =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'signin' }
  | { kind: 'error'; message: string };

/** `{ status, message }` for either failure shape a Fetcher may produce. */
interface Failure {
  status: number;
  message: string;
}

/** A thrown AuthHttpError, structurally — the package does not depend on @agentic-toolkit/auth. */
function thrownFailure(e: unknown): Failure | null {
  if (e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number') {
    const err = e as { status: number; message?: unknown };
    return { status: err.status, message: typeof err.message === 'string' ? err.message : '' };
  }
  return null;
}

async function responseFailure(res: Response): Promise<Failure> {
  // Same envelope the API client unwraps: `{ error: { message } }` (app.ts:403).
  const text = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (typeof parsed?.error?.message === 'string') {
      return { status: res.status, message: parsed.error.message };
    }
  } catch {
    // Not JSON — the raw text is the best message there is.
  }
  return { status: res.status, message: text || `${res.status} ${res.statusText}` };
}

/**
 * Opens a hub DM with an entry's owner and sends the opening message.
 *
 * It sends the whole message rather than linking to the hub's DM workspace, because that
 * workspace is parked behind a "Coming soon" placeholder (PR#83) — a link would land the
 * visitor on nothing. The chat API underneath is live, and the recipient is notified.
 *
 * The request goes to the site's own `/api/*` path, which every site rewrites to the backend
 * in its `next.config.ts`. `/api` is the frontend's prefix; the backend mount is
 * `/registry/contact` with no prefix at all.
 */
export function ContactComposer({
  registrySlug, entrySlug, displayName, signInHref, fetcher,
}: ContactComposerProps) {
  const [state, setState] = useState<State>({ kind: 'closed' });
  const [body, setBody] = useState('');

  if (state.kind === 'closed') {
    return (
      <button type="button" onClick={() => setState({ kind: 'open' })}>
        Message {displayName}
      </button>
    );
  }

  if (state.kind === 'sent') {
    return <p role="status">Message sent. {displayName} will see it in their hub inbox.</p>;
  }

  if (state.kind === 'signin') {
    return (
      <p>
        <a href={signInHref}>Sign in</a> to send this message.
      </p>
    );
  }

  const fail = ({ status, message }: Failure) => {
    // 401 is a step in the flow, not a failure: an anonymous visitor is the common case
    // on these sites, and a red error would read as "this is broken".
    if (status === 401) return setState({ kind: 'signin' });
    return setState({ kind: 'error', message });
  };

  const send = async () => {
    setState({ kind: 'sending' });
    try {
      const res = await fetcher(`/api/registry/contact/${registrySlug}/${entrySlug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      // A Fetcher may fail EITHER way — see its docblock in client.ts. A bare `fetch`
      // returns the non-ok Response; `authedFetch` throws after its refresh-and-retry.
      if (!res.ok) return fail(await responseFailure(res));
      setState({ kind: 'sent' });
    } catch (e) {
      const failure = thrownFailure(e);
      if (failure) return fail(failure);
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="rc">
      <label>
        Message {displayName}
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} {...noAutofillProps} />
      </label>
      {state.kind === 'error' ? <p role="alert">{state.message}</p> : null}
      <button type="button" disabled={state.kind === 'sending' || body.trim() === ''} onClick={() => void send()}>
        Send
      </button>
    </div>
  );
}
