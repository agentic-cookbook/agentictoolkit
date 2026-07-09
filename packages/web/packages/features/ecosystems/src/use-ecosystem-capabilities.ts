"use client";

// The per-ecosystem opt-in capability gate (messaging P5). Reads the backend's
// per-ecosystem capability registry (GET /ecosystem/capabilities/:id → { capabilities })
// and derives feature flags from it. Every optional feature is OFF unless the viewed
// ecosystem has explicitly enabled it, so a feature is absent by default.
//
// "The ecosystem the hub currently views": when the caller knows it (EcosystemsFeature
// passes the selected ecosystem's id), we read that one directly. Off a
// selected-ecosystem context — a standalone `/<slug>/messaging` route, which carries
// no ecosystem in its URL — we resolve the ecosystem tied to the current workspace
// `[slug]` segment (its own slug, else the workspace's default/primary ecosystem),
// NOT an arbitrary alphabetical `list()[0]` (which also hides default ecosystems).

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useAuth } from "@agentic-toolkit/auth";
import { ecosystemsApi } from "@agentic-toolkit/data/ecosystems";

/** The capability id that turns on the messaging feature (DMs + notifications). */
export const MESSAGING_CAPABILITY = "messaging";

export interface EcosystemCapabilities {
  /** Enabled capability ids for the resolved ecosystem (empty until loaded / when off). */
  capabilities: string[];
  /** True while the ecosystem id or its capabilities are still resolving. */
  isLoading: boolean;
  /** The ecosystem whose capabilities these are (the explicit id or the fallback). */
  ecosystemId: string | undefined;
}

/**
 * The opt-in capabilities of an ecosystem. Pass the id the caller already holds (the
 * Ecosystems feature's selected ecosystem); omit it to gate off the ecosystem tied to the
 * current workspace `[slug]` segment. Only fetches for a signed-in user — the
 * capability read is authed, so it stays idle on public/logged-out surfaces.
 */
export function useEcosystemCapabilities(ecosystemId?: string): EcosystemCapabilities {
  const { user } = useAuth();
  const signedIn = user != null;
  const params = useParams<{ slug?: string }>();
  const slug = params?.slug;

  // Resolve the fallback "current" ecosystem only when no explicit id is supplied,
  // from the current workspace slug (react-query dedupes concurrent readers).
  const slugQuery = useQuery({
    queryKey: ["ecosystem-id-for-slug", slug],
    queryFn: () => ecosystemsApi.ecosystemIdForSlug(slug as string),
    enabled: signedIn && ecosystemId == null && slug != null,
    retry: false,
  });
  const id = ecosystemId ?? slugQuery.data;

  const capabilitiesQuery = useQuery({
    queryKey: ["ecosystem-capabilities", id],
    queryFn: () => ecosystemsApi.capabilities(id as string),
    enabled: signedIn && id != null,
    retry: false,
  });

  const resolvingId = ecosystemId == null && slugQuery.isLoading;
  const isLoading = signedIn && (resolvingId || (id != null && capabilitiesQuery.isLoading));

  return { capabilities: capabilitiesQuery.data ?? [], isLoading, ecosystemId: id ?? undefined };
}

/** True when the (explicit or primary) ecosystem has the messaging feature enabled. */
export function useHasMessaging(ecosystemId?: string): boolean {
  return useEcosystemCapabilities(ecosystemId).capabilities.includes(MESSAGING_CAPABILITY);
}
