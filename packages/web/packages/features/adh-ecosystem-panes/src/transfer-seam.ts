import type { ReactNode } from "react";

/**
 * The one seam these panes could not bring with them out of the hub.
 *
 * An Application and a Storage Bucket both offer "Transfer Ownership", and the destination
 * list for either is a WORKSPACE ▸ its Products menu — so building it needs the signed-in
 * caller's workspace list and, per workspace, the Products it owns. That is host knowledge:
 * a workspace is not an ecosystem concept, these panes never had a workspace list of their
 * own (they imported the hub's `EcosystemScopedTransfer`, which reaches for two hub API
 * hooks and the hub's own workspace-type table), and a package that fetched it would be
 * asserting that every host has workspaces at all.
 *
 * So the section is INJECTED, the same way `AccessPane` takes its `usersDirectory` and
 * `EcosystemsFeature` takes its `renderTransferOwnership`. What each pane decides for
 * itself — the noun it presents, the entity type the backend expects, and which of the
 * entity's two addresses is the label — travels in the request, so a host renderer is a
 * spread and nothing about the presentation moves out of the package with the fetching.
 *
 * Omitted ⇒ no Transfer Ownership section, which is the honest rendering for a host that
 * has no second owner to offer.
 */
export interface TransferSectionRequest {
  /** Capitalized, as presented — "Application", "Storage Bucket". */
  entityNoun: string;
  /** What the ownership endpoint calls this kind of row. */
  entityType: "application" | "bucket";
  /** rdid or uuid; the backend accepts either. */
  entityId: string;
  /** The object's own ADDRESS (not its display name), shown in the confirmation dialog. */
  entityLabel: string;
  /**
   * The Product this entity lives in today, as best known by the pane — threaded down from
   * the pane's own `ecosystemId` prop. Named for what it is FOR, not what it is guaranteed
   * to be: nothing upstream enforces that it resolved to an rdid rather than a uuid, so the
   * host's renderer is the one place that decides whether it is usable as a current target.
   */
  ecosystemRdid?: string;
}

export type RenderTransferSection = (request: TransferSectionRequest) => ReactNode;
