/**
 * The Registries feature: everything an OWNER does with a registry they built, and everything a
 * REGISTRANT does with their own listing in someone else's.
 *
 * Two hosts render exactly this, which is why it is a package at all. It lived in
 * `websites/agenticdeveloperhub/src/registries/` until 2026-08-31, so
 * agenticdeveloperregistries.com — the site the feature is NAMED after — shipped a
 * `SiteHomePlaceholder` while the hub had the whole implementation. Moving it here is the fix,
 * and the two couplings that made it hub-only are named where they were broken: `basePath` on
 * {@link RegistriesFeature} (was a hub-local `useFeatureRoute('registries')` call) and
 * `listCacheKey` on `useRegistryDraft` (was `key.endsWith('/registries')`, the hub's mount point
 * written out as a rule).
 *
 * `./parse` is the URL grammar, exported separately and free of `use client`, so a Server
 * Component page can decide what a path selects without pulling the editor onto the client.
 */

export { RegistriesFeature } from './RegistriesFeature';
export type { RegistriesFeatureProps } from './RegistriesFeature';
