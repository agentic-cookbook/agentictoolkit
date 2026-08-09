'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { workspacePrefsApi, readCachedWorkspace, writeCachedWorkspace } from '@agentic-toolkit/data'
import type { WorkspaceOption } from './WorkspaceOption'

/**
 * The slug this hook last wrote into the URL itself, i.e. a SEED rather than anyone's instruction.
 *
 * Module scope, and that is the whole point: the write it records crosses a route boundary. A
 * site's bare `/home` and its `/<workspace>` are two different Next routes, so the seeding replace
 * below unmounts this hook and mounts a fresh one — every ref and every piece of state gone. The
 * new mount then reads that seeded slug out of the URL, and with nothing surviving the boundary it
 * would have no way to tell this hook's own guess apart from a link the user followed. A module
 * variable is the one thing that does survive, because it lives in the client bundle rather than
 * in the tree.
 *
 * ONE-SHOT: the mount that reads it clears it (see the consume effect below), so it can only ever
 * excuse the single hop it was written for. Leaving it set would make it a standing claim about
 * a slug rather than about one navigation — arriving on `/acme` from a link, later in the same
 * page session, would then be mistaken for this hook's own old guess and never persisted. A full
 * page load resets it too, which is the same rule from the other end: arriving at `/acme` from
 * outside IS an arrival. Nothing else may set it — an explicit pick goes through `onSelect`,
 * which clears it.
 *
 * TWO things enforce the one-shot, because the mount the marker is written for is not guaranteed
 * to arrive. `router.replace` can be superseded — the visitor clicks a link, or hits Back, while
 * the transition is still in flight — and then there is no arrival to consume anything, so the
 * marker outlives its hop with nothing to end it:
 *
 *   - EVERY mount consumes it, not only the one that matches. A mount that arrived somewhere else
 *     is proof the hop the marker describes is over.
 *   - It EXPIRES. The clicked-away case may mount this hook nowhere at all before the visitor
 *     navigates back to that same slug themselves, minutes later — an arrival by any honest
 *     reading, which the stale marker would silently refuse to persist. The handoff it has to
 *     survive is one client route transition, so the window only needs to be longer than that.
 */
let seededByUs: { slug: string; at: number } | null = null

/** How long a seed marker may sit unconsumed. A client route transition is sub-second; ten seconds
 *  is generous for one and short for a person, which is the whole of the reasoning. At the far end
 *  a transition slower than this persists a workspace the visitor is already looking at, and only
 *  when nothing was stored to begin with — the same outcome as the prefs GET timing out. */
const SEED_HANDOFF_MS = 10_000

/** Reset the seed marker, i.e. simulate the fresh page load that resets it in a browser. Tests
 *  only — a module variable outlives a test's unmount, so without this the seed one case wrote
 *  would be read back by the next case's mount as if that case had seeded it. */
export function __resetSeededWorkspace(): void {
  seededByUs = null
}

/**
 * Carry the current URL's query and hash onto the seeded destination.
 *
 * The seeding replace repairs a URL that names no workspace, and `/home` is the one address the
 * whole family hands out — the header's Home link, the SSO return target, the registry's
 * post-login landing, any campaign-tagged share of it. Everything after the path on that URL is
 * the caller's, not the segment's, and rebuilding the destination from the slug alone dropped it
 * without a trace. `marketingNextConfig`'s legacy redirects preserve it (Next redirects do), so
 * the loss showed up as the old URL shape working where the new one did not.
 *
 * Appended only to a destination that carries neither of its own: `hrefFor` belongs to the caller,
 * and a caller that has already said something about the query or the fragment has said it about
 * the workspace it is naming, which is more specific than the address we are leaving.
 *
 * An explicit switch is deliberately NOT routed through here. That path has `switchHrefFor`, whose
 * whole job is deciding what carries over, and what a destination workspace can honour is the
 * caller's fact rather than this hook's.
 */
function withUrlExtras(href: string): string {
  if (typeof window === 'undefined') return href
  if (href.includes('?') || href.includes('#')) return href
  return href + window.location.search + window.location.hash
}

