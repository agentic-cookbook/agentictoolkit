'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { reportAuthError } from './report'
import { useAuth } from './context'
import { linkProvider, AuthHttpError } from './client'
import { beginLinkProvider, LINK_NONCE_KEY, PENDING_LINK_KEY } from './sso'
import {
  linkConfirmAction,
  linkConfirmBody,
  linkConfirmTitle,
  linkInProgressTitle,
  linkInProgressBody,
  linkSuccessTitle,
  linkSuccessBody,
  linkAlreadyLinkedBody,
  linkFailedTitle,
  linkStartFailedBody,
} from './labels'

type Status =
  | { kind: 'idle' }
  | { kind: 'confirm'; provider: string }
  | { kind: 'linking'; provider: string }
  | { kind: 'success'; provider: string; already: boolean }
  | { kind: 'error'; message: string }

export interface ProviderLinkHandlerProps {
  /** OAuth client id used when linking (default 'adh'). */
  clientId?: string
}

/** Read the pending "link this provider after login" intent, if any. */
function readPendingLink(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_LINK_KEY)
  } catch {
    return null
  }
}

function clearPendingLink(): void {
  try {
    window.sessionStorage.removeItem(PENDING_LINK_KEY)
  } catch {
    /* storage blocked */
  }
}

/** Drop-in, mount once in the authenticated shell. Owns BOTH legs of a reactive
 *  account-link, because both are things that happen to an already-signed-in visitor
 *  and neither is a login:
 *
 *  - FORWARD: an OAuth callback that hit `account_exists` stashed a provider to
 *    connect. Once the visitor is authenticated — however they signed in — this
 *    confirms with them and starts the link round-trip (`beginLinkProvider`).
 *  - RETURN: the AS bounces back a `#link_code`, which this POSTs to
 *    /auth/link-provider (CSRF-guarded by the round-tripped nonce) and reports.
 *
 *  The forward leg used to live in LoginCard, keyed off that card's own successful
 *  password login. That made it unreachable for every OTHER way of arriving signed
 *  in — a provider login, a central login relayed from another site, an existing
 *  session restored on cold load — and it is now unreachable there by construction,
 *  since a credential login navigates away to the callback rather than returning to
 *  the card. Here it fires for all of them, and the confirm still gates the link on
 *  the visitor explicitly continuing. */
