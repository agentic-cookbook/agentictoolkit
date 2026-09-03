"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug } from "lucide-react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { decodeOAuthStateClaims, integrationsApi } from "@agentic-toolkit/data/integrations";
import {
  clearPendingConnect,
  readPendingConnect,
  type PendingOAuthConnect,
} from "./oauth-callback-store";

type Phase = "working" | "error";

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
  const { isLoading, isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (ran.current) return;
    if (isLoading) return; // wait for the session to hydrate before an authed connect
    ran.current = true;

    void (async () => {
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

      if (oauthError) {
        return fail(`Authorization was cancelled or failed (${oauthError}).`);
      }
      // `state` is checked first and alone: it is the one parameter every flow returns, and
      // the context it keys is what says which credential the rest of the query owed us.
      if (!state) {
        return fail("This callback is missing its round-trip state, so there's nothing to finish.");
      }

      // Everything past this point has a `state` to clear, and EVERY exit clears it — the
      // provider `code` is single-use and the signed `state` is one-shot either way, so a
      // replay of this callback cannot succeed and a stash left behind is only something for
      // a later flow to trip over. That is why this is a `finally` and not a line repeated at
      // each of the seven exits, one of which used to forget it.
      // Hoisted out of the try so the catch below can still name which flow was being
      // finished — the report is most useful for the connect call, which is the only thing in
      // here that can throw for a reason worth a Sentry event.
      let step: PendingOAuthConnect["authMethod"] | undefined;
      try {
        const ctx = readPendingConnect(state) ?? recoverFromState(state, installationId);
        if (!ctx) {
          return fail(
            "This connection link has expired or was already used. Start again from Integrations.",
          );
        }
        step = ctx.authMethod;
        if (alive.current) setReturnTo(ctx.returnTo);
        if (!isAuthenticated) {
          return fail("Your session isn't active. Sign in, then reconnect from Integrations.");
        }
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
          await integrationsApi.connect({
            type: "oauth_instance",
            providerId: ctx.providerId,
            serviceType: ctx.serviceType,
            ecosystemId: ctx.ecosystemId,
            code,
            state,
          });
        }
        if (alive.current) router.replace(ctx.returnTo);
      } catch (err) {
        reportUnexpectedAuthError(err, { feature: "integration-oauth-callback", step });
        fail(err instanceof Error && err.message ? err.message : "Couldn't finish the connection.");
      } finally {
        clearPendingConnect(state);
      }
    })();
  }, [isLoading, isAuthenticated, router]);

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
            <h1 className="text-base font-semibold text-apt-text">Connection not completed</h1>
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

/** Where to send someone whose return context we had to rebuild — the one path every site in
 *  the family mounts and resolves a workspace from. */
const FALLBACK_RETURN_TO = "/home";

/**
 * Rebuild a `github_app` context from the `state` alone, for the return that arrives on an
 * origin that never stashed one.
 *
 * A GitHub App has ONE Setup URL for the whole app, so an installation started anywhere in
 * the family comes back to that single origin — while the stash is `sessionStorage`, which is
 * per-origin and therefore empty there. Without this, "connect" on any site but the one
 * holding the Setup URL ends on "this link has expired", every time, with nothing wrong.
 *
 * Only `github_app` can be rebuilt, and only when an `installation_id` says that is the flow:
 * it is the one method that needs no `redirect_uri` to echo, and the one whose credential is
 * an id rather than a single-use code. The OAuth pair still requires its stash — an exchange
 * that echoes a redirect_uri it has to guess is a mismatch, not a recovery.
 *
 * `returnTo` is the one thing the state cannot carry, so it falls back to `/home`.
 */
function recoverFromState(state: string, installationId: string | null): PendingOAuthConnect | null {
  if (!installationId) return null;
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
