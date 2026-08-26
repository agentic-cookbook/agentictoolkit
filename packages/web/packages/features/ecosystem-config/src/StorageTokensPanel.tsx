"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { RdidEditor } from "@agentic-toolkit/adh-ui/components/rdid-editor";
import { validateLeaf } from "@agentic-toolkit/adh-ui/rdid";
import { tokenPrincipalsApi, type TokenPrincipal } from "@agentic-toolkit/data/ecosystem-config";
import { isConflict } from "@agentic-toolkit/data";
import { useReportBusy, useReportSettingsDirty } from "@agentic-toolkit/resource";

/**
 * Tokens feature: mint / list / revoke owner-decoupled STORAGE-access token
 * principals (the `adh_…` secrets). Each token gets its own isolated bucket,
 * shown but not editable (bucket composition is out of scope). The raw secret
 * is shown once on creation. Distinct from the personal API-token panel in
 * settings (that mints `tmp_` API tokens); this mints `adh_` storage principals.
 *
 * `ecosystemId` (optional) scopes the panel to one product: the list shows only
 * tokens whose bucket lives in that ecosystem, and a mint binds the new token's
 * bucket to it. Omitted (the workspace-rail Tokens feature), the panel spans all
 * the owner's tokens and mints into the owner's default ecosystem.
 *
 * `workspace` (optional) pins every op to the WORKSPACE'S owning principal
 * (backend `?workspace=`), so an org workspace lists/mints/revokes the ORG'S
 * tokens (`token.<org-slug>.<name>`, bucket in the org's own ecosystem) rather
 * than the signed-in user's personal ones.
 */
// Named `StorageTokensPanel`, not `TokensPanel`: these are the owner-decoupled STORAGE-access
// token principals (`adh_…`, each with its own isolated bucket). The personal API tokens the
// user-settings panel mints (`tmp_…`, @agentic-toolkit/authentication's TokensPanel) are a
// different principal that happens to share the noun.
export function StorageTokensPanel({
  ecosystemId,
  workspace,
}: { ecosystemId?: string; workspace?: string } = {}): ReactElement {
  const qc = useQueryClient();

  const [leaf, setLeaf] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState(""); // datetime-local; "" = no expiry
  const [minted, setMinted] = useState<string | null>(null);

  // Keyed by scope; mutations prefix-invalidate ["token-principals"], so the scoped and
  // unscoped variants refresh together.
  const tokensQuery = useQuery({
    queryKey: ["token-principals", ecosystemId ?? "all", workspace ?? "self"],
    queryFn: () => tokenPrincipalsApi.list({ ecosystemId, workspace }),
  });
  const tokens: TokenPrincipal[] = tokensQuery.data ?? [];

  // The load is invisible here in a way the other panes' is not: an unfinished read has no rows, and
  // no-rows-yet is drawn as "No tokens yet." below — a wrong answer, not a pending one. Reporting
  // upward puts the spinner on the Configuration list that published this pane, which is the only
  // surface saying anything at all while the request is open.
  useReportBusy(tokensQuery.isFetching);

  const mintMutation = useMutation({
    mutationFn: (body: Parameters<typeof tokenPrincipalsApi.mint>[0]) =>
      tokenPrincipalsApi.mint(body, { workspace }),
    onSuccess: (created) => {
      setMinted(created.token);
      setLeaf("");
      setDescription("");
      setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["token-principals"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => tokenPrincipalsApi.revoke(id, { workspace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["token-principals"] }),
  });

  const leafError = leaf ? validateLeaf(leaf) : null;

  // The mint form's baseline is empty and `onSuccess` clears it, so the diff against it is just
  // "fields still hold what was typed" — a name that had to pass `validateLeaf`, a description and
  // an expiry the operator chose. Keyed by the scope pair the list query already keys on: the
  // workspace-rail panel and a product's Tokens topic are different forms that can hold different
  // drafts, and one key would let either withdraw the other's report.
  // `minted` is excluded on purpose — it is a revealed secret, not an edit, and a guard on it
  // would prompt after a mint that already succeeded.
  const mintDirty = leaf.trim() !== "" || description.trim() !== "" || expiresAt !== "";
  useReportSettingsDirty(`tokens-mint:${workspace ?? "self"}:${ecosystemId ?? "all"}`, mintDirty);

  // Editing the name after a reveal hides the prior secret (it is shown ONCE); a stale secret next
  // to a fresh attempt would misattribute it.
  function changeLeaf(next: string): void {
    setLeaf(next);
    if (minted) setMinted(null);
  }

  function mint(): void {
    // Clear any prior reveal BEFORE mutating, so a failed re-mint never leaves the previous token's
    // live secret on screen next to the new error.
    setMinted(null);
    // Guard an unparseable datetime-local value: new Date("").toISOString() throws RangeError.
    let expiresAtIso: string | undefined;
    if (expiresAt) {
      const d = new Date(expiresAt);
      expiresAtIso = Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    mintMutation.mutate({
      name: leaf,
      description: description.trim() || undefined,
      expiresAt: expiresAtIso,
      ecosystemId,
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h3 className="text-lg font-medium">Create a token</h3>

              <RdidEditor
                label="Name"
                prefix="token."
                value={leaf}
                placeholder="ci-sync"
                hint={
                  ecosystemId
                    ? "A storage principal scoped to your account; its own empty bucket lives in this product's ecosystem."
                    : "A storage principal scoped to your account; it gets its own empty bucket."
                }
                error={leafError ?? undefined}
                onChange={changeLeaf}
              />

              <div className="space-y-2">
                <Label htmlFor="tok-desc">Description (optional)</Label>
                <Input
                  id="tok-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this token is for"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tok-exp">Expires (optional)</Label>
                <Input
                  id="tok-exp"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <Button
                onClick={mint}
                disabled={mintMutation.isPending || !leaf.trim() || !!leafError}
              >
                Create token
              </Button>

              {mintMutation.isError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {isConflict(mintMutation.error)
                    ? "That name is already in use. Token names stay reserved even after revoke — pick a different one."
                    : "Couldn’t create the token. Please try again."}
                </p>
              )}

              {minted && (
                <p className="break-all rounded-md bg-muted p-3 text-sm">
                  Copy now — shown once:{" "}
                  <code className="font-mono">{minted}</code>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              <h3 className="text-lg font-medium">Your tokens</h3>
              {tokensQuery.isError ? (
                <ErrorText error="Couldn’t load your tokens. Please refresh." />
              ) : (
                tokens.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tokens yet.</p>
                )
              )}
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-b-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate">
                      <code className="font-mono">{t.rdid}</code>
                      {" · "}
                      <code className="font-mono">{t.prefix}…</code>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      bucket <code className="font-mono">{t.bucketRdid}</code>
                      {" · "}
                      {t.lastUsedAt
                        ? `last used ${new Date(t.lastUsedAt).toLocaleString()}`
                        : "never used"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(t.id)}
                    disabled={revokeMutation.isPending}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
