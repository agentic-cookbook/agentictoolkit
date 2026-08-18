'use client'

import { notFound } from 'next/navigation'
import type { ComponentType, ReactNode } from 'react'
import type { Workspace } from '@agentic-toolkit/data'
import type { ProfilePrincipal } from '../profile/types'

// The contract a site implements to have a workspace landing view at `/<workspace>`.
//
// Before this existed, every site's page.tsx hand-assembled the arrangement: parse the path,
// construct the base, construct `<base>/<slug>` a second time by hand, mount the shell, mount the
// feature inside it. Four steps, one of them a template literal encoding a URL grammar that lives
// in a shared package — so the grammar was really declared once per site, and the next site to be
// rolled out declared it again. Nothing forces those copies to agree; nothing fails when one
// drifts. A site is a SUBCLASS of one arrangement here, not a fresh assembly of the same parts.
//
// So the site declares WHAT is different (its URL grammar below the workspace, and what to render)
// and the route owns HOW it is put together. Changing this interface is a compile error in every
// implementer, which is the whole point: a site cannot silently keep an old arrangement working.

/**
 * What the shell hands whatever it renders below itself. Every field is derived from the
 * RESOLVED workspace, not from the URL segment the caller was handed — the two disagree while
 * resolution is in flight, and this scope only exists after they agree.
 */
export interface SiteHomeScope {
  /** The resolved workspace's slug. Never empty: nothing below the shell renders until a
   *  workspace resolves AND the URL carries it. */
  workspaceSlug: string
  /** `/${workspaceSlug}` — the base the site's own view is mounted at. Built here so no site
   *  builds it, and so the grammar changes in one place. */
  scopedBase: string
  /**
   * The resolved workspace's own ROW, not just its slug — carried because the shell already has
   * it and a feature that needs any of it otherwise has to fetch the same list a second time.
   *
   * `kind` is the field that earned this: a surface whose wording or shape differs between a
   * personal workspace and an organization (the integrations site's first destination reads "My
   * Integrations" vs "Org Integrations") can only ask the row. Re-fetching for one enum would
   * duplicate the request this shell exists to own, and would answer LATER than the render that
   * needs it, so the label would flip under the user's cursor on every mount.
   */
  workspace: Workspace
}

/** A scope plus whatever this site's `parse` made of the segments below the workspace. */
export interface SiteHomeContext<View> extends SiteHomeScope {
  view: View
}

/**
 * What a workspace shell is handed: the workspace as the URL spells it (absent at `/home`),
 * and the site's own view as a FUNCTION to call once a workspace has actually resolved.
 *
 * Declared here rather than in SiteHomeShell so a site's model can name the type without
 * importing the shell — and therefore without pulling `@agentic-toolkit/data` in behind it.
 */
export interface SiteHomeShellProps {
  /** The workspace segment as it stands in the URL, if any. */
  workspaceSlug?: string
  /** The site's view. Called — not rendered — once a workspace is resolved AND in the URL. */
  children: (scope: SiteHomeScope) => ReactNode
  /** The model's workspace-bar action, forwarded by SiteHomeRoute. The shell owns WHEN it is
   *  called: only once `resolved` is non-null, because the bar renders before resolution
   *  completes and this callback is documented as never seeing an absent workspace. */
  action?: (scope: SiteHomeScope) => ReactNode
}

/**
 * One site's workspace-route declaration. `View` is inferred from `parse`, so a site never names
 * it.
 */