export function ProviderLinkHandler({ clientId = 'adh' }: ProviderLinkHandlerProps): ReactElement | null {
  const { isAuthenticated } = useAuth()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const startedRef = useRef(false)

  useEffect(() => {
    // The once-guard is set only when we COMMIT to completing a verified link
    // below, not on a no-op or a refused forged code — so a refusal can't strand a
    // legitimate pending intent, and a transient auth flip can still be retried.
    if (startedRef.current || !isAuthenticated) return

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const frag = new URLSearchParams(hash)
    const code = frag.get('link_code')
    const provider = frag.get('link_provider')
    const redirectUri = frag.get('redirect_uri')

    if (!code || !provider || !redirectUri) {
      // No inbound link code: this is the FORWARD leg. A stashed intent means an
      // OAuth attempt hit an existing account, so ask whether to connect it now.
      // Left in storage until the visitor answers, so a reload mid-question keeps it.
      const pending = readPendingLink()
      if (pending) setStatus({ kind: 'confirm', provider: pending })
      return
    }

    // Always clear the fragment from the address bar — even on rejection — so a
    // link code never lingers in the URL/history.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    // CSRF defense: only complete a link the user actually started in THIS browser.
    // beginLinkProvider stashed an unguessable nonce that round-trips through the
    // signed state into this fragment; a forged `#link_code` URL the user was lured
    // to carries no matching nonce and is refused.
    let expectedNonce: string | null = null
    try { expectedNonce = window.sessionStorage.getItem(LINK_NONCE_KEY) } catch { /* ignore */ }
    const nonce = frag.get('link_nonce')
    if (!nonce || !expectedNonce || nonce !== expectedNonce) {
      return
    }
    startedRef.current = true
    try { window.sessionStorage.removeItem(LINK_NONCE_KEY) } catch { /* ignore */ }
    // Committed to completing the link: clear any pending intent now so a terminal
    // error can't leave a stale intent behind.
    try { window.sessionStorage.removeItem(PENDING_LINK_KEY) } catch { /* ignore */ }

    setStatus({ kind: 'linking', provider })
    void (async () => {
      try {
        await linkProvider({ clientSlug: clientId, providerSlug: provider, code, redirectUri })
        setStatus({ kind: 'success', provider, already: false })
      } catch (err) {
        // A 409 with the self code means it's already linked to THIS account —
        // idempotent success, not an error (vs. provider_linked_other, a real
        // conflict where a different account owns the identity).
        if (err instanceof AuthHttpError && err.status === 409 && err.code === 'provider_linked_self') {
          setStatus({ kind: 'success', provider, already: true })
        } else {
          // A genuine link failure (network, or provider_linked_other) — record it to
          // the error pipeline (GlitchTip) as well as showing the error modal.
          reportAuthError(err, { feature: 'account-linking', step: 'completeLink', provider })
          setStatus({ kind: 'error', message: err instanceof Error ? err.message : "Couldn't connect the account." })
        }
      }
    })()
  }, [isAuthenticated, clientId])

  /** "Not now": drop the pending intent so it can't re-ask, and show nothing. */
  function declineLink(): void {
    clearPendingLink()
    setStatus({ kind: 'idle' })
  }

  /** "Continue with <provider>": start the link round-trip (a top-level navigation to
   *  the AS, returning to the page the visitor is on). Clear the intent first so a
   *  refused or abandoned bounce can't re-trigger it — the returning `#link_code`
   *  carries everything the completion needs. */
  function acceptLink(provider: string): void {
    clearPendingLink()
    try {
      const started = beginLinkProvider({
        providerId: provider,
        returnTo: window.location.pathname + window.location.search,
        clientId,
      })
      // false => the CSRF nonce couldn't be stashed, so it did NOT navigate.
      if (!started) setStatus({ kind: 'error', message: linkStartFailedBody(provider) })
    } catch (err) {
      // Never swallow a failure to start the link — REPORT it to the error pipeline
      // (GlitchTip) AND surface an error modal, instead of letting an unexpected
      // throw escape the click handler unseen.
      reportAuthError(err, { feature: 'account-linking', step: 'acceptLink', provider })
      setStatus({ kind: 'error', message: linkStartFailedBody(provider) })
    }
  }

  // Every non-idle state surfaces in the same themed, centered modal: the forward
  // leg's confirm, an in-progress spinner while the POST is in flight, then success
  // or error. (One AlertModal with a derived config rather than four near-identical
  // render blocks.)
  if (status.kind === 'idle') return null

  // The confirm is the one state with two answers, so it renders its own pair of
  // handlers rather than sharing the dismiss-only one below.
  if (status.kind === 'confirm') {
    const provider = status.provider
    return (
      <AlertModal
        open
        tone="info"
        title={linkConfirmTitle(provider)}
        description={linkConfirmBody(provider)}
        cancelLabel="Not now"
        onCancel={declineLink}
        confirmLabel={linkConfirmAction(provider)}
        onConfirm={() => acceptLink(provider)}
      />
    )
  }

  const modal =
    status.kind === 'linking'
      ? {
          tone: 'info' as const,
          busy: true,
          title: linkInProgressTitle(status.provider),
          description: linkInProgressBody(status.provider),
        }
      : status.kind === 'success'
        ? {
            tone: 'success' as const,
            title: linkSuccessTitle(status.provider),
            description: status.already ? linkAlreadyLinkedBody(status.provider) : linkSuccessBody(status.provider),
            confirmLabel: 'Done',
          }
        : { tone: 'error' as const, title: linkFailedTitle, description: status.message }

  return <AlertModal open {...modal} onConfirm={() => setStatus({ kind: 'idle' })} />
}
