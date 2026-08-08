"use client";

import type { ReactElement } from "react";
import { CreditCard, Flag, KeyRound, LogIn, Server } from "lucide-react";
import {
  StackGroupDetail,
  WorkspaceNotManageable,
  WorkspaceResolutionError,
  type GroupTopicItem,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import { useWorkspaceDefaultEcosystemId } from "@agentic-toolkit/data/ecosystems";
import { AuthPane } from "./AuthPane";
import { BillingPane } from "./BillingPane";
import { FeatureFlagsPane } from "./FeatureFlagsPane";
import { ServerBagsPane } from "./ServerBagsPane";
import { SigninAppsPane } from "./SigninAppsPane";
import { StorageTokensPanel } from "./StorageTokensPanel";

/**
 * The Configuration group: a workspace's KNOBS — who can sign in, which flags are on, the keys
 * and tokens it issues, and what it bills — as one grouping pane over six leaf panes.
 *
 * Everything here is scoped to the workspace's DEFAULT ecosystem, which is why the whole group
 * sits behind one gate instead of six: the resolution is a single request, and six panes each
 * discovering the same 403 independently is six chances to word it differently.
 *
 * LLM Providers is deliberately absent even though the hub's Configuration list carries it. That
 * row is USER-scoped (a person's own model providers, identical whichever workspace is open), so
 * it is not this ecosystem's configuration — showing it under an organization would claim the org
 * owns settings it does not.
 */
export function ConfigurationGroup({
  workspaceSlug,
  leaf,
  subLeafFor,
  helpFor,
  title = "Configuration",
}: {
  /** The workspace whose default ecosystem these panes configure. */
  workspaceSlug: string | undefined;
  /** The group's own row selection (`…/configuration/<row>`). */
  leaf?: TopicLeaf;
  /** Builds a row's inner leaf (`…/configuration/<row>/<entity>`), so a sign-in app deep-links. */
  subLeafFor?: (memberId: string) => TopicLeaf;
  /**
   * The host's help-store lookup, keyed by ROUTE (`ecosystems/auth`, …).
   *
   * A SEAM rather than an import: the sentences live in adh's site-config content package, which
   * is the product's vocabulary tier — a portable package that imported it would resolve fine
   * inside adh's workspace and break, or silently ship adh's words, in any other consumer. The
   * keys stay here because they name THESE rows; only the text comes from outside.
   *
   * Optional, and no fallback prose when it is absent: a package-authored sentence would be a
   * second source for text that already has one, and the two would drift.
   */
  helpFor?: (key: string) => string | undefined;
  /** The rail heading. Defaults to the group's own name. */
  title?: string;
}): ReactElement {
  const { ecosystemId, canManage, isError } = useWorkspaceDefaultEcosystemId(workspaceSlug);
  if (isError) return <WorkspaceResolutionError />;
  // A plain org member can view the workspace but not manage its infrastructure ecosystem — every
  // pane's reads and writes would 403 one at a time, so answer once, honestly, up front.
  if (ecosystemId && !canManage) return <WorkspaceNotManageable feature="Configuration" />;

  const items: GroupTopicItem[] = [
    {
      id: "auth",
      label: "Auth",
      icon: <KeyRound size={16} aria-hidden />,
      render: () => <AuthPane ecosystemId={ecosystemId} help={helpFor?.("ecosystems/auth")} />,
    },
    {
      id: "billing",
      label: "Billing",
      icon: <CreditCard size={16} aria-hidden />,
      render: () => <BillingPane ecosystemId={ecosystemId} help={helpFor?.("ecosystems/billing")} />,
    },
    {
      id: "feature-flags",
      label: "Feature flags",
      icon: <Flag size={16} aria-hidden />,
      render: () => (
        <FeatureFlagsPane ecosystemId={ecosystemId} help={helpFor?.("ecosystems/feature-flags")} />
      ),
    },
    {
      id: "server-bags",
      label: "Server bags",
      icon: <Server size={16} aria-hidden />,
      render: () => (
        <ServerBagsPane ecosystemId={ecosystemId} help={helpFor?.("ecosystems/server-bags")} />
      ),
    },
    {
      id: "signin-apps",
      label: "Sign-in apps",
      icon: <LogIn size={16} aria-hidden />,
      // The only row with a leaf of its own: a sign-in app opens its detail at
      // `…/configuration/signin-apps/<clientId>`.
      render: (subLeaf) => (
        <SigninAppsPane
          ecosystemId={ecosystemId}
          help={helpFor?.("ecosystems/signin-apps")}
          leaf={subLeaf}
        />
      ),
    },
    {
      id: "tokens",
      label: "Tokens",
      icon: <KeyRound size={16} aria-hidden />,
      render: () => (
        <StorageTokensPanel ecosystemId={ecosystemId} workspace={workspaceSlug} />
      ),
    },
  ];

  return (
    <StackGroupDetail
      levelId="configuration-group"
      title={title}
      items={items}
      urlSelection={leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined}
      renderSubLeaf={subLeafFor}
    />
  );
}

/** The group's blurb — the rail's topic overview and the breadcrumb help popover both read it.
 *  Written here rather than looked up: the help store is keyed by ROUTE, and this group has none
 *  (picking it only discloses the list beside it). */
export const CONFIGURATION_DESCRIPTION =
  "The workspace's knobs — who can sign in, which flags are on, the keys and tokens it " +
  "issues, and what it bills.";
