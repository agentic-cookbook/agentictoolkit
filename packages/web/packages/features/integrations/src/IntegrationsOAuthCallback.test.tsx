// @vitest-environment jsdom
import { StrictMode } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * The return leg of every integration connect, which until now nothing rendered anywhere in
 * the fleet.
 *
 * It is the hardest surface here to notice breaking. It runs once, on a page the operator
 * lands on for under a second, after leaving the app entirely — so its failures look like the
 * PROVIDER refusing rather than like this component: a spinner that never stops, or "this
 * link has expired" on a link a moment old. Three of the cases below were live defects that
 * presented exactly that way.
 */

const { connect, push, replace, reportUnexpectedAuthError } = vi.hoisted(() => ({
  connect: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  reportUnexpectedAuthError: vi.fn(),
}));

/** The shape `useAuth` returns that this component reads. `user` is here because the claims
 *  name the customer who started the flow, and the callback refuses a state that names someone
 *  other than whoever is signed in now — the same check the backend makes, answered locally
 *  where it can be a sentence instead of a 400. */
let authed: { isLoading: boolean; isAuthenticated: boolean; user?: { id: string } } = {
  isLoading: false,
  isAuthenticated: true,
  user: { id: "cus-1" },
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
// PARTIAL, via `importOriginal`, and that is load-bearing rather than tidy. A factory that
// returns an object replaces the WHOLE module, so every export it forgets becomes `undefined`
// — and `oauth-callback-store` imports `safeReturnTo` from here to validate the stashed
// `returnTo`. Stubbed away, that call threw, the store read the throw as a corrupt stash, and
// every test with a stash landed on the same wrong branch with no clue pointing at this mock.
// Only the two the component uses are replaced; the origin check runs for real.
vi.mock("@agentic-toolkit/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/auth")>();
  return { ...actual, reportUnexpectedAuthError, useAuth: () => authed };
});
// The REAL `decodeOAuthStateClaims`: the recovery case below is about the actual grammar the
// backend mints, so a stubbed decoder would assert this file against itself.
vi.mock("@agentic-toolkit/data/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data/integrations")>();
  return { ...actual, integrationsApi: { connect } };
});

import { IntegrationsOAuthCallback } from "./IntegrationsOAuthCallback";
import { stashPendingConnect, type PendingOAuthConnect } from "./oauth-callback-store";

const RETURN_TO = "/acme/repos?workspace=acme#connections";

const STASH: PendingOAuthConnect = {
  authMethod: "github_app",
  providerId: "github-app",
  serviceType: "code",
  ecosystemId: "eco-1",
  returnTo: RETURN_TO,
};

/** A state token in the shape `oauthState.ts` mints: base64url(claims) "." base64url(HMAC).
 *  The signature is opaque here on purpose — the client never verifies it, the backend does. */
