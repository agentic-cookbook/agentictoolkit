"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { tokensApi, type ApiToken, type ApiTokenCreated } from "@agentic-toolkit/data/security";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { CreateResourceDialog, useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";

import { RevealedSecret, TokenFact, TokenFacts, whenOr } from "./token-detail";

/** The create form's draft. An ARRAY of picked prefixes rather than a Set: the shared create
 *  dialog decides "dirty" by `JSON.stringify`, which serialises every Set as `{}`. */
interface ApiTokenDraft {
  name: string;
  picked: string[];
  readOnly: boolean;
}

const SCOPE_CATALOGUE_UNAVAILABLE =
  "Couldn’t load the scope catalogue. Token creation is disabled until it loads — otherwise an " +
  "empty selection would silently mint a broad legacy token instead of the scoped one you intended.";

/**
 * The API tokens topic: the `tmp_` personal API tokens (auth.api_tokens), PUBLISHED as a rail
 * level of token rows whose leaf is one token's detail. Creation is the level's `+` → the shared
 * modal (the HTD recipe's `must-create-in-modal`), which is also the only place the raw secret is
 * ever produced; it is then revealed once, in the new token's own detail.
 *
 * There is no editor: the backend has no update route for a token, so a row's detail is its facts
 * plus Revoke. That is a property of the resource, not an omission — a token's scope is fixed at
 * mint precisely so a credential's reach cannot be widened behind its holder's back.
 */
