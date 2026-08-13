// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@agentic-toolkit/ui/components/alert-modal', () => ({
  AlertModal: ({ title, confirmLabel, onConfirm }: { title: string; confirmLabel?: string; onConfirm?: () => void }) => (
    <div role="dialog" aria-label={title}>
      {title}
      {confirmLabel ? <button onClick={onConfirm}>{confirmLabel}</button> : null}
    </div>
  ),
}));
vi.mock('../client', () => ({ exchangeSsoCode: vi.fn() }));
vi.mock('../report', () => ({ reportUnexpectedAuthError: vi.fn() }));

import { SsoCallback } from '../ui/SsoCallback';
import { loginDisabledTitle, accountExistsTitle } from '../labels';
import { PENDING_LINK_KEY } from '../sso';
import { exchangeSsoCode } from '../client';

// Mirror of the private key in sso.ts — the stash centralLoginTarget writes and
// this page redeems.
const RETURN_TO_KEY = 'adh_sso_return_to';

function renderAt(hash: string, extraProps: Record<string, unknown> = {}) {
  window.history.replaceState(null, '', `/auth/callback${hash}`);
  return render(<SsoCallback loginWithTokens={vi.fn()} isAuthenticated={false}
    homeHref="/home" clientId="adh" {...extraProps} />);
}

beforeEach(() => { replace.mockReset(); window.sessionStorage.clear(); });

describe('SsoCallback destination', () => {
  // The signed-in end of a successful exchange: the code redeems, the site adopts
  // the session, and `isAuthenticated` is true — which is the prop, so the tests
  // supply it directly rather than waiting for the host's context to catch up.
  const signedIn = { isAuthenticated: true };
  beforeEach(() => {
    vi.mocked(exchangeSsoCode).mockResolvedValue({ tokens: { token: 't' }, user: { id: 'u-1' } } as never);
  });

  it('lands on the stashed returnTo rather than homeHref', async () => {
    // The regression this guards: a credential login is central, so the card that
    // collected the password routes nowhere itself — it stashes where the visitor
    // was going and hands off to the AS. Redeeming the code here was the only step
    // left that could honour that, and it read homeHref alone, so every `?next=` in
    // the fleet was silently dropped (the /join invitation handoff most visibly).
    window.sessionStorage.setItem(RETURN_TO_KEY, '/join?invite=tok-123');
    renderAt('#code=c1', signedIn);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/join?invite=tok-123'));
    expect(replace).not.toHaveBeenCalledWith('/home');
  });

  it('falls back to homeHref when nothing was stashed', async () => {
    renderAt('#code=c1', signedIn);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });

  it('resolves the destination once, so a re-render cannot lose it to the cleared stash', async () => {
    // takeReturnTo() clears the stash as it reads it, and the redirect effect re-runs
    // on every isAuthenticated/router change — so a destination recomputed per run
    // would answer '/join…' once and '/home' forever after. Re-rendering must not
    // produce a second, different answer.
    window.sessionStorage.setItem(RETURN_TO_KEY, '/join?invite=tok-123');
    const { rerender } = renderAt('#code=c1', signedIn);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/join?invite=tok-123'));
    rerender(<SsoCallback loginWithTokens={vi.fn()} isAuthenticated homeHref="/home" clientId="adh" />);
    expect(replace).not.toHaveBeenCalledWith('/home');
  });
});

describe('SsoCallback gate codes', () => {
  it('shows the login-disabled alert on #error=login_disabled', async () => {
    renderAt('#error=login_disabled');
    await waitFor(() => expect(screen.getByRole('dialog', { name: loginDisabledTitle })).toBeTruthy());
  });

  it('holds an authenticated session on the login-disabled alert instead of bouncing home', async () => {
    // Task-4 guard regression: an OPTIMISTICALLY-restored session (isAuthenticated
    // already true) must NOT be redirected to homeHref past the login_disabled
    // notice — the `!loginDisabled` guard on the redirect effect must hold it on
    // the alert.
    renderAt('#error=login_disabled', { isAuthenticated: true });
    await waitFor(() => expect(screen.getByRole('dialog', { name: loginDisabledTitle })).toBeTruthy());
    expect(replace).not.toHaveBeenCalledWith('/home');
  });

  it('does not stash the pending link until the account_exists notice is acknowledged', async () => {
    // ProviderLinkHandler is mounted at the app root — this page included — and reads
    // a stashed intent as "the visitor agreed to connect this provider", opening its
    // own confirm the moment it sees one alongside a session. Writing the key while
    // this notice is still up therefore put two modals on one page and let whichever
    // effect ran last decide which the visitor saw. Nothing may be stashed before
    // Continue; Continue must stash it and go to /login, in that order.
    renderAt('#error=account_exists&link_provider=github', { isAuthenticated: true });
    await waitFor(() => expect(screen.getByRole('dialog', { name: accountExistsTitle })).toBeTruthy());
    expect(window.sessionStorage.getItem(PENDING_LINK_KEY)).toBeNull();
    expect(replace).not.toHaveBeenCalledWith('/home');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(window.sessionStorage.getItem(PENDING_LINK_KEY)).toBe('github');
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('redirects to signupBlockedHref with the email on #error=signups_closed', async () => {
    renderAt('#error=signups_closed&email=a%40b.com', { signupBlockedHref: '/signup' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signup?reason=signups_closed&email=a%40b.com'));
  });

  it('falls back to an inline message for signups_closed when no signupBlockedHref', async () => {
    renderAt('#error=signups_closed');
    await waitFor(() => expect(screen.getByText(/sign-?ups aren't open/i)).toBeTruthy());
  });

  it('holds an authenticated session and still hands off to /signup on #error=signups_closed', async () => {
    // Regression: the signups_closed branch omitted the holdHomeRedirectRef its
    // siblings set, so an OPTIMISTICALLY-restored session (isAuthenticated already
    // true) could bounce to homeHref and override the /signup handoff. It must land
    // on /signup, never /home.
    renderAt('#error=signups_closed&email=a%40b.com', { isAuthenticated: true, signupBlockedHref: '/signup' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signup?reason=signups_closed&email=a%40b.com'));
    expect(replace).not.toHaveBeenCalledWith('/home');
  });
});
