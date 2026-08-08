"use client";

import { useQuery } from "@tanstack/react-query";

import {
  listAddresses,
  getPrivacyGrants,
  addressesKey,
  PRIVACY_KEY,
} from "@agentic-toolkit/data/profile";
import { AddressesSection } from "./AddressesSection";

// ── Component ──────────────────────────────────────────────────────────────────

export function AddressesPanel({
  workspaceSlug,
  hidePrivacy = false,
}: { workspaceSlug?: string; hidePrivacy?: boolean } = {}) {
  const addressesQuery = useQuery({
    queryKey: addressesKey(workspaceSlug),
    queryFn: () => listAddresses(workspaceSlug ? { workspace: workspaceSlug } : undefined),
    retry: false,
  });

  const privacyQuery = useQuery({
    queryKey: PRIVACY_KEY,
    queryFn: getPrivacyGrants,
    retry: false,
    enabled: !hidePrivacy, // org sections have no per-item privacy tiers
  });

  const grants = privacyQuery.data ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl">
        <AddressesSection
          addresses={addressesQuery.data ?? []}
          isLoading={addressesQuery.isLoading}
          grants={grants}
          hideSectionTitle
          workspaceSlug={workspaceSlug}
          hidePrivacy={hidePrivacy}
        />
      </div>
    </div>
  );
}
