"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug } from "lucide-react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import {
  decodeOAuthStateClaims,
  integrationsApi,
  isOAuthStateFresh,
} from "@agentic-toolkit/data/integrations";
import {
  FALLBACK_RETURN_TO,
  clearPendingConnect,
  hasPendingConnect,
  markPendingConnectConsumed,
  readPendingConnect,
  wasPendingConnectConsumed,
  type PendingOAuthConnect,
} from "./oauth-callback-store";

type Phase = "working" | "error" | "done";

/**
 * Where a connect that left the app comes back to. Every site that starts one mounts this
 * at `/integrations/oauth-callback` (OAUTH_CALLBACK_PATH).
 *
 * React state didn't survive the round-trip, so the connect context is recovered from
 * `sessionStorage` (keyed by the signed `state` every flow echoes back), the connect is
 * finished, the entry is cleared, and the visitor is routed back where they started. Query
 * params are read from `window.location` (client-only), so no Suspense boundary is needed.
 *
 * WHAT sits beside the state differs by flow, which is why the stashed context is read
 * before any credential is demanded:
 *   • oauth / oauth_instance → `?code=` — an authorization to exchange for a token.
 *   • github_app            → `?installation_id=&setup_action=` — not an authorization
 *     but a thing that now exists at the provider and has an id. `setup_action=request`
 *     means an org owner still has to approve it, so there is no installation to file yet.
 */
