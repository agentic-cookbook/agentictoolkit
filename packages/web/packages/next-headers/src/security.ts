/**
 * Baseline HTTP security headers applied to every app (SEC-M4). Deliberately conservative — these
 * can't break functionality: `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` block
 * cross-origin framing (clickjacking on the authenticated hub/admin surfaces), `nosniff` stops MIME
 * confusion, HSTS enforces HTTPS, and the Referrer-Policy trims cross-origin referrers. This is NOT a
 * full script/style CSP (that needs per-app tuning) — the CSP here carries ONLY frame-ancestors, so
 * it imposes no script/style restrictions.
 *
 * Ported unchanged from `frontend/src/next-config-base.mjs:28`.
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];
