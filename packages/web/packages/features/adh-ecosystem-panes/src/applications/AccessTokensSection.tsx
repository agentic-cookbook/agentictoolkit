"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@agentic-toolkit/ui/components/button";
import { Disclosure } from "@agentic-toolkit/ui/components/disclosure";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { applicationsPrototypeApi, type AccessToken } from "../api/applications-prototype";
import { RecordApiButton } from "@agentic-toolkit/api-explorer";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";

/**
 * Access tokens for an application — backed by the real
 * /ecosystem/applications/:appId/tokens API. Creating a token reveals the full
 * secret exactly once; the list is fetched on demand and refreshed after each
 * change, independent of the unsaved field edits.
 */
export function AccessTokensSection({ appId }: { appId: string }) {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTokens(await applicationsPrototypeApi.listTokens(appId));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "access-tokens", step: "load" });
      setError(err instanceof Error ? err.message : "Failed to load tokens.");
    }
  }, [appId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { secret } = await applicationsPrototypeApi.createToken(appId, name);
      setRevealed(secret);
      setName("");
      setCreating(false);
      await load();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "access-tokens", step: "save" });
      setError(err instanceof Error ? err.message : "Failed to create token.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string, tokenName: string) {
    if (!confirm(`Revoke token "${tokenName}"? Applications using it will lose access.`)) return;
    try {
      await applicationsPrototypeApi.revokeToken(appId, tokenId);
      await load();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "access-tokens", step: "delete" });
      setError(err instanceof Error ? err.message : "Failed to revoke token.");
    }
  }

  return (
    <Disclosure
      title="Access tokens"
      subtitle={`${tokens.length} token${tokens.length === 1 ? "" : "s"}`}
      actions={
        <div className="flex items-center gap-2">
          <RecordApiButton
            path="/ecosystem/applications/{appId}/tokens"
            pathValues={{ appId }}
            title="Access tokens API"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus data-icon="inline-start" />
            New token
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {revealed && (
          <div className="rounded-md border border-apt-gold/40 bg-apt-gold/10 p-3">
            <p className="mb-2 text-xs text-apt-text-muted">
              Copy this token now — you won&apos;t be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={revealed} onFocus={(e) => e.currentTarget.select()} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(revealed)}
              >
                Copy
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed(null)}>
                Done
              </Button>
            </div>
          </div>
        )}

        {creating && (
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={`tok-name-${appId}`}>Token name</Label>
              <Input
                id={`tok-name-${appId}`}
                value={name}
                placeholder="CI deploy"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="button" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-apt-red">{error}</p>}

        {tokens.length === 0 ? (
          <p className="text-sm text-apt-text-muted">No tokens yet.</p>
        ) : (
          <List>
            {tokens.map((t) => (
              <ListItem key={t.id} className="justify-between bg-apt-bg py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-apt-text">{t.name}</span>
                  <span className="truncate text-xs text-apt-text-muted">
                    <code>{t.prefix}…</code>
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => revoke(t.id, t.name)}
                  title="Revoke token"
                >
                  <Trash2 className="text-apt-red" />
                </Button>
              </ListItem>
            ))}
          </List>
        )}
      </div>
    </Disclosure>
  );
}
