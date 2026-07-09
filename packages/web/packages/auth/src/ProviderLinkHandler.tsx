'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { reportAuthError } from './report'
import { useAuth } from './context'
import { linkProvider, AuthHttpError } from './client'
import { LINK_NONCE_KEY, PENDING_LINK_KEY } from './sso'
import {
  linkInProgressTitle,
  linkInProgressBody,
  linkSuccessTitle,
  linkSuccessBody,
  linkAlreadyLinkedBody,
  linkFailedTitle,
} from './labels'

type Status =
  | { kind: 'idle' }
  | { kind: 'linking'; provider: string }
  | { kind: 'success'; provider: string; already: boolean }
  | { kind: 'error'; message: string }

export interface ProviderLinkHandlerProps {
  /** OAuth client id used when linking (default 'adh'). */
  clientId?: string
}

/** Drop-in, mount once in the authenticated shell. Completes the RETURN leg of a
 *  reactive account-link: when the AS bounces back a `#link_code` (the user
 *  authorized the provider after a post-login confirm in the LoginCard), this POSTs
 *  it to /auth/link-provider — CSRF-guarded by the round-tripped nonce — and then
 *  shows a themed success modal (or an error). The FORWARD leg (the confirm + the
 *  `beginLinkProvider` start) lives in LoginCard, so a pending intent never links
 *  without the user explicitly continuing. */
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

    if (!code || !provider || !redirectUri) return

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

  // Every non-idle state surfaces in the same themed, centered modal: an in-progress
  // spinner while the POST is in flight, then success or error. (One AlertModal with
  // a derived config rather than three near-identical render blocks.)
  if (status.kind === 'idle') return null

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