function signedState(claims: Record<string, unknown>, signature = "not-checked-here"): string {
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url(JSON.stringify(claims))}.${signature}`;
}

// `iat` is milliseconds and is read as such: the backend gives a state ten minutes, and the
// callback refuses a stale one rather than driving a POST it knows will be rejected. Minted at
// module load, so every state below is inside that window.
const CLAIMS = {
  customerId: "cus-1",
  providerId: "github-app",
  serviceType: "code",
  ecosystemId: "eco-1",
  iat: Date.now(),
};

let restoreLocation: (() => void) | null = null;

/** jsdom will not let `search` be reassigned, so the whole `location` is swapped — the same
 *  trick GithubApp.test.tsx uses for `assign`.
 *
 *  `origin` and `href` are spelled out because `Location`'s properties are prototype accessors,
 *  so the spread copies NONE of them. A stand-in without an origin is not merely incomplete: it
 *  is what `safeReturnTo` resolves the stashed `returnTo` against, and an undefined base makes
 *  `new URL` throw — which the store reads as a corrupt stash, in every test at once. */
function atCallback(search: string) {
  const original = window.location;
  const { origin, protocol, host, hostname, port } = original;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      origin,
      protocol,
      host,
      hostname,
      port,
      pathname: "/integrations/oauth-callback",
      search,
      hash: "",
      href: `${origin}/integrations/oauth-callback${search}`,
    },
  });
  restoreLocation = () =>
    Object.defineProperty(window, "location", { configurable: true, value: original });
}

beforeEach(() => {
  connect.mockReset();
  connect.mockResolvedValue({ id: "int-1" });
  replace.mockReset();
  reportUnexpectedAuthError.mockReset();
  sessionStorage.clear();
  authed = { isLoading: false, isAuthenticated: true, user: { id: "cus-1" } };
});
afterEach(() => {
  cleanup();
  restoreLocation?.();
  restoreLocation = null;
});

const stashed = (state: string) => sessionStorage.getItem(`int-oauth-connect:${state}`);

describe("finishing a github_app connect", () => {
  it("files the installation and routes back to the whole URL it started from", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&setup_action=install&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connect).toHaveBeenCalledWith({
      type: "github_app",
      providerId: "github-app",
      serviceType: "code",
      ecosystemId: "eco-1",
      installationId: "42",
      state,
    });
    // The query and hash come back too: on shipr they are the only record that Connections
    // was open, and dropping them lands the operator on a bare tree that looks like a failure.
    await waitFor(() => expect(replace).toHaveBeenCalledWith(RETURN_TO));
  });

  it("clears the stash once consumed, so a replayed callback can't re-fire it", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(stashed(state)).toBeNull();
  });

  /**
   * StrictMode double-invokes effects on one mount. The arming effect used to be
   * cleanup-only, so the second pass left `alive` false while the ONE in-flight connect —
   * not restarted, because `ran` had already fired — was still resolving. Both exits then
   * checked a flag nothing would set back, and the page span forever with the connect
   * already filed on the server. Dev-only, and therefore what every developer saw.
   */
  it("still finishes under StrictMode, where effects run twice on one mount", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(
      <StrictMode>
        <IntegrationsOAuthCallback />
      </StrictMode>,
    );

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(RETURN_TO));
  });

  /**
   * A GitHub App has ONE Setup URL for the whole app, while the stash is `sessionStorage` and
   * therefore per-origin. A connect begun on the hub comes back HERE with nothing stashed —
   * which used to be indistinguishable from an expired link, on every attempt, forever.
   */
  it("rebuilds its context from the signed state when the stash is another origin's", async () => {
    const state = signedState(CLAIMS);
    atCallback(`?installation_id=99&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "github_app",
        providerId: "github-app",
        serviceType: "code",
        ecosystemId: "eco-1",
        installationId: "99",
        state,
      }),
    );
    // `returnTo` is the one claim the state cannot carry, so recovery lands on the console
    // entry every site in the family mounts — WITH the connections fragment, because this is
    // the arrival it was added for: the connect was started from a dialog on another origin,
    // and a bare tree with every dialog shut is what reads as the connect having failed.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home#connections"));
  });

  it("does not rebuild an OAuth flow, which would have to guess a redirect_uri", async () => {
    // No installation_id: this is the OAuth pair's shape, and echoing a guessed redirect_uri
    // is a mismatch at the provider rather than a recovery.
    const state = signedState({ ...CLAIMS, providerId: "slack", serviceType: "messaging" });
    atCallback(`?code=abc&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/expired or was already used/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  it("says an owner must approve, rather than reporting a missing installation id", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?setup_action=request&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/an owner has to approve it/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });
});

describe("the exits that finish nothing", () => {
  it("reports a provider that refused, and files nothing", async () => {
    atCallback("?error=access_denied&state=whatever");
    render(<IntegrationsOAuthCallback />);
    expect(await screen.findByText(/cancelled or failed \(access_denied\)/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  it("reports a callback with no round-trip state at all", async () => {
    atCallback("?installation_id=42");
    render(<IntegrationsOAuthCallback />);
    expect(await screen.findByText(/missing its round-trip state/i)).toBeTruthy();
  });

  it("asks an unauthenticated visitor to sign in, without calling connect", async () => {
    authed = { isLoading: false, isAuthenticated: false };
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/session isn't active/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  it("waits for the session to hydrate before deciding anything", async () => {
    authed = { isLoading: true, isAuthenticated: false };
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    // Still working, NOT "sign in": a session mid-hydration is not an absent one, and the
    // stash must survive to be finished on the next pass.
    expect(screen.getByRole("status")).toBeTruthy();
    expect(stashed(state)).not.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  /**
   * The `finally`, on an exit that SPENT the credential. A connect that reached the backend
   * consumed the provider's single-use `code` (or filed the installation) whatever it answered,
   * so the entry cannot be replayed and is only something for a later flow to trip on. The
   * tombstone is deliberately not laid here — a failed connect is one the operator may retry.
   */
  it("clears the stash even when the connect throws", async () => {
    connect.mockRejectedValue(new Error("installation already claimed"));
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/installation already claimed/i)).toBeTruthy();
    expect(stashed(state)).toBeNull();
    expect(reportUnexpectedAuthError).toHaveBeenCalledWith(
      expect.any(Error),
      // The step names WHICH flow failed — the only detail that distinguishes the three
      // connects in a report that otherwise just says "the callback".
      { feature: "integration-oauth-callback", step: "github_app" },
    );
  });

  /**
   * The mirror of the test above, and the reason the clear is conditional rather than blanket.
   *
   * This exit spent NOTHING: no connect was issued, the installation does not exist yet, and
   * the message the operator is reading tells them in so many words to come back and try again
   * once an owner has approved. A blanket clear took the stash away on precisely that exit, so
   * the retry it invited reported an expired link instead — and for an `oauth` connect it could
   * not be recovered from at all, `redirectUri` living nowhere but the stash.
   */
  it("keeps the stash on an exit that spent nothing, so the retry it invites can work", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?setup_action=request&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/an owner has to approve it/i)).toBeTruthy();
    expect(stashed(state)).not.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it("offers a way back that does not name a page the host may not have", async () => {
    atCallback("?error=access_denied&state=whatever");
    render(<IntegrationsOAuthCallback />);
    // "Back", not "Back to Integrations": on a console that shows connections in a DIALOG,
    // this lands on a workspace page, and there is no page called Integrations to promise.
    expect(await screen.findByRole("button", { name: "Back" })).toBeTruthy();
  });
});

/**
 * The OAuth pair. Every case above is `github_app`, which is the branch the fleet actually
 * reaches today — but it is also the only branch that can be REBUILT from the state, so it is
 * the one whose bugs the other two do not share. These two exist so the branch that carries a
 * `redirect_uri` and the branch that does not are each rendered at least once.
 */
describe("finishing an oauth connect", () => {
  const OAUTH_STASH: PendingOAuthConnect = {
    authMethod: "oauth",
    providerId: "slack",
    serviceType: "messaging",
    ecosystemId: "eco-1",
    redirectUri: "https://shipr.example/integrations/oauth-callback",
    returnTo: RETURN_TO,
  };

  it("exchanges the code, echoing the exact redirect_uri that was sent", async () => {
    const state = signedState({ ...CLAIMS, providerId: "slack", serviceType: "messaging" });
    stashPendingConnect(state, OAUTH_STASH);
    atCallback(`?code=abc&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connect).toHaveBeenCalledWith({
      type: "oauth",
      providerId: "slack",
      serviceType: "messaging",
      ecosystemId: "eco-1",
      code: "abc",
      // The token exchange must echo the redirect_uri VERBATIM; a guessed or blank one is a
      // mismatch at the provider, which is why this flow is never rebuilt from the state.
      redirectUri: "https://shipr.example/integrations/oauth-callback",
      state,
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(RETURN_TO));
  });

  it("sends no redirect_uri for an oauth_instance connect, which never had one", async () => {
    const state = signedState({ ...CLAIMS, providerId: "jira", serviceType: "tracking" });
    // The stash CARRIES a redirectUri — `registerInstance` was given one and the store requires
    // it of both OAuth variants — and the connect body still must not: the wire type for
    // `oauth_instance` has no such field, because the instance was registered against that URI
    // rather than the token being exchanged at it. Holding the stash to production's shape is
    // the whole point of the assertion below; a stash invented without the field would prove
    // only that a field nobody stored never got sent.
    stashPendingConnect(state, {
      authMethod: "oauth_instance",
      providerId: "jira",
      serviceType: "tracking",
      ecosystemId: "eco-1",
      redirectUri: "https://shipr.example/integrations/oauth-callback",
      returnTo: RETURN_TO,
    });
    atCallback(`?code=xyz&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connect).toHaveBeenCalledWith({
      type: "oauth_instance",
      providerId: "jira",
      serviceType: "tracking",
      ecosystemId: "eco-1",
      code: "xyz",
      state,
    });
    expect(connect.mock.calls[0]?.[0]).not.toHaveProperty("redirectUri");
  });

  it("reports a missing code, and keeps the stash the retry needs", async () => {
    const state = signedState({ ...CLAIMS, providerId: "slack", serviceType: "messaging" });
    stashPendingConnect(state, OAUTH_STASH);
    atCallback(`?state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/missing its authorization code/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
    // Nothing was spent, and this is the stash that cannot be rebuilt from the state.
    expect(stashed(state)).not.toBeNull();
  });
});

