"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug } from "lucide-react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { integrationsApi } from "@agentic-toolkit/data/integrations";
import {
  clearPendingConnect,
  readPendingConnect,
} from "./oauth-callback-store";

type Phase = "working" | "error";

/**
 * The OAuth / oauth_instance redirect landing (outside the workspace shell). The
 * provider sends the browser here with `?code=&state=`; React state didn't survive
 * the round-trip, so we recover the connect context from `sessionStorage` (keyed by
 * the signed `state`), finish the connect, clear the entry, and route back to the
 * Integrations topic. Query params are read from `window.location` (client-only), so
 * no Suspense boundary is needed.
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
  useEffect(() => () => {
    alive.current = false;
  }, []);

  useEffect(() => {
    if (ran.current) return;
    if (isLoading) return; // wait for the session to hydrate before an authed connect
    ran.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error");

      if (oauthError) {
        setPhase("error");
        setMessage(`Authorization was cancelled or failed (${oauthError}).`);
        return;
      }
      if (!code || !state) {
        setPhase("error");
        setMessage("This callback is missing its authorization code, so there's nothing to finish.");
        return;
      }
      const ctx = readPendingConnect(state);
      if (!ctx) {
        setPhase("error");
        setMessage(
          "This connection link has expired or was already used. Start again from Integrations.",
        );
        return;
      }
      setReturnTo(ctx.returnTo);
      if (!isAuthenticated) {
        setPhase("error");
        setMessage("Your session isn't active. Sign in, then reconnect from Integrations.");
        return;
      }
      try {
        if (ctx.authMethod === "oauth") {
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
        clearPendingConnect(state);
        if (alive.current) router.replace(ctx.returnTo);
      } catch (err) {
        reportUnexpectedAuthError(err, {
          feature: "integration-oauth-callback",
          step: ctx.authMethod,
        });
        // The provider `code` is single-use, so a retry of this callback can't
        // succeed — clear the stash and send the user back to try again cleanly.
        clearPendingConnect(state);
        if (!alive.current) return;
        setPhase("error");
        setMessage(
          err instanceof Error && err.message ? err.message : "Couldn't finish the connection.",
        );
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
            <Button onClick={() => router.replace(returnTo ?? "/home")}>Back to Integrations</Button>
          </div>
        )}
      </div>
    </div>
  );
}
