"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { useResourceItemQuery, useResourceItemWriter } from "@agentic-toolkit/data";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { confirmNavigation } from "@agentic-toolkit/ui/lib/navigation-guard";
import { ecosystemsApi, type AuthSettings, type SignupMode } from "@agentic-toolkit/data/ecosystems";
import { EditActionBar, useReportBusy, useReportSettingsDirty } from "@agentic-toolkit/resource";

/**
 * The ecosystem's explicit AUTH POLICY pane — the conceptual "Auth settings" home for a
 * developer's vended customer realm. Reads/writes the bespoke /ecosystem/auth-settings
 * route (ecosystem.auth_settings): sign-up mode (open / invite-only / closed) and whether
 * sign-in is allowed. A single-record pane (local edit state + the shared EditActionBar),
 * NOT the list-based master/detail used by AccessPane/IntegrationsPane. `allowedProviders`
 * is not edited here yet (v1 governs mode + login); the route preserves it untouched.
 */

const SIGNUP_MODES: { value: SignupMode; label: string; help: string }[] = [
  { value: "open", label: "Open", help: "Anyone with a supported provider can create an account." },
  { value: "invite_only", label: "Invite only", help: "Only people you've invited can create an account." },
  { value: "closed", label: "Closed", help: "No new accounts can be created." },
];

/**
 * Read one ecosystem's auth policy, reporting the failure under THIS pane's telemetry context
 * rather than the hook's generic one — which is why the call site passes `reportErrors: false`.
 *
 * Module scope, so one identity serves every mount; the ecosystem is the query key's id.
 */
async function loadAuthSettings(ecosystemId: string): Promise<AuthSettings> {
  try {
    return await ecosystemsApi.authSettings(ecosystemId);
  } catch (err) {
    reportUnexpectedAuthError(err, { feature: "auth-settings", step: "load" });
    // A non-Error rejection would otherwise reach the user as the hook's generic wording; keep the
    // sentence this pane has always shown for it.
    throw err instanceof Error ? err : new Error("Failed to load auth settings.");
  }
}

