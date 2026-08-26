// GENERATED FILE — do not edit by hand.
// Regenerate: python3 <websites-root>/tools/gen-site-routes.py --region placeholder
//
// placeholder's share of the fleet's page routes, derived from that repo's App Router
// trees. The rest is in its siblings `routes.main.generated.ts`, `routes.marketing.generated.ts`, written by the other repos;
// `routes.generated.ts` merges them all and is what consumers import. See the
// generator's docstring for why this is one file per repo.
//
// `gen-site-routes.py --region placeholder --check` re-derives this map in that
// repo's CI, so a page added, moved, or removed anywhere in its fleet fails there
// until the script is re-run.
//
// NOT dev-only tooling: research's `src/lib/sitemap-routes.ts` reads
// `SITE_ROUTES.research` at build time to derive which top-level and
// `[workspace]`-child segments are STATIC — i.e. which author or paper slugs would
// be shadowed by a real route — so research's public sitemap is a second,
// load-bearing consumer of this map, not just the flyout above. Do not prune
// either half for being unused outside dev tooling.
import type { SiteId } from './registry'

export const SITE_ROUTES_PLACEHOLDER: Partial<Record<SiteId, readonly string[]>> = {
  academy: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  consultants: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/consultant/[entry]',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/search',
    '/terms',
    '/tour',
  ],
  consulting: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  help: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  news: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  store: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/privacy',
    '/terms',
    '/tour',
  ],
  support: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  teamregistry: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  tools: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
}
