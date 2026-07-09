// Wire types for the invitations domain — package-local mirrors of the OpenAPI-generated
// response shapes the hub previously imported as `SuccessBody` from `@adh-shared/api-types`
// (for /public/invitations/*, /auth/invitations/accept, /auth/register). These carry full
// backend-schema fidelity (not just the fields today's call sites touch) so the toolkit
// stays decoupled from the hub's generated types without narrowing what a caller can rely on.

export interface InvitePreviewRow {
  state: "valid" | "expired" | "accepted" | "invalid";
  ecosystemName?: string | null;
  maskedDestination?: string | null;
}

export interface VerifyResultRow {
  ok: boolean;
  ecosystemName: string;
}

export interface AcceptResultRow {
  status: "accepted" | "verification_required";
  ecosystemName?: string;
}

/** The authenticated user record embedded in a fresh register/login result — the SAME
 *  backend customer record GET /auth/me returns, so it re-uses that mirror (one wire
 *  representation; a backend field change is fixed in one place). */
import type { MeRow } from "../personas/wire";

export type UserRow = MeRow;

/** The 201 response from POST /auth/register — token + refreshToken + user, plus the
 *  invite-registration-specific verification/conflict flags. */
export interface RegisterWithInviteResultRow {
  /** JWT access token (Bearer credential) */
  token: string;
  /** Opaque refresh token (rotated on use) */
  refreshToken: string;
  user: UserRow;
  emailVerificationRequired: boolean;
  emailInUse?: boolean;
}