/**
 * Which workspace this URL means, and how picking another one is remembered.
 *
 * Extracted from SiteHomeShell so the hub can mount the same behaviour: it lists rows (teams) the
 * feature sites' client drops, and grants some of them fewer topics than others — differences that
 * are entirely expressed by `workspaces` and `canPersist`. (`hrefFor` used to carry a third: the
 * hub's workspace sat at `/<slug>/home`. It is the bare `/<slug>` now, like every other site's, so
 * the hub passes what the shell would have.) The resolution order, the write-ordering guards and
 * the races they exist for are NOT duplicated: this is the one copy.
 *
 * What it owns:
 *   - Resolution: a slug already in the URL decides on its own. Otherwise it seeds one — but only
 *     once workspacePrefsApi.get() has settled, so a first visit with an empty localStorage cannot
 *     write a personal-workspace guess into the URL and permanently outrank the server's real
 *     answer. Once seeding is allowed: the stored preference → the first row of `workspaces`
 *     (the caller's list is priority-ordered, personal first, so this costs no extra call).
 *   - The URL as live truth, for an ABSENT slug only: replace to `hrefFor(resolved)`. That is what
 *     makes a site's bare `/home` a redirect rather than a page of its own — it mounts with no
 *     segment, and the first thing this does is send the browser to the resolved workspace. A slug
 *     that is present but names none of `workspaces` is NOT repaired: resolution stays `undefined`
 *     and the caller decides (the shared shell 404s it). See the `resolved` memo for why.
 *   - Persistence, but only of an EXPLICIT act (see `pendingWrite`), and only of a slug the caller
 *     says may be persisted — and never of a slug it merely SEEDED (see `seededByUs`, which is
 *     how the mount the seeding redirect lands on still knows the slug was a guess).
 *
 * `hrefFor` and `canPersist` are effect dependencies: pass stable identities (module scope, or
 * useCallback) or the effects re-run on every render. Re-running is guarded and harmless — the
 * writes are keyed on `pendingWrite`, which a completed write clears — but it is wasted work.
 */
