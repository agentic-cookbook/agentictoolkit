"use client";

import { useMemo, type ReactElement, type ReactNode } from "react";
import {
  Settings,
  AppWindow,
  UsersRound,
  KeyRound,
  LogIn,
  FolderKanban,
  Flag,
  Server,
  Trophy,
  HardDrive,
  Plug,
  MessageCircle,
  LayoutDashboard,
  CreditCard,
} from "lucide-react";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import {
  EcosystemsFeature,
  type EcosystemsTopicConfig,
  type RenderTopicPaneCtx,
} from "@agentic-toolkit/ecosystems";
import {
  ApplicationsPane,
  MessagingPane,
  SchemasPane,
  UsersPane,
  ecosystemUsersApi,
  applicationsPrototypeApi,
  type RenderTransferSection,
} from "@agentic-toolkit/adh-ecosystem-panes";
import { IntegrationsPane } from "@agentic-toolkit/integrations";
import {
  AuthPane,
  FeatureFlagsPane,
  ServerBagsPane,
  SigninAppsPane,
  StorageTokensPanel,
} from "@agentic-toolkit/ecosystem-config";
import { GamificationPane } from "@agentic-toolkit/gamification";
import { AccessPane } from "@agentic-toolkit/authentication";
import { SubjectProjectPane } from "@agentic-toolkit/projects";
import { helpFor } from "@agentic-toolkit/adh/help/store";
import { PRODUCT_TOPICS } from "./topics";

// The PRODUCTS feature — @agentic-toolkit/ecosystems's EcosystemsFeature presented as Products
// (each product IS an ecosystem). This file is the composition: it builds the feature's injected
// config from adh's own registries (topic icons, the unified help store, and the config panes the
// feature composes but doesn't own) and renders the package entry with Product labels in
// `listFirst` mode — the items are the ecosystems the WORKSPACE directly OWNS (owner_id = the
// workspace's principal; ownership, never the admin-widened manageable set), presented as rail
// level 0 of the ONE hierarchical topic-detail stack; opening a product shows its topic rail
// (PRODUCT_TOPICS) as the next level.
//
// It is a PACKAGE and not the hub's ProductsTab because agenticdeveloperproducts.com mounts the
// same feature at /home now. The hub keeps a thin wrapper that supplies its own seams.

// One icon per product topic. This map is the rail's own property and travels with
// PRODUCT_TOPICS: the hub's FEATURE_META still names an icon for the topics that are ALSO
// workspace-rail features, and the two agree by construction below (the test asserts the map is
// total over PRODUCT_TOPICS, so a topic added there without an icon fails rather than rendering
// a blank cell).
const ICONS: Record<string, ReactNode> = {
  project: <FolderKanban size={16} aria-hidden />,
  storage: <HardDrive size={16} aria-hidden />,
  integrations: <Plug size={16} aria-hidden />,
  messaging: <MessageCircle size={16} aria-hidden />,
  tokens: <KeyRound size={16} aria-hidden />,
  applications: <AppWindow size={16} aria-hidden />,
  dashboards: <LayoutDashboard size={16} aria-hidden />,
  // The "Users" topic keeps id "invitations" for deep-link stability (its members are
  // Users + Requests / Pending users / Invites); a people icon matches the label.
  invitations: <UsersRound size={16} aria-hidden />,
  "signin-apps": <LogIn size={16} aria-hidden />,
  gamification: <Trophy size={16} aria-hidden />,
  auth: <KeyRound size={16} aria-hidden />,
  "feature-flags": <Flag size={16} aria-hidden />,
  "server-bags": <Server size={16} aria-hidden />,
  billing: <CreditCard size={16} aria-hidden />,
  settings: <Settings size={16} aria-hidden />,
};

/** The rail as EcosystemsFeature wants it: PRODUCT_TOPICS with each topic's icon resolved and its
 *  overview-card description sourced from the unified help store (the same `ecosystems/<topic>`
 *  copy the help popovers read). A module constant — nothing about it varies per host. */
export const PRODUCT_TOPIC_CONFIGS: EcosystemsTopicConfig[] = PRODUCT_TOPICS.map((t) => ({
  id: t.id,
  label: t.label,
  icon: ICONS[t.id],
  description: helpFor(`ecosystems/${t.id}`),
  dividerAfter: t.dividerAfter,
}));

