"use client";

import { useEffect, useRef, useState } from "react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { integrationsApi } from "@agentic-toolkit/data/integrations";
import { errMsg } from "@agentic-toolkit/data";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";

/** Props for a per-provider sync-settings form: the connection + its STORED settings,
 *  so the form prefills instead of blind-overwriting (the backend PATCH replaces the
 *  whole syncSettings jsonb — a blank re-save would otherwise wipe saved values).
 *  Mirrors ProviderConnections.tsx's (unexported) `SyncSettingsFormProps` — every
 *  per-provider sync-settings form implements this same shape. */
interface SyncSettingsFormProps {
  connectionId: string;
  initial: Record<string, unknown>;
}

/** The string members of a stored settings array (tolerates non-array garbage).
 *  Mirrors ProviderConnections.tsx's `strArray` helper. */
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

/**
 * Mailchimp per-connection audience opt-in: which PROVIDER audience/list ids to sync
 * CONTACTS for. The audience ROSTER itself always syncs regardless of this setting — this
 * narrows which audiences' CONTACTS also get pulled in, following the Gmail/Reddit forms'
 * narrows-never-widens contract (a cleared/blank value means "roster only", never "every
 * contact in the account").
 */
export function AudienceSyncSettings({ connectionId, initial }: SyncSettingsFormProps) {
  const [audienceIds, setAudienceIds] = useState(() => strArray(initial.audienceIds).join(", "));
  // The stored baseline this form was prefilled from — re-set to the just-saved input on a
  // successful save, so Save goes disabled again until the next edit rather than staying
  // clickable for a no-op re-save of what's already persisted.
  const [baselineAudienceIds, setBaselineAudienceIds] = useState(audienceIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const dirty = audienceIds !== baselineAudienceIds;
  const canSave = dirty;

  // This form saves straight through `patchSettings` — it is nowhere in IntegrationsPane's form
  // state, so nothing else knows the draft exists. Report it, and every exit the pane can't see
  // (reload, a link click, a rail row switch) asks before throwing it away. Keyed per connection:
  // one of these renders per connected account.
  useReportSettingsDirty(`integration-sync-mailchimp-${connectionId}`, dirty);

  const audienceIdsId = `mailchimp-audience-ids-${connectionId}`;

  async function onSave() {
    const ids = audienceIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // The PATCH replaces the whole syncSettings jsonb, and the form is prefilled from the
      // stored values — so the form state IS the full intended settings. Sent unconditionally
      // (even empty) so clearing the field explicitly clears the stored opt-in, mirroring
      // RedditSyncSettings — an empty list here is a deliberate, valid "roster only" state,
      // not a sentinel for "leave the worker default alone" the way Gmail's fields are.
      await integrationsApi.patchSettings(connectionId, { audienceIds: ids });
      if (alive.current) {
        setSaved(true);
        setBaselineAudienceIds(audienceIds);
      }
    } catch (err) {
      reportUnexpectedAuthError(err, {
        feature: "integration-connections",
        step: "mailchimp-audience-settings",
      });
      if (alive.current) setError(errMsg(err, "Couldn't save sync settings."));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={audienceIdsId}>Audience ids</Label>
        <Input
          id={audienceIdsId}
          value={audienceIds}
          placeholder="a1b2c3d4e5"
          onChange={(e) => {
            setAudienceIds(e.target.value);
            setSaved(false);
          }}
        />
        <p className="text-xs text-apt-text-muted">
          Leave empty to sync only the audience list. Add audience IDs to also sync their
          contacts.
        </p>
      </div>
      {error && <p className="text-sm text-apt-red">{error}</p>}
      {saved && <p className="text-sm text-apt-green">Sync settings saved.</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy || !canSave}>
          {busy ? "Saving…" : "Save sync settings"}
        </Button>
      </div>
    </form>
  );
}