export function IntegrationsOAuthCallback() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useAuth();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Finishing your connection…");
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const ran = useRef(false);
  // The connect is in-flight across a network round-trip; if the user navigates away before
  // it resolves, don't setState on an unmounted component and — the surprising one — don't
  // router.replace them back here from wherever they went (mirrors the sibling components'
  // `alive` guard).
  const alive = useRef(true);
  useEffect(() => {
    // Re-ARMED, not merely torn down: under StrictMode the effect below runs, is cleaned up,
    // and runs again on the same mount, so a cleanup-only version leaves `alive` false while
    // the one in-flight connect (started by the first run, and not restarted by the second —
    // `ran` sees to that) is still resolving. Both exits then check a flag nothing will ever
    // set back, and the page spins forever. Every sibling with an `alive` ref arms it here.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (ran.current) return;

    // The query is parsed, and every SYNCHRONOUS verdict below is reached, BEFORE `ran` is
    // set. The latch exists to stop the connect happening twice; placed at the top it also
    // swallowed the only thing the dependency array is for — a session that settles after
    // this effect's first pass — which made `isAuthenticated` decorative and parked the
    // operator on "your session isn't active" with no route back but a reload.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const installationId = params.get("installation_id");
    const setupAction = params.get("setup_action");
    const state = params.get("state");
    const oauthError = params.get("error");

    const fail = (text: string) => {
      if (!alive.current) return;
      setPhase("error");
      setMessage(text);
    };
    /** A verdict no dependency can overturn — latch, so later passes don't re-litigate it. */
    const settle = (text: string) => {
      ran.current = true;
      fail(text);
    };

    if (oauthError) {
      return settle(`Authorization was cancelled or failed (${oauthError}).`);
    }
    // `state` is checked first and alone: it is the one parameter every flow returns, and
    // the context it keys is what says which credential the rest of the query owed us.
    if (!state) {
      return settle("This callback is missing its round-trip state, so there's nothing to finish.");
    }
    if (wasPendingConnectConsumed(state)) {
      // A reload — or a session restore, or a back-button — onto a callback that already
      // succeeded. The signed state is stateless, with no consumption record anywhere, and
      // the recovery path below rebuilds a context happily from the URL, so without this
      // tombstone the second pass POSTs again and the backend answers 409 "already connected
      // to …". That reached the operator as raw API prose and Sentry as an event, for the
      // ordinary act of refreshing a page that had worked.
      ran.current = true;
      if (alive.current) {
        setPhase("done");
        setMessage("This connection is already set up — nothing left to finish.");
      }
      return;
    }

    // Which context finishes this callback — and, just as load-bearing, WHY there isn't one.
    // "Nothing was stashed on this origin" is the ordinary cross-origin arrival that a GitHub
    // App's single Setup URL guarantees, and it is recoverable from the signed state.
    // "Something was stashed and cannot be read" is corruption, and rebuilding over it
    // silently reclassifies the flow: an `oauth` connect has a stash precisely because it has
    // a redirect_uri only the stash carries, so a github_app context invented in its place
    // fails at the provider instead of reporting the stash that is actually broken.
    if (!readPendingConnect(state) && hasPendingConnect(state)) {
      return settle(
        "This connection's saved details are unreadable, so it can't be finished. Start again" +
          " from Integrations.",
      );
    }
    const ctx =
      readPendingConnect(state) ?? recoverFromState({ state, installationId, setupAction, code });
    if (!ctx) {
      return settle(
        "This connection link has expired or was already used. Start again from Integrations.",
      );
    }
    if (alive.current) setReturnTo(ctx.returnTo);

    if (isLoading) return; // wait for the session to hydrate before an authed connect
    if (!isAuthenticated) {
      // Deliberately NOT latched. `isLoading` settles false with no user whenever a silent SSO
      // probe is declined or `/auth/me` returns a transient 5xx with nothing cached, and the
      // user object can arrive afterwards. That transition is exactly what this effect's
      // dependencies are for.
      return fail("Your session isn't active. Sign in, then reconnect from Integrations.");
    }

    // The claims name the caller and the moment the flow began, and the backend re-checks
    // both before it writes anything. Answering them here costs nothing and is the difference
    // between a sentence the operator can act on and the backend's own rejection text
    // arriving as an unexpected error — with a Sentry event attached.
    const claims = decodeOAuthStateClaims(state);
    if (claims && !isOAuthStateFresh(claims)) {
      // Not hypothetical, and not an edge: `setup_action=request` tells the operator that an
      // org owner has to approve the install, and an approval that lands after the ten-minute
      // window returns a state the backend is certain to refuse.
      return settle(
        "This connection request has expired. Start again from Integrations to get a fresh one.",
      );
    }
    if (claims && userId && claims.customerId !== userId) {
      // Unlatched for the same reason as the sign-in message above: signing in as the account
      // that started the flow is a thing the operator can do from here, and `userId` is in the
      // dependency array so that it takes effect.
      return fail(
        "This connection was started from a different account. Sign in as that account, or" +
          " start again from Integrations.",
      );
    }

    ran.current = true;
    // A pass that reached here after an earlier one reported something recoverable — no
    // session yet, the wrong account — must not leave that message standing over a connect
    // that is now actually running.
    if (alive.current) {
      setPhase("working");
      setMessage("Finishing your connection…");
    }

    void (async () => {
      // Whether the credential was actually SPENT — i.e. whether a connect was issued — which
      // is the only thing that makes the stash safe to destroy. See the `finally`.
      let spent = false;
      try {
        const missing = (what: string) =>
          fail(`This callback is missing its ${what}, so there's nothing to finish.`);

        if (ctx.authMethod === "github_app") {
          if (setupAction === "request") {
            return fail(
              "You asked for the app to be installed on that organization, and an owner has to" +
                " approve it. Connect again once they have.",
            );
          }
          if (!installationId) return missing("installation id");
          spent = true;
          await integrationsApi.connect({
            type: "github_app",
            providerId: ctx.providerId,
            serviceType: ctx.serviceType,
            ecosystemId: ctx.ecosystemId,
            installationId,
            state,
          });
        } else if (!code) {
          return missing("authorization code");
        } else if (ctx.authMethod === "oauth") {
          spent = true;
          await integrationsApi.connect({
            type: "oauth",
            providerId: ctx.providerId,
            serviceType: ctx.serviceType,
            ecosystemId: ctx.ecosystemId,
            code,
            redirectUri: ctx.redirectUri,
            state,
          });
        } else {
          spent = true;
          await integrationsApi.connect({
            type: "oauth_instance",
            providerId: ctx.providerId,
            serviceType: ctx.serviceType,
            ecosystemId: ctx.ecosystemId,
            code,
            state,
          });
        }
        // The tombstone goes down only on a connect that SUCCEEDED: a failed one leaves
        // nothing filed at the provider's end of this app, so a retry is the right answer and
        // must not be met with "already set up".
        markPendingConnectConsumed(state);
        if (alive.current) router.replace(ctx.returnTo);
      } catch (err) {
        reportUnexpectedAuthError(err, {
          feature: "integration-oauth-callback",
          step: ctx.authMethod,
        });
        fail(err instanceof Error && err.message ? err.message : "Couldn't finish the connection.");
      } finally {
        // Cleared on the exits that spent the credential, and ONLY those. The four above it
        // consume nothing — an approval still pending, a missing installation id, a missing
        // code, and (before the async even starts) no session — and every one of them tells
        // the operator to try again from here. A blanket clear took the stash away on all
        // four, so the retry the message invited then reported an expired link: `redirectUri`
        // exists nowhere but the stash, and the recovery path cannot invent one.
        if (spent) clearPendingConnect(state);
      }
    })();
  }, [isLoading, isAuthenticated, userId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-apt-border bg-apt-surface p-8 text-center">
        <Plug className="size-6 text-apt-gold" aria-hidden />
        {phase === "working" ? (
          <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="size-5 animate-spin text-apt-text-muted" aria-hidden />
            <p className="text-sm text-apt-text-muted">{message}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* The heading names the OUTCOME, and a replay is not a failure: a refreshed
                callback that already succeeded said "Connection not completed" over a
                connection that was, in fact, completed — which is the one reading that makes
                an operator start the whole flow again. */}
            <h1 className="text-base font-semibold text-apt-text">
              {phase === "done" ? "Already connected" : "Connection not completed"}
            </h1>
            <p className="text-sm text-apt-text-muted">{message}</p>
            {/* "Back", not "Back to Integrations": where this lands is whatever URL the visitor
                left from, which on a console that shows connections in a DIALOG is a workspace
                page, not a page called Integrations. Naming a destination the button may not
                have is worse than naming none. */}
            <Button onClick={() => router.replace(returnTo ?? FALLBACK_RETURN_TO)}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Rebuild a `github_app` context from the `state` alone, for the return that arrives on an
 * origin that never stashed one.
 *
 * A GitHub App has ONE Setup URL for the whole app, so an installation started anywhere in
 * the family comes back to that single origin — while the stash is `sessionStorage`, which is
 * per-origin and therefore empty there. Without this, "connect" on any site but the one
 * holding the Setup URL ends on "this link has expired", every time, with nothing wrong.
 *
 * Only `github_app` can be rebuilt: it is the one method that needs no `redirect_uri` to echo,
 * and the one whose credential is an id rather than a single-use code.
 *
 * `returnTo` is the one thing the state cannot carry, so it falls back to the family entry
 * point — WITH the connections fragment, because this is the arrival the fragment was added
 * for: the operator started the connect from a dialog on another origin, and landing them on
 * a bare tree with every dialog shut is the exact symptom that reads as the connect having
 * failed.
 */
function recoverFromState(params: {
  state: string;
  installationId: string | null;
  setupAction: string | null;
  code: string | null;
}): PendingOAuthConnect | null {
  const { state, installationId, setupAction, code } = params;
  // A `code` present means an OAuth authorization came back, and the OAuth pair is precisely
  // what cannot be rebuilt: the token exchange must echo the exact `redirect_uri` that was
  // sent, and that lives only in the stash. Refusing here also closes a misroute — the claims
  // name no auth method at all, and `installation_id` is an unsigned query parameter, so
  // without this a genuine `oauth` state paired with an arbitrary `?installation_id=` would be
  // rebuilt as a github_app connect against an OAuth provider.
  if (code) return null;
  // `setup_action` on its own is enough, and has to be: `setup_action=request` — an org owner
  // has yet to approve the install — arrives with NO `installation_id`, and it is a return to
  // the app-wide Setup URL, i.e. exactly the arrival this function exists for. Requiring an id
  // here reported that case as an expired link on the one origin the recovery was written for,
  // with the approval message it needed sitting unreachable inside the branch below.
  if (!installationId && !setupAction) return null;
  const claims = decodeOAuthStateClaims(state);
  if (!claims) return null;
  return {
    authMethod: "github_app",
    providerId: claims.providerId,
    serviceType: claims.serviceType,
    ecosystemId: claims.ecosystemId,
    returnTo: FALLBACK_RETURN_TO,
  };
}