// The per-product Tokens pane. `ctx` (RenderTopicPaneCtx) carries no workspace slug and the topic
// renderer is a plain function (no hooks), so the slug is threaded from the feature's own prop as
// the OWNER: on an org workspace the product is org-owned, so its tokens must be too (list/mint
// the ORG'S tokens for this product's ecosystem, not the signed-in user's personal ones).
// `ecosystemId` still narrows to this product's bucket ecosystem.
//
// The product's auto-provisioned project needs the same slug for its Access member, and takes
// `leaf` (the 4th URL segment) to deep-link the member.
function productTopicPaneRenderer({
  workspaceSlug,
  renderTransfer,
}: {
  workspaceSlug: string;
  renderTransfer?: RenderTransferSection;
}): (topicId: string, ctx: RenderTopicPaneCtx) => ReactNode {
  return function renderProductTopicPane(topicId, ctx) {
    switch (topicId) {
      case "project":
        // The product's auto-provisioned project — subject-linked by the product's
        // ecosystem id (rdid here; the backend resolves it at the edge).
        if (!ctx.ecosystemId) return null;
        return (
          <SubjectProjectPane
            subjectKind="ecosystem"
            subjectId={ctx.ecosystemId}
            workspaceSlug={workspaceSlug || undefined}
            memberSelection={
              ctx.leaf ? { selectedId: ctx.leaf.leafId, onSelect: ctx.leaf.onSelect } : undefined
            }
          />
        );
      case "applications":
        return (
          <ApplicationsPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/applications")}
            leaf={ctx.leaf}
            renderTransfer={renderTransfer}
          />
        );
      case "integrations":
        return (
          <IntegrationsPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/integrations")}
            leaf={ctx.leaf}
          />
        );
      case "messaging":
        // Per-product Messaging (email/SMS via this product's own providers). This claim is
        // REQUIRED — a host whose renderFeaturePanel also knows "messaging" would otherwise be
        // asked for it, and (post DM/chat neutralization) the hub's answer is a "coming soon"
        // placeholder rather than this MessagingPane.
        return (
          <MessagingPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/messaging")}
            leaf={ctx.leaf}
          />
        );
      case "tokens":
        // The owner's token principals scoped to THIS product's ecosystem: the list is
        // filtered to tokens whose bucket lives in it, and a mint from here binds the
        // new token (and its bucket) to it. The hub's workspace-rail Tokens feature is the
        // same panel unscoped (all the owner's tokens, minting into the default ecosystem).
        return <StorageTokensPanel ecosystemId={ctx.ecosystemId} workspace={workspaceSlug} />;
      case "auth":
        // Single-record config pane (no inner deep-link): the product's explicit auth
        // policy governing its vended customer realm.
        return (
          <AuthPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/auth")}
          />
        );
      case "feature-flags":
        // Per-product feature flags: named on/off toggles this product's apps read.
        return (
          <FeatureFlagsPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/feature-flags")}
          />
        );
      case "server-bags":
        // Per-product server bags: arbitrary key → JSON config values for this product.
        return (
          <ServerBagsPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/server-bags")}
          />
        );
      case "signin-apps":
        // Master/detail: the product's vended sign-in clients, deep-linked by client id
        // (/products/<id>/signin-apps/<clientId>).
        return (
          <SigninAppsPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/signin-apps")}
            leaf={ctx.leaf}
          />
        );
      case "gamification":
        // Single-record config pane (no inner deep-link): the product's gamification realm —
        // enable/disable, skin, and per-surface toggles over its members.
        return (
          <GamificationPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/gamification")}
          />
        );
      // The three group-member panes (Storage ▸ Buckets / Access, Users ▸ Users). The
      // help-key mapping is the ORIGINAL, non-uniform one — the Buckets member's help key is
      // "schemas", not "buckets" (a CONTENT key under the `ecosystems/` namespace, not a URL).
      case "buckets":
        return (
          <SchemasPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/schemas")}
            leaf={ctx.leaf}
            renderTransfer={renderTransfer}
          />
        );
      case "access":
        return (
          <AccessPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/access")}
            leaf={ctx.leaf}
            usersDirectory={ecosystemUsersApi.list}
            applicationsDirectory={applicationsPrototypeApi.list}
          />
        );
      case "users":
        return (
          <UsersPane
            ecosystemId={ctx.ecosystemId}
            title={ctx.title}
            help={helpFor("ecosystems/users")}
            leaf={ctx.leaf}
          />
        );
      default:
        // Declined — EcosystemsFeature falls through to the host's renderFeaturePanel. The ids
        // that reach it are HOST_RENDERED_TOPIC_IDS (see ./topics), plus "settings", which the
        // feature renders itself and never asks either seam for.
        return null;
    }
  };
}