describe("the cases a stateless state token makes reachable", () => {
  /**
   * The signed state carries no consumption record — no DB row, nothing to mark spent — so the
   * only thing that knows this callback already ran is a tombstone left where the stash was.
   * Reloading a finished callback is the ordinary way to reach this, and without the tombstone
   * it POSTs again, the backend answers 409, and the operator reads raw API prose under the
   * heading "Connection not completed" about a connection that completed a second ago.
   */
  it("recognizes a replayed callback instead of re-POSTing a connect that already worked", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(RETURN_TO));
    cleanup();

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/already set up/i)).toBeTruthy();
    // The heading, not just the sentence: a replay is not a failure, and calling it one is
    // what sends an operator round a flow that has already succeeded.
    expect(screen.getByText("Already connected")).toBeTruthy();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(reportUnexpectedAuthError).not.toHaveBeenCalled();
  });

  /**
   * "Nothing was stashed here" and "something was stashed and cannot be read" are the same
   * answer from `readPendingConnect` and want opposite handling. Rebuilding over the second
   * silently reclassifies the flow — an `oauth` connect has a stash precisely because it has a
   * redirect_uri to echo — so it would fail at the provider instead of reporting the stash.
   */
  it("reports an unreadable stash rather than rebuilding a github_app connect over it", async () => {
    const state = signedState(CLAIMS);
    sessionStorage.setItem(`int-oauth-connect:${state}`, "{ not json");
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/saved details are unreadable/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  /**
   * `setup_action=request` sends NO `installation_id` — there is no installation yet, an owner
   * has to approve it first — and it arrives at the app-wide Setup URL, which is exactly the
   * origin that stashed nothing. Recovery that insisted on an id therefore reported "expired"
   * for the one case the approval message was written for, on the one origin it can happen on.
   */
  it("still says an owner must approve when the return landed on another origin", async () => {
    const state = signedState(CLAIMS);
    atCallback(`?setup_action=request&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/an owner has to approve it/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  /**
   * The backend gives a state ten minutes, and `setup_action=request` is a case that routinely
   * takes longer: an org owner has to notice and approve it. The claims are readable without
   * the key, so the age is answerable here — and the difference is a sentence naming what to do
   * rather than the backend's own rejection arriving as an unexpected error with a Sentry event.
   */
  it("refuses a state older than the window, without POSTing one it knows is refused", async () => {
    const state = signedState({ ...CLAIMS, iat: Date.now() - 11 * 60 * 1000 });
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    expect(await screen.findByText(/request has expired/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();
  });

  /**
   * The state is bound to the customer who started the flow, and the backend refuses one that
   * names anybody else. Two people signed into the same browser profile at different times is
   * the ordinary way there — and "sign in as that account" is something the operator can act
   * on, which "400 bad state" is not.
   */
  it("refuses a state minted for a different account, and can change its mind", async () => {
    authed = { isLoading: false, isAuthenticated: true, user: { id: "cus-2" } };
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    const { rerender } = render(<IntegrationsOAuthCallback />);
    expect(await screen.findByText(/started from a different account/i)).toBeTruthy();
    expect(connect).not.toHaveBeenCalled();

    // Not latched: signing in as the account that started the flow is a thing to DO from this
    // page, and the stash is still here to finish with.
    authed = { isLoading: false, isAuthenticated: true, user: { id: "cus-1" } };
    rerender(<IntegrationsOAuthCallback />);
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
  });

  /**
   * `isLoading` settles false with no user whenever a silent SSO probe is declined or /auth/me
   * returns a transient 5xx with nothing cached, and the session can arrive after that. The
   * effect's dependencies exist for that transition; a `ran` latch set before the guards
   * swallowed it, leaving the operator on "sign in" with no way forward but a reload.
   */
  it("finishes the connect when the session arrives after the first pass said it hadn't", async () => {
    authed = { isLoading: false, isAuthenticated: false };
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?installation_id=42&state=${encodeURIComponent(state)}`);

    const { rerender } = render(<IntegrationsOAuthCallback />);
    expect(await screen.findByText(/session isn't active/i)).toBeTruthy();

    authed = { isLoading: false, isAuthenticated: true, user: { id: "cus-1" } };
    rerender(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(RETURN_TO));
  });
});
