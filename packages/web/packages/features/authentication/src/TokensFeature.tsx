"use client";

import { HardDrive, KeyRound } from "lucide-react";

import {
  RailHostBoundary,
  StackGroupDetail,
  useBasePathRoute,
  type TopicLeaf,
} from "@agentic-toolkit/resource";

import { ApiTokensSection } from "./ApiTokensSection";
import { StorageTokensSection } from "./StorageTokensSection";
import type { TokenSection } from "./parse-path";

/**
 * The Tokens feature as a hierarchical topic/detail view: a root rail naming the two token
 * FAMILIES, each of which publishes its own token list as the next rail, whose leaf is one
 * token's detail.
 *
 *     Tokens ▸ API tokens ▸ research-agent
 *     Tokens ▸ Storage tokens ▸ ci-sync
 *
 * The split is by PRINCIPAL, not by presentation. An `tmp_` API token acts as the signed-in user
 * across the REST paths it is scoped to; an `adh_` storage token is its own principal, owned by
 * the workspace, reaching nothing but the bucket minted with it. Two things that share the noun
 * "token" and nothing else should not share one flat list, which is what this replaces.
 *
 * Both levels are deep-linkable off `basePath` — the host route supplies it (`/home` on this
 * feature's own site), never derived here, so the same feature can mount under another scheme.
 */
export function TokensFeature({
  basePath,
  section,
  tokenId,
  workspaceSlug,
}: {
  /** The feature's URL base; every push is `<basePath>/<section>[/<tokenId>]`. */
  basePath: string;
  /** The open family, or undefined for the bare topic list. */
  section?: TokenSection;
  /** The selected token within that family, or undefined for none. */
  tokenId?: string;
  /** Pins the STORAGE topic to that workspace's owning principal, so an org workspace shows the
   *  org's tokens. Deliberately not threaded into API tokens: those are always the caller's own —
   *  the backend has no workspace dimension for them — so a chooser that appeared to scope them
   *  would be claiming a filter that does not exist. */
  workspaceSlug?: string;
}) {
  const { pushSegment, pushNested } = useBasePathRoute(basePath);

  // The row leaf, scoped to whichever family is open — only the active member renders, so one leaf
  // serves both. `null` clears just the token segment, leaving the family open.
  const leaf: TopicLeaf = {
    leafId: tokenId ?? null,
    onSelect: (id) => pushNested(section, id),
  };

  return (
    <RailHostBoundary>
      <StackGroupDetail
        levelId="token-sections"
        title="Tokens"
        // The two-kind split IS the thing to explain, so it is said in the frontier nudge the
        // frame actually renders while nothing is selected — not as per-member `description`s,
        // which only a `overview: "cards"` level draws (this one is not) and which would have
        // rendered nowhere.
        itemNoun="token kind"
        overviewHelp={
          "An API token (tmp_) is personal — it acts as YOU across the REST paths you scope it " +
          "to. A storage token (adh_) is a principal of its own, reaching the one isolated bucket " +
          "minted with it and nothing else."
        }
        urlSelection={{ selectedId: section ?? null, onSelect: pushSegment }}
        items={[
          {
            id: "api",
            label: "API tokens",
            icon: <KeyRound size={16} aria-hidden />,
            // Both members publish a deeper rail, so choosing one is an INTERMEDIATE select and the
            // cascading view must hold the detail rather than swap it.
            leadsTo: "list",
            render: () => <ApiTokensSection leaf={leaf} />,
          },
          {
            id: "storage",
            label: "Storage tokens",
            icon: <HardDrive size={16} aria-hidden />,
            leadsTo: "list",
            render: () => <StorageTokensSection leaf={leaf} workspace={workspaceSlug} />,
          },
        ]}
      />
    </RailHostBoundary>
  );
}
