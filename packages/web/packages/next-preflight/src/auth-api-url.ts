/**
 * Ported unchanged (message text and conditions) from
 * `frontend/src/next-config-base.mjs:133`'s `assertAuthApiUrl()`. That version
 * read `process.env.NEXT_PUBLIC_AUTH_API_URL` directly and threw with no
 * return value; this version takes the value (and a `siteId`, for a caller
 * that wants to identify which site's config is asserting — unused by the
 * message itself, since the text below is unchanged verbatim) as parameters
 * and returns the validated url, so it composes into `next.config.ts`
 * without reaching into `process.env` itself. Only the calling convention
 * moved — the message text and the conditions under which it throws are
 * unchanged.
 */
export function assertAuthApiUrl(url: string | undefined, siteId: string): string {
  if (!process.env.VERCEL_ENV) return url!;
  if (url?.trim()) return url;
  throw new Error(
    "NEXT_PUBLIC_AUTH_API_URL is not set. This is a hosted build (VERCEL_ENV=" +
      `${process.env.VERCEL_ENV}), and Next inlines this variable at build time — ` +
      "without it the bundle has no authorization-server host, so this site cannot " +
      "restore a visitor's existing central session and its header renders logged out " +
      "while Login still works. Set it on the Vercel project for this tier: " +
      "`python3 frontend/tools/set-backend-env.py --only <project>` (it is the single " +
      "source of truth for the value, and `--dry-run` shows every project missing it).",
  );
}
