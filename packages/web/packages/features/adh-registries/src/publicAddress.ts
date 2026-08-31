import { getSite } from '@agentic-toolkit/adh-registry';

/**
 * Where a registry actually lives on the public web.
 *
 * R5-I15: the create dialog promised `registries.com/<slug>`, which is neither the host the
 * registries site is served on nor the path it serves a directory at — the one thing an owner is
 * told about a slug they can never change afterwards was wrong in both halves. The address is
 * stated once, here, from the site registry itself, so the hint and the route cannot drift:
 * `frontend/src/sites/registries/app/registry/[registry]/page.tsx` is the page this names.
 *
 * The host comes from `getSite` rather than a literal, because that row is what the deploy
 * actually uses. The fallback covers only the id vanishing from `SITES` — a hint with a blank
 * host would be worse than a slightly stale one.
 *
 * A registry BOUND to its own site later redirects from here to that site's apex. That is not a
 * second address to promise at create time: the binding does not exist yet, and this one keeps
 * resolving afterwards.
 */
export function registryPublicAddress(slug: string): string {
  const host = getSite('registries')?.prodHost ?? 'agenticdeveloperregistries.com';
  return `${host}/registry/${slug}`;
}
