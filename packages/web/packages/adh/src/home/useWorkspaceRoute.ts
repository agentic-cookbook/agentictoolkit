'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { workspacePrefsApi, readCachedWorkspace, writeCachedWorkspace } from '@agentic-toolkit/data'
import type { WorkspaceOption } from './WorkspaceOption'

/**
 * Which workspace this URL means, and how picking another one is remembered.
 *
 * Extracted from SiteHomeShell so the hub can mount the same behaviour: the hub's workspace lives
 * at `/<slug>/home` rather than `${basePath}/<slug>`, and it lists rows (teams) the feature sites'
 * client drops — two differences that are entirely expressed by `hrefFor` and `canPersist`. The
 * resolution order, the write-ordering guards and the races they exist for are NOT duplicated:
 * this is the one copy.
 *
 * What it owns:
 *   - Resolution: a slug already in the URL decides on its own. Otherwise it seeds one — but only
 *     once workspacePrefsApi.get() has settled, so a first visit with an empty localStorage cannot
 *     write a personal-workspace guess into the URL and permanently outrank the server's real
 *     answer. Once seeding is allowed: the stored preference → the first row of `workspaces`
 *     (the caller's list is priority-ordered, personal first, so this costs no extra call).
 *   - The URL as live truth: with no (or an unknown) slug, replace to `hrefFor(resolved)`. That is
 *     what makes a site's bare `/home` a redirect rather than a page of its own — it mounts with
 *     no segment, and the first thing this does is send the browser to the resolved workspace.
 *   - Persistence, but only of an EXPLICIT act (see `pendingWrite`), and only of a slug the caller
 *     says may be persisted.
 *
 * `hrefFor` and `canPersist` are effect dependencies: pass stable identities (module scope, or
 * useCallback) or the effects re-run on every render. Re-running is guarded and harmless — the
 * writes are keyed on `pendingWrite`, which a completed write clears — but it is wasted work.
 */