export function AuthPane({
  ecosystemId,
  help,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Cached per ecosystem, so returning to this topic paints the saved policy on the first frame
  // and revalidates behind it instead of blanking to "Loading…" on every visit.
  //
  // Unsaved edits survive that revalidation for free: `edits` below is a DELTA laid over whatever
  // the server currently says, not a copy of it, so a re-read that lands mid-edit changes the
  // values UNDER the user's changes and keeps the changes themselves.
  const {
    item: settings,
    error: loadError,
    isFetching,
  } = useResourceItemQuery<AuthSettings>(
    "ecosystem-auth-settings",
    ecosystemId ?? null,
    loadAuthSettings,
    { reportErrors: false },
  );
  const writeSettings = useResourceItemWriter<AuthSettings>("ecosystem-auth-settings");

  // This pane publishes no topic list of its own, so the read above has nowhere to show itself —
  // it is the Configuration list, one component up, that owns the spinner. Reporting is how the
  // read reaches it. `isFetching` and not `isPending`: on the second visit the policy is already
  // painted (see the comment above) and the pane would otherwise revalidate in silence, which is
  // exactly the visit the spinner exists for.
  useReportBusy(isFetching);

  const [edits, setEdits] = useState<Partial<AuthSettings>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // …but only over the ecosystem they were typed against. `edits` is a DELTA, and this pane is NOT
  // remounted when `ecosystemId` changes — the item hook simply re-keys — so unreset edits would be
  // laid over the NEXT ecosystem's policy and saved onto it. Before caching, the per-ecosystem
  // `refresh` cleared them as part of the load; nothing does now, so the switch is watched here.
  // Adjusted DURING render (React's own idiom for state that must reset on a prop change) rather
  // than in an effect: an effect resets one frame late, and that frame is a live edit surface.
  const [editsFor, setEditsFor] = useState<string | null>(ecosystemId ?? null);
  if (editsFor !== (ecosystemId ?? null)) {
    setEditsFor(ecosystemId ?? null);
    setEdits({});
    setSaveError(null);
    setSaved(false);
  }

  // The values shown = the loaded policy with any unsaved edits laid over it.
  const effective: AuthSettings | null = settings ? { ...settings, ...edits } : null;
  const dirty = Object.keys(edits).length > 0;

  // Report unsaved edits to the overlay so a close can warn before discarding them
  // (a no-op outside a SettingsDirtyProvider) — the same wiring as Account/Profile.
  useReportSettingsDirty("ecosystem-auth", dirty);

  const save = useCallback(async () => {
    if (!ecosystemId || !dirty) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await ecosystemsApi.updateAuthSettings(ecosystemId, edits);
      // The server's own answer, written straight into the cache rather than invalidated: it is
      // already in hand, so a re-read would spend a request to arrive back at these bytes.
      writeSettings(ecosystemId, updated);
      setEdits({});
      setSaved(true);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "auth-settings", step: "save" });
      setSaveError(err instanceof Error ? err.message : "Failed to save auth settings.");
    } finally {
      setSaving(false);
    }
  }, [ecosystemId, dirty, edits, writeSettings]);

  const cancel = useCallback(() => {
    setEdits({});
    setSaveError(null);
    setSaved(false);
  }, []);

  // Invite-only is backed by the existing per-ecosystem invitation subsystem, surfaced
  // under the sibling "Users" topic (id "invitations"): jump there by swapping the trailing
  // topic segment of the current /ecosystems/<id>/auth route.
  //
  // The cross-link is a <button>, not an anchor, so the shared UnsavedChangesGuard never sees
  // the click — route through confirmNavigation() (the same rule as the settings rail rows and
  // the admin shell) so this pane's own unsaved policy edits, or any sibling panel's, get the
  // Discard/Stay prompt instead of vanishing. Nothing dirty ⇒ no guard registered ⇒ immediate.
  const goToUsers = useCallback(async () => {
    if (!pathname) return;
    if (!(await confirmNavigation())) return;
    router.push(pathname.replace(/\/auth(?:\/.*)?$/, "/invitations"));
  }, [pathname, router]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EditActionBar
        dirty={dirty}
        canSave={dirty}
        saving={saving}
        onCancel={cancel}
        onSave={save}
        status={
          saveError ? (
            <span className="text-apt-red">{saveError}</span>
          ) : saved && !dirty ? (
            <span className="text-apt-text-muted">Saved.</span>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-7">
          {help && <p className="text-sm text-apt-text-muted">{help}</p>}
          {loadError && <p className="text-sm text-apt-red">{loadError}</p>}
          {!effective && !loadError && (
            <p className="text-sm text-apt-text-muted">Loading…</p>
          )}

          {effective && (
            <>
              {/* Sign-up mode */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <Label htmlFor="auth-signup-mode" className="text-sm font-medium text-apt-text">
                    Sign-up
                  </Label>
                  <p className="mt-0.5 text-xs text-apt-text-muted">
                    {SIGNUP_MODES.find((m) => m.value === effective.signupMode)?.help}
                  </p>
                </div>
                <Select
                  id="auth-signup-mode"
                  value={effective.signupMode}
                  onChange={(e) => {
                    setSaved(false);
                    setEdits((prev) => ({ ...prev, signupMode: e.target.value as SignupMode }));
                  }}
                >
                  {SIGNUP_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              {effective.signupMode === "invite_only" && (
                <p className="text-xs text-apt-text-muted">
                  People join by invitation.{" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      void goToUsers();
                    }}
                  >
                    Manage invitations in Users →
                  </Button>
                </p>
              )}

              {/* Sign-in enabled */}
              <div className="flex items-start justify-between gap-6 border-t border-apt-border pt-6">
                <div className="min-w-0">
                  <Label htmlFor="auth-login-enabled" className="text-sm font-medium text-apt-text">
                    Allow sign-in
                  </Label>
                  <p className="mt-0.5 text-xs text-apt-text-muted">
                    When off, no one can sign in to this ecosystem.
                  </p>
                </div>
                <Switch
                  id="auth-login-enabled"
                  checked={effective.loginEnabled}
                  onCheckedChange={(loginEnabled) => {
                    setSaved(false);
                    setEdits((prev) => ({ ...prev, loginEnabled }));
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