export interface SiteHomeModel<View> {
  /**
   * The path segments BELOW the workspace → this site's view state.
   *
   * `/acme/proj-1/notes` hands `['proj-1', 'notes']`. The workspace segment is already
   * consumed — a site that reads it here is reading the wrong layer, and `scopedBase` /
   * `workspaceSlug` are how it gets that.
   *
   * There is no `basePath` above it and no site declares one: the workspace IS the first segment
   * on every site, so the count of segments above it is zero everywhere and a field that can only
   * hold one value is a field three sites got to disagree about.
   *
   * This is also where a site says a path does NOT exist, by calling `notFound()` — the route
   * mounts one optional catch-all in every site, so "there is nothing at this depth" is a
   * statement about the site's grammar rather than about its file layout. A site with no grammar
   * at all below the workspace uses `noSubPath` below rather than writing that rule again.
   *
   * Called on every render, so it must be pure and cheap; parsing a handful of segments is both.
   */
  parse: (segments: string[]) => View
  /** This site's workspace landing view. Called only once a workspace has resolved, so nothing
   *  here has to cope with an absent one. */
  render: (ctx: SiteHomeContext<View>) => ReactNode
  /** An optional right-justified control in the workspace bar. Called only once a workspace
   *  has resolved, so nothing here copes with an absent one. */
  action?: (scope: SiteHomeScope) => ReactNode
  /**
   * This site's own shell around `render`, in place of the shared `<SiteHomeShell>`.
   *
   * The seam that lets `app/home/page.tsx` and `app/[workspace]/[[...path]]/page.tsx` be the
   * same bytes in a site whose workspace chrome is not the family's. `hub` is the one that
   * sets it, and for a reason that is a product question rather than a layout one: its picker
   * carries teams and the per-workspace feature grants that decide which rows may open what,
   * and the shared shell's `workspacesApi.list()` returns neither. Feeding those through the
   * shared shell would mean either every site grows teams or the hub loses them — so the shell
   * is the seam and the answer stays open.
   *
   * A shell owns four things and a replacement owes all four: resolving `/home`'s absent
   * workspace and replacing the URL with it, refusing a slug the caller cannot reach with a
   * `notFound()` rather than a redirect, holding `children` until the resolution agrees with the
   * URL, and drawing the chooser. See SiteHomeShell for what each is defending. The hub owes the
   * refusal like everyone else and pays it ABOVE this seam — its `WorkspaceGate` matches the slug
   * against the caller's memberships before the shell mounts at all — which is why HubHomeShell
   * has no such check of its own.
   */
  shell?: ComponentType<SiteHomeShellProps>
  /**
   * This site's public section on a principal's profile at `/<slug>/profile`.
   *
   * Omit and the profile is the shared header alone — which is the RIGHT answer for a site with
   * nothing public to say, not a gap. That default is what makes this field cost the other 38
   * sites zero lines: `billing` has no public surface, so it declares nothing and gets a correct
   * page.
   *
   * A site that HAS a public surface but finds this principal has nothing in it says so from
   * INSIDE the section — "This user has no public projects" — rather than by returning null.
   * Only the site knows the noun, and a shell that guessed one would be guessing a different word
   * per site.
   *
   * Fetches its own data, client-side, keyed on the principal. That is what keeps adding a
   * section to one site from touching any other: the profile route is the same bytes everywhere
   * and knows nothing about what a section needs.
   *
   * Optional and separate from `render` because the two are different pages: `render` draws a
   * workspace the caller is working IN, this draws a page ABOUT someone who may be a stranger.
   */
  profileSection?: (principal: ProfilePrincipal) => ReactNode
}

/**
 * Declares a site's workspace-route model.
 *
 * An identity function, and worth its existence for one reason: it INFERS `View` from `parse`'s
 * return type, so a site writes neither a type parameter nor a type annotation and still gets
 * `ctx.view` fully typed inside `render`. Annotating the object as `SiteHomeModel<Something>`
 * instead forces the site to name the type its own parser already decides.
 */
export function defineSiteHome<View>(model: SiteHomeModel<View>): SiteHomeModel<View> {
  return model
}

/**
 * The `parse` for a site with NO grammar below the workspace: `/<ws>` is the only address it has,
 * and anything deeper does not exist.
 *
 * This used to be said by the file layout — those sites mounted a plain `[workspace]/page.tsx`
 * rather than a catch-all, so Next answered a deeper path with not-found and no site wrote a rule.
 * It cost the family its one shape: a site that later grew a sub-path had to change its route
 * FILES, which is exactly the per-site divergence this route exists to remove. So every site now
 * mounts `[workspace]/[[...path]]/page.tsx` — the same bytes — and the depth a site accepts is a
 * line in its model instead of a directory on disk.
 *
 * Says the same thing to a visitor as the old layout did: `notFound()` renders the site's own
 * `app/not-found.tsx`. It is called during render of a Client Component, which Next's HTTP-access
 * fallback boundary catches the same way it catches a server one — the boundary is a React error
 * boundary in the client layout router, not a server-only path.
 *
 * Returns `null` so `View` infers as `null` for these sites, which is what their `render` already
 * expects; the `return` is unreachable, since `notFound()` throws.
 */
export function noSubPath(segments: string[]): null {
  if (segments.length > 0) notFound()
  return null
}
