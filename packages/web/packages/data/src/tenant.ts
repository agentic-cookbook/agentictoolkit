"use client";

import { useMemo } from "react";
import { readAccessToken } from "@agentic-toolkit/auth/client";

interface JwtClaims {
  tenant_id?: string;
  project_id?: string;
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  const body = parts[1];
  if (parts.length !== 3 || !body) return null;
  try {
    const payload = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
}

export function tenantIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const claims = decodeJwtClaims(token);
  return claims?.tenant_id ?? claims?.project_id ?? null;
}

/** The tenant of the CURRENT access token. Features render behind a host auth
 *  gate, so an absent token (null) is a transient non-state, not an error. */
export function useTenantId(): string | null {
  // Token writes re-render the tree via the host AuthProvider; reading at
  // render keeps this hook provider-independent (no toolkit context needed).
  return useMemo(() => tenantIdFromToken(readAccessToken()), [readAccessToken()]);
}