export function ApiTokensSection({ leaf }: { leaf?: TopicLeaf }) {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  // The one-time reveal, kept WITH the id it belongs to so it can only ever render inside that
  // token's detail (see RevealedSecret).
  const [minted, setMinted] = useState<{ id: string; secret: string } | null>(null);

  const tokensQuery = useQuery({ queryKey: ["api-tokens"], queryFn: tokensApi.list });
  // Fetched at the SECTION, not inside the modal: it gates whether the modal may save at all, and
  // a query that mounts with the dialog would make that gate flicker open on every re-open.
  const scopesQuery = useQuery({ queryKey: ["api-token-scopes"], queryFn: tokensApi.scopes });

  const tokens: ApiToken[] = tokensQuery.data ?? [];
  const prefixes: string[] = scopesQuery.data ?? [];
  const selected = leaf?.leafId ? tokens.find((t) => t.id === leaf.leafId) ?? null : null;

  const revokeMutation = useMutation({
    mutationFn: tokensApi.revoke,
    onSuccess: async () => {
      // The row is gone, so the URL must stop naming it before the list refetches — otherwise the
      // leaf points at an id the level no longer publishes.
      leaf?.onSelect(null);
      await qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const rows: TopicDetailItem[] = tokens.map((t) => ({
    id: t.id,
    label: t.name,
    sublabel: `${t.prefix}… · ${t.scope?.length ? t.scope.join(", ") : "legacy"}`,
    icon: <KeyRound size={16} aria-hidden />,
  }));

  const level: TopicLevel = {
    id: "api-tokens-list",
    title: "API tokens",
    items: rows,
    selectedId: leaf?.leafId ?? null,
    onSelect: (id) => leaf?.onSelect(id),
    onClear: () => leaf?.onSelect(null),
    emptyLabel: tokensQuery.isPending ? "Loading…" : "No API tokens yet.",
    onNew: () => setNewOpen(true),
    newLabel: "New API token",
    itemNoun: "API token",
    overviewHelp:
      "A personal API token acts as YOU across the REST paths you scope it to — the credential an " +
      "agent or external tool carries on your behalf.",
  };
  useStackLevel(level);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-8">
        {tokensQuery.isError && <ErrorText error="Couldn’t load your API tokens. Please refresh." />}
        {revokeMutation.isError && <ErrorText error="Couldn’t revoke that token. Please try again." />}

        {/* Nothing selected needs no branch here: while this list is the frontier with no
            selection, the frame hides these children and shows its own select nudge, worded from
            `itemNoun` + `overviewHelp` above — so the invitation is written once. */}
        {selected && (
          <div className="flex max-w-2xl flex-col gap-6">
            {minted !== null && minted.id === selected.id && (
              <RevealedSecret secret={minted.secret} />
            )}
            <TokenFacts>
              <TokenFact label="Name" value={selected.name} />
              <TokenFact label="Prefix" value={`${selected.prefix}…`} mono />
              <TokenFact
                label="Scope"
                value={
                  selected.scope?.length ? (
                    <span className="flex flex-col gap-0.5">
                      {selected.scope.map((s) => (
                        <code key={s} className="font-mono">
                          {s}
                        </code>
                      ))}
                    </span>
                  ) : (
                    "legacy (curated-only)"
                  )
                }
              />
              <TokenFact label="Created" value={whenOr(selected.createdAt, "—")} />
              <TokenFact label="Last used" value={whenOr(selected.lastUsedAt, "never used")} />
              <TokenFact label="Expires" value={whenOr(selected.expiresAt, "never")} />
            </TokenFacts>
            <Button
              size="sm"
              variant="destructive-ghost"
              className="self-start"
              onClick={() => revokeMutation.mutate(selected.id)}
              disabled={revokeMutation.isPending}
            >
              Revoke
            </Button>
          </div>
        )}
      </section>

      {newOpen && (
        <CreateResourceDialog<ApiTokenDraft, ApiTokenCreated>
          ariaLabel="New API token"
          heading="New API token"
          blank={() => ({ name: "", picked: [], readOnly: false })}
          validate={(d) => {
            if (scopesQuery.isError) return SCOPE_CATALOGUE_UNAVAILABLE;
            if (scopesQuery.isPending) return "The scope catalogue is still loading.";
            return d.name.trim() ? null : "Name the token.";
          }}
          // Save stays dark until the catalogue is in hand, for the reason the message above
          // states: an empty selection is a legal input meaning "legacy, curated-only", so a
          // catalogue that never arrived would mint a BROADER token than the operator chose.
          saveEnabled={(d) => d.name.trim().length > 0 && scopesQuery.isSuccess}
          create={async (d) => {
            const scope = d.picked.map((p) => (d.readOnly ? `${p}:read` : p));
            return tokensApi.mint({
              name: d.name.trim(),
              scope: scope.length ? scope : undefined,
            });
          }}
          onClose={() => setNewOpen(false)}
          onCreated={(created) => {
            setNewOpen(false);
            setMinted({ id: created.id, secret: created.token });
            void qc.invalidateQueries({ queryKey: ["api-tokens"] });
            leaf?.onSelect(created.id);
          }}
          renderForm={(draft, onChange, error) => (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="tok-name">Name</Label>
                <Input
                  id="tok-name"
                  value={draft.name}
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                  placeholder="e.g. research-agent"
                />
              </div>

              {scopesQuery.isPending && (
                <p className="text-sm text-apt-text-muted">Loading scopes…</p>
              )}

              {scopesQuery.isError && (
                <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  <p className="text-destructive">{SCOPE_CATALOGUE_UNAVAILABLE}</p>
                  <Button variant="outline" size="sm" onClick={() => void scopesQuery.refetch()}>
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
                          checked={draft.picked.includes(prefix)}
                          onCheckedChange={() =>
                            onChange({
                              ...draft,
                              picked: draft.picked.includes(prefix)
                                ? draft.picked.filter((p) => p !== prefix)
                                : [...draft.picked, prefix],
                            })
                          }
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
                  checked={draft.readOnly}
                  onCheckedChange={(v) => onChange({ ...draft, readOnly: v === true })}
                />
                Read-only (GET/HEAD only)
              </label>

              <ErrorText error={error} />
            </div>
          )}
        />
      )}
    </div>
  );
}
