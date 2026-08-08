"use client";

import type { ReactElement } from "react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";

// The two shared failure surfaces for a workspace-scoped feature whose ecosystem gate did not
// open. They live here rather than in any one host because three apps now render the gated
// panes, and two copies of this copy is two different answers to the same question.

/**
 * The shared failure surface for a workspace whose default-ecosystem resolution failed
 * (useDefaultEcosystemId's ONE request — retry: false — errored): without a defined
 * surface the scoped panes would sit on their loading states forever, or worse, render
 * an authoritative-looking empty list. One component so Storage / Integrations (and the
 * next scoped feature) can't drift on the copy.
 */
export function WorkspaceResolutionError(): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <EmptyState
        title="Couldn't load this workspace"
        description="The workspace's default ecosystem didn't resolve — reload the page to retry."
      />
    </div>
  );
}

/**
 * The shared surface for a workspace-level owner-admin feature (Storage / Integrations) opened
 * by someone who can VIEW the workspace but not MANAGE its infrastructure ecosystem — a plain
 * organization member. The panes' reads/writes would otherwise 403 per-pane; this shows the same
 * honest "ask an admin" notice the Products feature uses (EcosystemsFeature.notManageablePane),
 * so the two promoted features don't drift on the copy.
 */
export function WorkspaceNotManageable({ feature }: { feature: string }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <EmptyState
        title={`You don't have admin access to ${feature}`}
        description="Managing this workspace's infrastructure needs organization admin access — ask one of the organization's admins."
      />
    </div>
  );
}
