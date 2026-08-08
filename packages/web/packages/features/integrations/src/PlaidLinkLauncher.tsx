"use client";

import { useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

/**
 * Opens Plaid Link for an already-minted link token and reports the outcome.
 *
 * A separate component (not inline in ConnectAccountDialog) because `usePlaidLink`
 * is a hook: the dialog branches over five auth methods, so the hook must live in a
 * component that only mounts on the plaid_link path — mounting IS the launch gate.
 * Link auto-opens as soon as its script is ready; the parent unmounts this on
 * success/exit, which tears the Link handler down cleanly.
 */
export function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  /** Called with the public_token to exchange via POST /integrations/connect. */
  onSuccess: (publicToken: string) => void;
  /** Called when the user abandons Link (or Link errors) — parent re-enables retry. */
  onExit: (message: string | null) => void;
}) {
  const { open, ready, error } = usePlaidLink({
    token,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: (err) => onExit(err ? (err.display_message ?? err.error_message) : null),
  });

  // Auto-open once the Link script is ready: the user already clicked "Connect with
  // Plaid" to mint the token, so a second click would be pure friction.
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  // Script-load failure (offline, CSP) never fires onExit — surface it explicitly.
  useEffect(() => {
    if (error) onExit(error.message);
  }, [error, onExit]);

  return (
    <p className="text-sm text-apt-text-muted" role="status">
      {ready ? "Plaid Link is open — finish connecting there." : "Loading Plaid Link…"}
    </p>
  );
}