export interface ProductsFeatureProps {
  /** Where this feature is mounted — `/<slug>/products` on the hub, the workspace-scoped base on
   *  the products site. Supplied rather than derived so a host without a `[slug]` route fails at
   *  the prop seam instead of silently deriving undefined. */
  basePath: string;
  /** The workspace whose OWNED ecosystems are the product list (`listFirst` requires it), and the
   *  owner every per-product pane binds its writes to. */
  workspaceSlug: string;
  activeTopic?: string;
  activeEcoId?: string;
  activeLeafId?: string;
  /** The 5th URL segment: the deep-linkable inner entity of an open GROUP member. */
  activeMemberEntityId?: string;
  /**
   * The panes for the topics this package does NOT own — exactly
   * {@link HOST_RENDERED_TOPIC_IDS}. REQUIRED, not optional: every one of those topics is on the
   * rail unconditionally, so a host that omitted this would ship four rows that render nothing,
   * and nothing would say so. The hub passes its workspace feature-panel registry; a feature site
   * passes its own smaller one.
   */
  renderFeaturePanel: (feature: string, opts?: { subLeaf?: TopicLeaf }) => ReactNode;
  /** Transfer Ownership for an open bucket or application — see {@link RenderTransferSection}.
   *  Omitted ⇒ no transfer section, the honest result for a host that cannot name the
   *  destinations. */
  renderTransfer?: RenderTransferSection;
  /** Transfer Ownership for the PRODUCT itself, on its settings topic. Threaded straight through
   *  to EcosystemSettingsPane — neither this package nor the one below it owns the workspace list
   *  or the mutation. Omitted ⇒ no section, same rule as renderTransfer. */
  renderTransferOwnership?: (ecosystem: { id: string; identifier: string }) => ReactNode;
}

/**
 * The Products feature. Two hosts: the hub's `/<slug>/products` route (and its /home launcher)
 * and agenticdeveloperproducts.com's workspace route.
 *
 * Everything host-specific arrives as a prop. What is NOT a prop is the part that must be
 * identical on both — the topic rail, its icons, its help copy, and which pane each topic opens.
 * That is the whole reason this is a package: two hosts rendering "the Products feature" from two
 * copies of that switch is two features with one name.
 */
export function ProductsFeature({
  basePath,
  workspaceSlug,
  activeTopic,
  activeEcoId,
  activeLeafId,
  activeMemberEntityId,
  renderFeaturePanel,
  renderTransfer,
  renderTransferOwnership,
}: ProductsFeatureProps): ReactElement {
  // Memoized because the hub's version of this switch was a module constant, and closing over
  // `workspaceSlug` is what stopped it being one — rebuilding it every render would hand
  // EcosystemsFeature a new `renderTopicPane` identity on each pass, which is a prop change to a
  // seam that is supposed to be fixed.
  const renderTopicPane = useMemo(
    () => productTopicPaneRenderer({ workspaceSlug, renderTransfer }),
    [workspaceSlug, renderTransfer],
  );
  return (
    <EcosystemsFeature
      basePath={basePath}
      workspaceSlug={workspaceSlug}
      listFirst
      topics={PRODUCT_TOPIC_CONFIGS}
      renderFeaturePanel={renderFeaturePanel}
      renderTopicPane={renderTopicPane}
      helpFor={helpFor}
      labels={{ singular: "Product", plural: "Products" }}
      activeTopic={activeTopic}
      activeEcoId={activeEcoId}
      activeLeafId={activeLeafId}
      activeMemberEntityId={activeMemberEntityId}
      renderTransferOwnership={renderTransferOwnership}
    />
  );
}