export function useWorkspaceRoute({
  workspaces,
  workspaceSlug,
  hrefFor,
  canPersist,
}: {
  /** The caller's workspaces, or null while the list is still loading. */
  workspaces: readonly WorkspaceOption[] | null
  /** The workspace segment as it stands in the URL, if any. */
  workspaceSlug?: string
  /** Where a workspace lives on this host. */
  hrefFor: (slug: string) => string
  /** Whether a slug may be written as the CROSS-SITE preference. Defaults to "any of them".
   *  The hub passes one because its list includes teams, which no feature site can scope to:
   *  persisting a team would silently cost the user their real choice on every other site, since
   *  a stored slug that is not in a site's list is dropped at resolution and falls back to the
   *  personal workspace. A team pick still navigates — it just is not remembered elsewhere. */
  canPersist?: (slug: string) => boolean
}): {
  /** `undefined` = not yet decided. `null` = decided, and this user has no workspaces at all. */
  resolved: string | null | undefined
  /** Pick a workspace: navigates, and (if allowed) remembers it once the URL lands. */
  onSelect: (slug: string) => void
} {
  const router = useRouter()
  // The stored preference. The localStorage cache seeds it SYNCHRONOUSLY so the common case does
  // not wait on a round trip; the server's answer settles behind it and re-resolves if it
  // differs. Reading storage in a lazy initializer is hydration-safe here because every mount of
  // this hook is inside an auth gate that renders a skeleton until auth resolves on the client —
  // so it is never in the server HTML at all.
  const [stored, setStored] = useState<string | null>(() => readCachedWorkspace())
  // Whether the preference request has come back — succeeded, failed, or answered "nothing".
  const [prefsSettled, setPrefsSettled] = useState(false)
  // The slug to persist, set only by an EXPLICIT act: the workspace the user arrived on, or the
  // one they picked. A slug that was SEEDED is a guess, and a guess is never written back —
  // writing one over a preference we failed to read is how a dropped request destroys a real
  // choice. Cleared once written, so a late `stored` update cannot re-fire it. One case never
  // clears it: when the cache, the URL and the server all already agree, the persistence effect
  // below has nothing to write and returns before reaching the clear — so this lingers for the
  // life of the mount, and it can still fire LATER. The effect's first two guards require it to
  // equal both `resolved` and `workspaceSlug`, so it can only ever write the workspace it already
  // names — but `stored` moves underneath it, so that write is NOT always a no-op. Deep link
  // `/acme` with the cache agreeing, navigate to `beta`, a late GET answers `mine`, navigate back
  // to `acme`: one PUT `{acme}` fires on the return. That is correct, not a leak. Arriving on
  // `/acme` is an explicit act, this field is the record of it, and the deferred write is allowed
  // to land later than the arrival that earned it — the round-3 fix (clear AFTER the
  // `resolved === stored` skip, see the persistence effect) exists precisely so a late `stored`
  // can still act on that record. Round 2's shorthand "history navigations do not persist" was
  // only ever "never persist a slug we GUESSED"; navigating back onto a slug the user themselves
  // arrived on still carries that record. Leave it — clearing it here too would need its own
  // guard against the exact race this field exists to prevent.
  const [pendingWrite, setPendingWrite] = useState<string | null>(() => workspaceSlug ?? null)
  // Whether this mount has already recorded a choice locally. A read must never overwrite a
  // write: the GET below was issued before that choice existed, so its answer is older than what
  // is on disk, and rolling it back is only ever discovered later — when the cache is consulted
  // because a LATER request failed, which is the one moment nothing can correct it. A ref rather
  // than state because the GET's `.then` closes over a mount-once effect: a state value read
  // there would be the one captured at mount, i.e. always `false`.
  const wroteLocally = useRef(false)

  useEffect(() => {
    let alive = true
    // A hung request must not hold the route hostage. Five seconds is far longer than this call
    // ever legitimately takes, and timing out only costs the seed its preference — nothing is
    // persisted from a seed (see `pendingWrite` above), so a late answer can never be overwritten
    // by a guess.
    const bail = setTimeout(() => {
      if (alive) setPrefsSettled(true)
    }, 5000)
    workspacePrefsApi
      .get()
      .then((prefs) => {
        if (!alive) return
        clearTimeout(bail)
        // Mirror the row we just READ, unless this mount has since recorded a choice of its own.
        // The cache's only remaining job is to answer when the server cannot (a rejection, or the
        // bail above), and it can only do that if a successful read warms it — otherwise a user
        // who never switches workspace on this browser keeps a cold cache forever, and the one
        // time the request fails they land on a workspace they did not choose. But this answer
        // predates any local write, so it must never overwrite one: rolling the cache back to a
        // pre-PUT row is invisible until the cache is next CONSULTED, and it is only consulted
        // when a later read fails — the one moment no successful read can correct it. `stored` is
        // gated for the same reason and is safe to gate: a local write requires the URL to name a
        // workspace already (the persistence effect below demands `resolved === workspaceSlug`),
        // so no local write can precede the seed path, and after one `stored` already holds the
        // fresher slug the write itself put there.
        //
        // Deliberately UNVALIDATED, unlike every other writer here: a row naming a workspace the
        // user can no longer reach caches a dead slug, which `known()` rejects at resolution, so
        // it is inert until the next switch replaces it. Validating here instead would be worse —
        // this runs when the GET settles, which may be before the workspace list has landed, so a
        // `known()` check would silently drop a legitimate preference whenever the parallel
        // request was slower. One validation point, at resolution, is the property worth keeping.
        if (prefs.slug && !wroteLocally.current) {
          setStored(prefs.slug)
          writeCachedWorkspace(prefs.slug)
        }
        setPrefsSettled(true)
      })
      .catch(() => {
        // Silent: the cache still carries a choice, and the next switch re-writes the row.
        if (alive) {
          clearTimeout(bail)
          setPrefsSettled(true)
        }
      })
    return () => {
      alive = false
      clearTimeout(bail)
    }
  }, [])

  const resolved: string | null | undefined = useMemo(() => {
    if (workspaces === null) return undefined
    const known = (s: string | null | undefined): string | null =>
      s && workspaces.some((w) => w.slug === s) ? s : null
    // A slug in the URL is a live instruction — a deep link, a pick, the back button — and it
    // decides on its own.
    const fromUrl = known(workspaceSlug)
    if (fromUrl) return fromUrl
    // Nothing usable in the URL, so one has to be seeded. It must NOT be seeded before the
    // preference request settles: the seed goes straight into the URL, where it outranks the
    // server's answer arriving a moment later, and the personal-workspace fallback would then be
    // persisted over the row the user actually chose on another site. The localStorage cache does
    // not shorten this wait — a cache written on another device is exactly what the server row
    // exists to correct.
    if (!prefsSettled) return undefined
    return known(stored) ?? workspaces[0]?.slug ?? null
  }, [workspaces, workspaceSlug, stored, prefsSettled])

  // The URL is live truth. A stale or absent slug lands somewhere real rather than nowhere.
  useEffect(() => {
    if (resolved && resolved !== workspaceSlug) {
      router.replace(hrefFor(resolved), { scroll: false })
    }
  }, [resolved, workspaceSlug, hrefFor, router])

  // Persist only where we actually LANDED (the URL and the resolution agree), and only for a slug
  // the user asked for by name — never a slug that was merely seeded. Deriving "should I persist
  // this?" from `resolved` alone cannot tell a chosen slug from a guessed one, because the guess
  // goes straight into the URL and one render later the two are indistinguishable — that
  // confusion is what let a failed or slow prefs read destroy a real stored preference.
  // `pendingWrite` tracks the explicit act directly; keying this on the settled pair on top of it
  // is what keeps one pick to one write: mid-push `resolved` still reads the old slug, and an
  // effect that fired then would write the old choice back over the new one.
  //
  // Clear `pendingWrite` AFTER the `resolved === stored` skip, not before. Clearing it first loses
  // an explicit deep link whenever the cache already agrees but the server does not: cache "acme",
  // URL "/acme", server row "mine". If the list settles before the prefs GET, `resolved ===
  // stored ("acme")` short-circuits on this first pass — but a too-early clear has already thrown
  // `pendingWrite` away, so when the GET later answers "mine" and `stored` changes, there is
  // nothing left for the guard above to match and the PUT the user's own deep link asked for never
  // happens. Clearing after the skip leaves `pendingWrite` intact for exactly that later pass. A
  // pass that DOES write still clears it on the same tick as the write, so a late `setStored`
  // finds it already gone — the double-write `pendingWrite` exists to prevent is unaffected.
  useEffect(() => {
    if (!resolved || resolved !== workspaceSlug || pendingWrite !== resolved) return
    if (resolved === stored) return
    setPendingWrite(null)
    // A slug the host says is not cross-site preference material (the hub's teams) navigates like
    // any other and is simply not remembered: the record of the explicit act is consumed above, so
    // this cannot re-fire, and the preference already on disk — a workspace every site CAN scope
    // to — is left exactly as it was.
    if (canPersist && !canPersist(resolved)) return
    // Before the writes, so the prefs GET's `.then` — which may run at any point after this —
    // knows its answer is now older than what is on disk and declines to mirror over it.
    wroteLocally.current = true
    writeCachedWorkspace(resolved)
    setStored(resolved)
    workspacePrefsApi.put({ slug: resolved }).catch(() => {
      // Silent, deliberately: the URL and the cache already carry the choice.
    })
  }, [resolved, workspaceSlug, stored, pendingWrite, canPersist])

  const onSelect = useCallback(
    (slug: string) => {
      // Record the explicit act before navigating, so the persistence effect above can tell this
      // pick apart from a seeded guess once the URL catches up.
      setPendingWrite(slug)
      // Navigate only otherwise. The effect above persists once the URL lands. Persisting here as
      // well would double-write, and setting `stored` here would make `resolved` disagree with the
      // URL for a render — which is exactly how the old code wrote the OLD slug back over the new
      // one.
      // Drops any deeper path — the same thing the workspaces TopicLevel did before this hook.
      router.push(hrefFor(slug), { scroll: false })
    },
    [hrefFor, router],
  )

  return { resolved, onSelect }
}
