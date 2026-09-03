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

let authed = { isLoading: false, isAuthenticated: true };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@agentic-toolkit/auth", () => ({
  reportUnexpectedAuthError,
  useAuth: () => authed,
}));
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

const CLAIMS = {
  customerId: "cus-1",
  providerId: "github-app",
  serviceType: "code",
  ecosystemId: "eco-1",
  iat: 1_700_000_000,
};

let restoreLocation: (() => void) | null = null;

/** jsdom will not let `search` be reassigned, so the whole `location` is swapped — the same
 *  trick GithubApp.test.tsx uses for `assign`. */
function atCallback(search: string) {
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...original, pathname: "/integrations/oauth-callback", search, hash: "" },
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
  authed = { isLoading: false, isAuthenticated: true };
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
    // entry every site in the family mounts.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
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
   * The `finally`. Seven exits reach this point and the stash has to go on every one of them:
   * the provider `code` is single-use and the signed `state` is one-shot either way, so a
   * replay cannot succeed — a surviving entry is only something for a later flow to trip on.
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

  it("clears the stash on an exit that never called connect at all", async () => {
    const state = signedState(CLAIMS);
    stashPendingConnect(state, STASH);
    atCallback(`?setup_action=request&state=${encodeURIComponent(state)}`);

    render(<IntegrationsOAuthCallback />);

    await waitFor(() => expect(stashed(state)).toBeNull());
  });

  it("offers a way back that does not name a page the host may not have", async () => {
    atCallback("?error=access_denied&state=whatever");
    render(<IntegrationsOAuthCallback />);
    // "Back", not "Back to Integrations": on a console that shows connections in a DIALOG,
    // this lands on a workspace page, and there is no page called Integrations to promise.
    expect(await screen.findByRole("button", { name: "Back" })).toBeTruthy();
  });
});
