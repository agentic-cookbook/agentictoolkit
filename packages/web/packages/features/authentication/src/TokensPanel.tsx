"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { tokensApi, type ApiToken } from "@agentic-toolkit/data/security";

/**
 * API tokens panel: create (with scope + read-only flag), list, and revoke
 * personal API tokens. Token value is shown once on creation only.
 */
export function TokensPanel(): ReactElement {
  const qc = useQueryClient();

  // ── UI-only state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [readOnly, setReadOnly] = useState(false);
  const [minted, setMinted] = useState<string | null>(null);

  // ── Server state ───────────────────────────────────────────────────────────
  const tokensQuery = useQuery({
    queryKey: ["api-tokens"],
    queryFn: tokensApi.list,
  });

  const scopesQuery = useQuery({
    queryKey: ["api-token-scopes"],
    queryFn: tokensApi.scopes,
  });

  const tokens: ApiToken[] = tokensQuery.data ?? [];
  const prefixes: string[] = scopesQuery.data ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const mintMutation = useMutation({
    mutationFn: tokensApi.mint,
    onSuccess: (created) => {
      setMinted(created.token);
      setName("");
      setPicked(new Set());
      setReadOnly(false);
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: tokensApi.revoke,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  function toggle(prefix: string): void {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }

  function mint(): void {
    const scope = [...picked].map((p) => (readOnly ? `${p}:read` : p));
    mintMutation.mutate({
      name,
      scope: scope.length ? scope : undefined,
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h3 className="text-lg font-medium">Create an API token</h3>

              <div className="space-y-2">
                <Label htmlFor="tok-name">Name</Label>
                <Input
                  id="tok-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. research-agent"
                />
              </div>

              {scopesQuery.isPending && (
                <p className="text-sm text-muted-foreground">Loading scopes…</p>
              )}

              {scopesQuery.isError && (
                <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  <p className="text-destructive">
                    Couldn’t load the scope catalogue. Token creation is disabled
                    until it loads — otherwise an empty selection would silently mint
                    a broad legacy token instead of the scoped one you intended.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scopesQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {scopesQuery.isSuccess && prefixes.length > 0 && (
                <div className="space-y-2">
                  <Label>Scope (leave empty for legacy curated-only access)</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {prefixes.map((prefix) => (
                      <label
                        key={prefix}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={picked.has(prefix)}
                          onCheckedChange={() => toggle(prefix)}
                        />
                        <span className="font-mono">{prefix}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label
                htmlFor="api-token-read-only"
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  id="api-token-read-only"
                  checked={readOnly}
                  onCheckedChange={(v) => setReadOnly(v === true)}
                />
                Read-only (GET/HEAD only)
              </label>

              <Button
                onClick={mint}
                disabled={
                  mintMutation.isPending ||
                  !name.trim() ||
                  scopesQuery.isPending ||
                  scopesQuery.isError
                }
              >
                Create token
              </Button>

              {mintMutation.isError && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Couldn’t create the token. Please try again.
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
              {tokens.length === 0 && (
                <p className="text-sm text-muted-foreground">No tokens yet.</p>
              )}
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-b-0"
                >
                  <span>
                    <span className="font-medium">{t.name}</span>
                    {" · "}
                    <code className="font-mono">{t.prefix}…</code>
                    {" · "}
                    {t.scope?.join(", ") ?? "legacy"}
                  </span>
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