export function useWorkspaceRoute({
  workspaces,
  workspaceSlug,
  hrefFor,
  switchHrefFor,
  canPersist,
}: {
  /** The caller's workspaces, or null while the list is still loading. */
  workspaces: readonly WorkspaceOption[] | null
  /** The workspace segment as it stands in the URL, if any. */
  workspaceSlug?: string
  /** Where a workspace lives on this host. */
  hrefFor: (slug: string) => string
  /** Where an EXPLICIT switch to `slug` should land — the hook's one hook for CARRYING the current
   *  selection across the switch. Defaults to `hrefFor`, i.e. the bare workspace.
   *
   *  Separate from `hrefFor` rather than folded into it, because the two answer different
   *  questions. `hrefFor` says where a workspace LIVES, and it is what the seeding replace above
   *  uses: that replace repairs a URL that names NO workspace, and nothing about the path it is
   *  repairing is a selection the user made HERE. (It no longer repairs an unreachable slug —
   *  that is a 404 now, see the `resolved` memo.) `switchHrefFor` says where
   *  a user who is looking at something and picks another workspace should land, which is the only
   *  case with a selection to preserve at all.
   *
   *  The trimming is the caller's, and has to be: what the destination can honour is a fact about
   *  that host's URL grammar (which segments are features, which are entity ids) and about the
   *  destination workspace itself, neither of which this hook knows. Effect-dependency rules match
   *  `hrefFor` — pass a stable identity. */
  switchHrefFor?: (slug: string) => string
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
  //
  // Seeded from the URL — but NOT when the slug in that URL is the one this hook just put there
  // (`seededByUs`). Without that exclusion the guard above is defeated by the very redirect it is
  // written around: `/home` seeds a workspace, replaces the URL, and the route change remounts this
  // hook, which reads its own guess back as if the user had typed it. A cold localStorage plus a
  // slow prefs GET would then PUT the personal-workspace fallback over the row the user actually
  // chose — the exact destruction `pendingWrite` exists to prevent, arrived at one hop later.
  const arrivedOnOwnGuess = useRef(
    workspaceSlug !== undefined &&
      seededByUs !== null &&
      workspaceSlug === seededByUs.slug &&
      Date.now() - seededByUs.at <= SEED_HANDOFF_MS,
  )
  const [pendingWrite, setPendingWrite] = useState<string | null>(() =>
    arrivedOnOwnGuess.current ? null : (workspaceSlug ?? null),
  )
  // Consume the marker: it excuses the hop that just happened and nothing after it. Done in an
  // effect, not in the render body, so a discarded render cannot spend it.
  //
  // UNCONDITIONAL, and that is the fix for a marker whose arrival never comes: a mount is a mount
  // whether or not it landed on the seeded slug, and either way the hop the marker describes is
  // finished. Clearing only on a match left a superseded replace's marker standing for the life of
  // the tab, so a later deliberate navigation onto that same slug read as this hook's own old
  // guess and was never persisted. This runs after the render that read it (`arrivedOnOwnGuess`),
  // and before the seeding effect below can write a new one, so the marker a mount writes is never
  // the marker it consumes.
  useEffect(() => {
    seededByUs = null
  }, [])
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
    // decides on its own. `known` is what makes it an instruction rather than an assertion: it is
    // honoured only if it names one of these workspaces.
    const fromUrl = known(workspaceSlug)
    // Including a slug this hook itself seeded a hop ago: a guess that has reached the URL is what
    // the user is looking at, and a late preference answer moving them off it would be a page that
    // reshuffles itself under a cursor. `seededByUs` deliberately buys ONE thing only — the right
    // not to PUT that guess back (see `pendingWrite`) — so the guess is displayed and never
    // recorded, and the next visit reads the untouched server row.
    if (fromUrl) return fromUrl
    // A slug that IS in the URL but names none of them stays UNRESOLVED. This hook does not repair
    // it, and the seeding below is deliberately out of reach here.
    //
    // Repairing it is what made `/<anything>` a silent redirect to the visitor's own workspace: a
    // renamed or deleted workspace's links, and links to a workspace the visitor is not in, all
    // became a different page with the address bar quietly rewritten to match — and because the
    // workspace is the FIRST path segment on all 38 sites, `not-found.tsx` could never fire for a
    // one-segment path anywhere in the family. The hub never had that behaviour: its
    // WorkspaceGate (`MemberGate`) answers a settled list with no match by calling `notFound()`,
    // and this is the family catching up to it rather than a new rule.
    //
    // Returning `undefined` — "not decided" — rather than deciding here, because what an
    // unreachable slug MEANS is the caller's: the shared shell 404s it once its list has settled,
    // and it must not do that while the list is still loading. The one slug that is still seeded
    // is the ABSENT one: a site's bare `/home` names no workspace and is the family's redirect
    // signal, which is exactly the case the block below exists for.
    if (workspaceSlug !== undefined) return undefined
    // Nothing usable in the URL, so one has to be seeded. It must NOT be seeded before the
    // preference request settles: the seed goes straight into the URL, where it outranks the
    // server's answer arriving a moment later, and the personal-workspace fallback would then be
    // persisted over the row the user actually chose on another site. The localStorage cache does
    // not shorten this wait — a cache written on another device is exactly what the server row
    // exists to correct.
    if (!prefsSettled) return undefined
    return known(stored) ?? workspaces[0]?.slug ?? null
  }, [workspaces, workspaceSlug, stored, prefsSettled])

  // The URL is live truth for the slug it is MISSING: an absent one lands somewhere real rather
  // than nowhere. An unreachable one never reaches here — `resolved` stays `undefined` for it, so
  // this effect's guard is false and no replace is issued. That is the whole of "a bad slug is not
  // silently rewritten"; the 404 itself is the caller's (SiteHomeShell).
  useEffect(() => {
    if (resolved && resolved !== workspaceSlug) {
      // Record the write BEFORE it happens: this replace may unmount the hook (a site's `/home` and
      // its `/<workspace>` are two routes), so anything set afterwards would never run. Every
      // replace from here is seed-driven — an explicit pick navigates through `onSelect`, which
      // pushes — so marking unconditionally is the whole rule, with no case to get wrong.
      seededByUs = { slug: resolved, at: Date.now() }
      router.replace(withUrlExtras(hrefFor(resolved)), { scroll: false })
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
      // pick apart from a seeded guess once the URL catches up. Clearing the seed marker is the
      // same statement made to the NEXT mount: whatever this hook guessed earlier, the slug about
      // to be in the URL is the user's own.
      seededByUs = null
      setPendingWrite(slug)
      // Navigate only otherwise. The effect above persists once the URL lands. Persisting here as
      // well would double-write, and setting `stored` here would make `resolved` disagree with the
      // URL for a render — which is exactly how the old code wrote the OLD slug back over the new
      // one.
      //
      // `switchHrefFor` is what CARRIES the current selection over (see its doc above): the
      // selected path in this platform is the URL's own segments, so preserving it across a switch
      // is preserving those segments under the new workspace. Without one this drops any deeper
      // path and lands on the bare workspace — the behaviour every caller had before, and still
      // the right answer for a host that cannot say what its destination honours.
      router.push((switchHrefFor ?? hrefFor)(slug), { scroll: false })
    },
    [hrefFor, switchHrefFor, router],
  )

  return { resolved, onSelect }
}
