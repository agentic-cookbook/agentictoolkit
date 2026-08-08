// Profile card API: social links, addresses, and privacy grants.
// Backs the Settings > Profile editor surface (social links, addresses, contact
// privacy, avatar privacy) and the owner's live UserCard preview.

import { authedJson, authedRequest } from "../http";
import type {
  Address,
  AddressWrite,
  PrivacyGrant,
  PrivacyLevel,
  PrivacyTargetTable,
  SocialLink,
  SocialLinkWrite,
} from "./wire";

export type {
  Address,
  AddressWrite,
  PrivacyGrant,
  PrivacyLevel,
  PrivacyTargetTable,
  SocialLink,
  SocialLinkWrite,
} from "./wire";

/** Maps privacy level to audienceMask integer for PUT /account/privacy. */
const AUDIENCE_MASK: Record<PrivacyLevel, number> = {
  "only-me": 0,
  public: 1,
  hub: 2,
};

// ── Query keys ─────────────────────────────────────────────────────────────────

// Namespace ROOTS, not query keys — every list lives under an owner segment below, so these
// are deliberately not exported: using a bare root as a query key would alias one owner's list
// onto another's. Go through socialLinksKey / addressesKey.
const SOCIAL_LINKS_KEY = ["profile", "social-links"] as const;
const ADDRESSES_KEY = ["profile", "addresses"] as const;
export const PRIVACY_KEY = ["account", "privacy"] as const;

/** Cache key for a social-links list, namespaced by OWNER: `self` for the caller's own list,
 *  `org/<slug>` for a workspace's. The two branches differ at the SAME segment, so neither is a
 *  prefix of the other — react-query invalidation is prefix-based, so a shorter personal key
 *  would also invalidate (and refetch) every org list. Defined once: the panel that READS and
 *  the section that INVALIDATES must not derive this shape independently, or a change to one
 *  silently desyncs the other. */
export function socialLinksKey(workspaceSlug?: string): readonly string[] {
  return workspaceSlug ? [...SOCIAL_LINKS_KEY, "org", workspaceSlug] : [...SOCIAL_LINKS_KEY, "self"];
}

/** Cache key for an addresses list. Same contract as {@link socialLinksKey}. */
export function addressesKey(workspaceSlug?: string): readonly string[] {
  return workspaceSlug ? [...ADDRESSES_KEY, "org", workspaceSlug] : [...ADDRESSES_KEY, "self"];
}

/** `?workspace=<slug>` suffix for the owner-scoped content routes; empty for the
 *  personal (self-owned) path so the URL is byte-identical to today. */
function workspaceQuery(opts?: { workspace?: string }): string {
  return opts?.workspace ? `?workspace=${encodeURIComponent(opts.workspace)}` : "";
}

// ── Social links ───────────────────────────────────────────────────────────────

export async function listSocialLinks(opts?: { workspace?: string }): Promise<SocialLink[]> {
  return authedJson<SocialLink[]>(`/api/content/social-links${workspaceQuery(opts)}`);
}

export async function createSocialLink(
  body: SocialLinkWrite,
  opts?: { workspace?: string },
): Promise<SocialLink> {
  return authedJson<SocialLink>(`/api/content/social-links${workspaceQuery(opts)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSocialLink(
  id: string,
  body: SocialLinkWrite,
  opts?: { workspace?: string },
): Promise<SocialLink> {
  return authedJson<SocialLink>(
    `/api/content/social-links/${encodeURIComponent(id)}${workspaceQuery(opts)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function deleteSocialLink(id: string, opts?: { workspace?: string }): Promise<void> {
  await authedRequest(`/api/content/social-links/${encodeURIComponent(id)}${workspaceQuery(opts)}`, {
    method: "DELETE",
  });
}

// ── Addresses ──────────────────────────────────────────────────────────────────

export async function listAddresses(opts?: { workspace?: string }): Promise<Address[]> {
  return authedJson<Address[]>(`/api/content/addresses${workspaceQuery(opts)}`);
}

export async function createAddress(
  body: AddressWrite,
  opts?: { workspace?: string },
): Promise<Address> {
  return authedJson<Address>(`/api/content/addresses${workspaceQuery(opts)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAddress(
  id: string,
  body: AddressWrite,
  opts?: { workspace?: string },
): Promise<Address> {
  return authedJson<Address>(
    `/api/content/addresses/${encodeURIComponent(id)}${workspaceQuery(opts)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function deleteAddress(id: string, opts?: { workspace?: string }): Promise<void> {
  await authedRequest(`/api/content/addresses/${encodeURIComponent(id)}${workspaceQuery(opts)}`, {
    method: "DELETE",
  });
}

// ── Privacy ────────────────────────────────────────────────────────────────────

export async function getPrivacyGrants(): Promise<PrivacyGrant[]> {
  const res = await authedJson<{ items: PrivacyGrant[] }>("/api/account/privacy");
  return res.items;
}

export async function setPrivacyGrant(
  targetTable: PrivacyTargetTable,
  targetId: string,
  level: PrivacyLevel,
): Promise<PrivacyGrant> {
  return authedJson<PrivacyGrant>("/api/account/privacy", {
    method: "PUT",
    body: JSON.stringify({
      targetTable,
      targetId,
      audienceMask: AUDIENCE_MASK[level],
    }),
  });
}

/**
 * Derive the PrivacyLevel for a (targetTable, targetId) pair from the loaded
 * grants. Returns 'only-me' when no matching grant exists (the default).
 *
 * Bit semantics: bit 0 = PUBLIC (mask & 1), bit 1 = HUB (mask & 2).
 * When both are set (mask = 3), PUBLIC wins as the broader audience.
 */
export function resolvePrivacyLevel(
  grants: PrivacyGrant[],
  targetTable: PrivacyTargetTable,
  targetId: string,
): PrivacyLevel {
  const grant = grants.find((g) => g.targetTable === targetTable && g.targetId === targetId);
  if (!grant) return "only-me";
  if (grant.audienceMask & 1) return "public";
  if (grant.audienceMask & 2) return "hub";
  return "only-me";
}
