// Auth API wrapper for personal settings — moved from adh's hub
// (frontend/src/sites/hub/src/api/auth.ts). Backs the Account and Profile panels'
// "who am I" reads/writes: the current-user query, the profile PATCH, slug
// availability, and password change.
//
// Request/response shapes below are TRANSCRIBED from the backend rather than
// imported from `@agentic-toolkit/adh-api-types`, unlike hub's original (which typed
// them as `SuccessBody<'/auth/me', 'get'>` etc). That package's name starts with
// `@agentic-toolkit/adh`, which `scripts/check_boundaries.py`'s `_is_vocabulary`
// check classifies as the adh VOCABULARY tier (name === '@agentic-toolkit/adh' or
// name.startswith('@agentic-toolkit/adh-')) — confirmed by running the guard with
// this package importing it, which failed naming `adh-api-types`. This package is
// MECHANISM tier (see package.json's `comment:tier`) and may never import
// vocabulary. `@agentic-toolkit/data/profile`'s `wire.ts` establishes the same
// pattern for the same reason; see its header for the fuller rationale.
//
// Fields copied verbatim from `packages/adh-api-types/src/schema.ts` as of this
// move: `components.schemas.User` (the `Me` shape), and the request bodies for
// `PATCH /auth/me` and `POST /auth/change-password`. Unlike the generated
// SuccessBody/RequestBody helpers, these do NOT auto-track a backend schema change
// — a rename/removal there silently stops matching this file rather than failing
// `tsc`.
import { useQuery } from "@tanstack/react-query";
import { authedJson, authedRequest } from "@agentic-toolkit/auth/client";

/**
 * The signed-in user exactly as the backend's GET /auth/me returns it
 * (schema.ts `components.schemas.User`).
 */
export interface Me {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  slug: string | null;
  /** Whether the public profile card is visible at /public/users/:slug */
  publicProfileEnabled: boolean;
  /** The page-level profile visibility. Supersedes `publicProfileEnabled` above, which the
   *  backend still writes in parallel until a contract migration drops it. */
  profileVisibility: "public" | "hub" | "private";
  capabilities: string[];
}

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery<Me>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => authedJson<Me>("/api/auth/me"),
    retry: false,
  });
}

/**
 * Update the signed-in user's own profile. All fields are optional; at least one
 * must be provided. Returns the updated user. Throws `AuthHttpError` with status
 * 409 if the requested slug is already taken.
 */
export function updateMe(body: {
  name?: string;
  slug?: string;
  /** Format: uri */
  avatarUrl?: string;
  publicProfileEnabled?: boolean;
  profileVisibility?: "public" | "hub" | "private";
}): Promise<Me> {
  return authedJson<Me>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// MOVED to @agentic-toolkit/data in hub too. The endpoint answers about the ONE
// URL namespace users and organizations share, and the organizations feature has
// to ask it as well — so the path lives with the workspaces client rather than
// being transcribed once per host.
export { checkWorkspaceSlugAvailable as checkSlugAvailable } from "@agentic-toolkit/data";

/**
 * Change the signed-in user's password.
 * Real backend: POST /api/auth/change-password. On a bad current password the
 * backend responds non-2xx and authedRequest throws with its error message.
 */
export function changePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return authedRequest("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
