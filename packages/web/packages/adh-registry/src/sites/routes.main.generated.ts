// GENERATED FILE — do not edit by hand.
// Regenerate: python3 <websites-root>/tools/gen-site-routes.py --region main
//
// main's share of the fleet's page routes, derived from that repo's App Router
// trees. The rest is in its siblings `routes.hub.generated.ts`, `routes.marketing.generated.ts`, `routes.placeholder.generated.ts`, written by the other repos;
// `routes.generated.ts` merges them all and is what consumers import. See the
// generator's docstring for why this is one file per repo.
//
// `gen-site-routes.py --region main --check` re-derives this map in that
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

export const SITE_ROUTES_MAIN: Partial<Record<SiteId, readonly string[]>> = {
  community: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/admin',
    '/admin/members',
    '/admin/topics',
    '/admin/topics/[id]',
    '/admin/topics/new',
    '/auth/callback',
    '/categories/[slug]',
    '/details',
    '/details/[topic]',
    '/discussions',
    '/discussions/[topicId]',
    '/discussions/new',
    '/forum',
    '/home',
    '/people',
    '/privacy',
    '/terms',
    '/topics/[slug]',
    '/tour',
  ],
  cookbook: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/appendix/[[...slug]]',
    '/auth/callback',
    '/compliance/[[...slug]]',
    '/guidelines/[[...slug]]',
    '/home',
    '/ingredients/[[...slug]]',
    '/introduction/[[...slug]]',
    '/principles/[[...slug]]',
    '/privacy',
    '/projects/[[...slug]]',
    '/recipes/[[...slug]]',
    '/reference/[[...slug]]',
    '/terms',
    '/tour',
  ],
  docs: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  personaregistry: [
    '/',
    '/[slug]',
    '/[slug]/[persona]',
    '/auth/callback',
    '/privacy',
    '/terms',
    '/tour',
  ],
  registry: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
  research: [
    '/',
    '/[workspace]',
    '/[workspace]/[paperSlug]',
    '/[workspace]/edit/[paperUuid]',
    '/[workspace]/home/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/details',
    '/details/[topic]',
    '/home',
    '/privacy',
    '/search',
    '/terms',
    '/tour',
  ],
  toolkit: [
    '/',
    '/[workspace]/[[...path]]',
    '/[workspace]/profile',
    '/auth/callback',
    '/demo',
    '/demo/chat',
    '/demo/theme',
    '/home',
    '/privacy',
    '/terms',
    '/tour',
  ],
}
