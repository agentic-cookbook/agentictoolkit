"use client";

import { useQuery } from "@tanstack/react-query";

import {
  listSocialLinks,
  getPrivacyGrants,
  socialLinksKey,
  PRIVACY_KEY,
} from "@agentic-toolkit/data/profile";
import { useReportBusy } from "@agentic-toolkit/resource";
import { SocialLinksSection } from "./SocialLinksSection";

// ── Component ──────────────────────────────────────────────────────────────────

export function SocialLinksPanel({
  workspaceSlug,
  hidePrivacy = false,
}: { workspaceSlug?: string; hidePrivacy?: boolean } = {}) {
  const socialLinksQuery = useQuery({
    queryKey: socialLinksKey(workspaceSlug),
    queryFn: () => listSocialLinks(workspaceSlug ? { workspace: workspaceSlug } : undefined),
    retry: false,
  });

  const privacyQuery = useQuery({
    queryKey: PRIVACY_KEY,
    queryFn: getPrivacyGrants,
    retry: false,
    enabled: !hidePrivacy, // org sections have no per-item privacy tiers
  });

  const grants = privacyQuery.data ?? [];

  // Publishes no topic list of its own: the settings list one component up owns the spinner. Both
  // reads, because the section is not finished until the tiers arrive — and the privacy read is not
  // surfaced anywhere else at all. See `useReportBusy`.
  useReportBusy(socialLinksQuery.isFetching || privacyQuery.isFetching);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl">
        <SocialLinksSection
          links={socialLinksQuery.data ?? []}
          isLoading={socialLinksQuery.isLoading}
          grants={grants}
          hideSectionTitle
          workspaceSlug={workspaceSlug}
          hidePrivacy={hidePrivacy}
        />
      </div>
    </div>
  );
}
