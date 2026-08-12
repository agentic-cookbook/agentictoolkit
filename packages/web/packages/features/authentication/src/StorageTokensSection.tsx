"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isConflict } from "@agentic-toolkit/data";
import {
  tokenPrincipalsApi,
  type TokenPrincipal,
  type TokenPrincipalCreated,
} from "@agentic-toolkit/data/ecosystem-config";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { RdidEditor } from "@agentic-toolkit/ui/components/rdid-editor";
import { validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { CreateResourceDialog, useStackLevel, type TopicLeaf } from "@agentic-toolkit/resource";

import {
  isMissingToken,
  MissingToken,
  RevealedSecret,
  TokenFact,
  TokenFacts,
  useMintedSecret,
  whenOr,
} from "./token-detail";

interface StorageTokenDraft {
  /** The rdid LEAF only — the server composes `token.<owner>.<leaf>`. */
  name: string;
  description: string;
  /** A `datetime-local` value; "" means no expiry. */
  expiresAt: string;
}

const NAME_TAKEN =
  "That name is already in use. Token names stay reserved even after revoke — pick a different one.";

/**
 * The Storage tokens topic: the `adh_…` storage-access token PRINCIPALS (auth.tokens), each an
 * owner-decoupled principal with its own isolated bucket. Published as a rail level of rows whose
 * leaf is one principal's detail.
 *
 * `workspace` pins every op to that workspace's owning principal (backend `?workspace=`), so an
 * org workspace lists, mints and revokes the ORG'S tokens rather than the signed-in user's — the
 * one place this feature's two topics differ, since a `tmp_` API token is always personal.
 *
 * The mint form deliberately mirrors ecosystem-config's `StorageTokensPanel` (the org
 * Configuration ▸ Tokens surface) field for field and word for word: the same principal minted by
 * two entry points must ask the same questions and make the same promises. Change one, change the
 * other. They are not shared, because that panel is a flat card that publishes no rail level; the
 * duplicated knowledge is the COPY, and it is kept identical rather than paraphrased.
 */
export function StorageTokensSection({
  leaf,
  workspace,
}: {
  leaf?: TopicLeaf;
  /** The workspace slug whose principal owns these tokens. */
  workspace?: string;
}) {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  // Held OUTSIDE component state, because minting navigates and a navigation remounts this subtree
  // (see useMintedSecret). Keyed by workspace as well as surface: the same rail mints for a
  // different owner under `?workspace=`, and one owner's secret must not survive into the other's.
  const { minted, remember, forget } = useMintedSecret(`storage-tokens:${workspace ?? "self"}`);

  // Keyed by scope; mutations prefix-invalidate ["token-principals"], so the scoped and unscoped
  // variants (this rail and the org Configuration panel) refresh together.
  const tokensQuery = useQuery({
    queryKey: ["token-principals", "all", workspace ?? "self"],
    queryFn: () => tokenPrincipalsApi.list({ workspace }),
  });

  const tokens: TokenPrincipal[] = tokensQuery.data ?? [];
  const selected = leaf?.leafId ? tokens.find((t) => t.id === leaf.leafId) ?? null : null;

  const revokeMutation = useMutation({
    mutationFn: (id: string) => tokenPrincipalsApi.revoke(id, { workspace }),
    onSuccess: async () => {
      // Drop any held secret with the row it belonged to — the store outlives this component.
      forget();
      leaf?.onSelect(null);
      await qc.invalidateQueries({ queryKey: ["token-principals"] });
    },
  });

  const rows: TopicDetailItem[] = tokens.map((t) => ({
    id: t.id,
    label: t.slug,
    sublabel: `${t.prefix}… · ${t.bucketRdid ?? "no bucket"}`,
    icon: <Database size={16} aria-hidden />,
  }));

  const level: TopicLevel = {
    id: "storage-tokens-list",
    title: "Storage tokens",
    items: rows,
    selectedId: leaf?.leafId ?? null,
    onSelect: (id) => leaf?.onSelect(id),
    onClear: () => leaf?.onSelect(null),
    // See ApiTokensSection: a failed load is not an empty account, and saying so invites a duplicate.
    emptyLabel: tokensQuery.isPending
      ? "Loading…"
      : tokensQuery.isError
        ? "Couldn’t load these tokens."
        : "No tokens yet.",
    onNew: () => setNewOpen(true),
    newLabel: "New storage token",
    itemNoun: "storage token",
    overviewHelp:
      "A storage token is its own principal — not you — and reaches nothing but the isolated " +
      "bucket minted with it.",
  };
  useStackLevel(level);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-8">
        {tokensQuery.isError && <ErrorText error="Couldn’t load your tokens. Please refresh." />}
        {revokeMutation.isError && (
          <ErrorText error="Couldn’t revoke that token. Please try again." />
        )}

        {/* See ApiTokensSection: gated on the id the URL names, not on a row from the list, so the
            reveal is not withheld by the refetch the mint itself started. */}
        {minted !== null && minted.id === leaf?.leafId && (
          <div className="max-w-2xl">
            <RevealedSecret secret={minted.secret} />
          </div>
        )}

        {isMissingToken({
          leafId: leaf?.leafId,
          found: Boolean(selected),
          isFetching: tokensQuery.isFetching,
          isError: tokensQuery.isError,
          mintedId: minted?.id,
        }) && <MissingToken noun="storage token" />}

        {/* See ApiTokensSection: the unselected state is the frame's own nudge, not ours. */}
        {selected && (
          <div className="flex max-w-2xl flex-col gap-6">
            <TokenFacts>
              <TokenFact label="Name" value={selected.slug} />
              <TokenFact label="Identifier" value={selected.rdid} mono />
              <TokenFact label="Prefix" value={`${selected.prefix}…`} mono />
              <TokenFact label="Bucket" value={selected.bucketRdid} mono />
              <TokenFact label="Description" value={selected.description} />
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
        <CreateResourceDialog<StorageTokenDraft, TokenPrincipalCreated>
          ariaLabel="New storage token"
          heading="New storage token"
          blank={() => ({ name: "", description: "", expiresAt: "" })}
          validate={(d) => {
            if (!d.name.trim()) return "Name the token.";
            return validateLeaf(d.name);
          }}
          saveEnabled={(d) => d.name.trim().length > 0 && validateLeaf(d.name) === null}
          create={async (d) => {
            // Guard an unparseable datetime-local value: new Date("").toISOString() throws.
            let expiresAtIso: string | undefined;
            if (d.expiresAt) {
              const parsed = new Date(d.expiresAt);
              expiresAtIso = Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
            }
            try {
              return await tokenPrincipalsApi.mint(
                {
                  name: d.name,
                  description: d.description.trim() || undefined,
                  expiresAt: expiresAtIso,
                },
                { workspace },
              );
            } catch (err) {
              // The dialog shows a thrown Error's `message` inline, so a 409 has to arrive already
              // worded — otherwise the operator reads the transport's phrasing and never learns
              // that revoking the old token will not free the name.
              if (isConflict(err)) throw new Error(NAME_TAKEN);
              throw err;
            }
          }}
          onClose={() => setNewOpen(false)}
          onCreated={(created) => {
            setNewOpen(false);
            remember({ id: created.id, secret: created.token });
            void qc.invalidateQueries({ queryKey: ["token-principals"] });
            leaf?.onSelect(created.id);
          }}
          renderForm={(draft, onChange, error) => (
            <div className="flex flex-col gap-4">
              <RdidEditor
                label="Name"
                prefix="token."
                value={draft.name}
                placeholder="ci-sync"
                hint="A storage principal scoped to your account; it gets its own empty bucket."
                error={(draft.name ? validateLeaf(draft.name) : null) ?? undefined}
                onChange={(next) => onChange({ ...draft, name: next })}
              />

              <div className="space-y-2">
                <Label htmlFor="tok-desc">Description (optional)</Label>
                <Input
                  id="tok-desc"
                  value={draft.description}
                  onChange={(e) => onChange({ ...draft, description: e.target.value })}
                  placeholder="What this token is for"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tok-exp">Expires (optional)</Label>
                <Input
                  id="tok-exp"
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(e) => onChange({ ...draft, expiresAt: e.target.value })}
                />
              </div>

              <ErrorText error={error} />
            </div>
          )}
        />
      )}
    </div>
  );
}
