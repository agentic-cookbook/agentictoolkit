# HMDV cascade — architecture review (2026-07-20)

Requested by Mike after the 1.15.x rounds ("take a step back and do an architectural review —
clearly you're flailing around and making it worse"). Scope: the cascading disclosure style of
`hierarchical-menu-detail.tsx` (~3,300 lines), `cascade-rules.ts`, the spec
(`recipes/hierarchical-topic-detail.md` 1.15.2), and the hub's wiring (`WorkspaceShell`,
`WorkspaceHome`, the chrome-published feature levels).

## Verdict

The spec's interaction contract is a **tiny state machine** — the menus change disclosure on
exactly three events («» toggle, pointer leaves the blue frame, final choice) — but the
implementation never *stores* that state. It **re-derives the menu geometry on every render**
from ~12 inputs (autoHide, pins, real frontier, width pressure, off-screen count, the frozen
`heldCover` triple, `pointerInMenus`, `hoverId`/`hoverAll`, immersion, container width), and then
bolts on freeze after freeze to stop the derivation from moving things at the wrong moment.
Every regression round added another freeze:

| Round | Symptom | Freeze added |
|---|---|---|
| ground jump | root/detail resized on click | `groundRight` latch (`mayMoveGround`) |
| cascade slid left | covering recomputed mid-gesture | `heldCover` pressure/hidden freeze |
| 1.15.1 "menu still collapses on click" | frontier advance covered the clicked list | frozen-frontier ratchet (`ratchetFrozenFrontier` + `coverFrontierWhileChoosing`) |
| 1.15.1 re-open after collapse | first pixel of movement re-disclosed | entry-gated trigger (`triggerFires`) |
| 1.15.2 "still moved" (real mouse) | null region read as "outside" during remount | evidence clause (`pointerInMenusAfterMove`) |
| 1.15.2 "can't unselect root" | entry gating left covered rows unreachable | covered-column `onPointerEnter` |

Six freeze mechanisms, each with its own release edges, spread over two module-scope stores
(`surfaceStates`: 9 fields; `cascadeMemory`: 5 fields) plus per-stack component state, shared by
two different host components (`WorkspaceHome` and `WorkspaceShell` both root at `"workspaces"`).
The freezes now interact with each other and with Next's route-remount, and no file states the
invariants between them. That is why each fix regresses a neighboring path: the architecture makes
"menus never move on a click" an *emergent* property of six cooperating interceptors instead of a
*structural* one. (Principles: this is derived state where the spec calls for stored state —
`explicit-over-implicit` — and interleaved concerns — `simplicity`, `srp`.)

## The live regressions, precisely

### A. "Unselect doesn't work" / phantom re-selection — the hold never releases upward

Code-provable. The 1.15.0 detail hold arms on **every** rail interaction — the cascade's select
wrapper and the ✕ both call `holdDetailForChoice()` before navigating, including for a **clear**
(`planRailSelect` → `action: "clear"`). But the release (`planChoiceSettle`) fires only when
`pathComplete && selectionChanged`, confirmed across two renders. An unselect makes the path
*incomplete by definition, and it stays incomplete* — so the hold **never releases**:

1. On `/[slug]/personas`, re-click "My Workspace" → hold captures the personas pane → navigate
   `/home`.
2. `/home`'s frontier is unselected → `showHeld` → the **stale personas content** renders in the
   detail slot instead of the workspaces overview — indefinitely.
3. It follows you: click a workspace → `/[slug]/home` → features frontier unselected → still held,
   still the personas pane. The haunt ends only when some later gesture completes a full path.

From the user's chair: "I unselected and nothing changed" (the pane is the thing you look at), and
the old feature's content re-appearing after navigation reads as the app **re-selecting it**.
No code path actually auto-selects — no hub level sets `defaultSelectedId`, `/home` is a real
landing with no redirect, `PersonasRoute` has no selection effect — the phantom is the
never-released hold. Root cause: the hold models *every* gesture as "drilling toward a final
choice"; **up-navigation and abandoned gestures have no release edge**. That was my
over-generalization of the 1.15.0 dictation (which was about intermediate *downward* selects not
flashing the landing), not something the spec asked for.

Two aggravators on the same path:

- **`exitBranch` runs before the navigation**: a clear plays the staggered collapse
  (~`EXIT_MS + n·70ms + 80ms` ≈ half a second) *before* `onClear` pushes the route. A clear whose
  visible effect (the pane) then *doesn't change* (because of the hold) reads as a dead click.
- **`WorkspaceShell` preserves the active feature across a workspace switch**
  (`onSelect: router.push(\`/${slug}/${activeFeature ?? "home"}\`)`): clicking "Temporal" while on
  `…/personas` lands on `/temporal/personas` — Personas arrives pre-selected in the new
  workspace. That is deliberate hub behavior predating this branch, but under the standing rule
  "auto-select never happens unless a default is set" it needs Mike's explicit ruling: keep
  (it's a navigation continuity feature) or drop to `/[slug]/home`.

### B. "Menus still move" — containment inference has more windows than the one I closed

The 1.15.2 evidence clause covers the **nothing-measurable** window (null region → keep the last
answer). There is at least one more window, and it is open right now: **mid-animation geometry**.
The entrance bounces a menu through `scale(0→1.1→…)` for 460ms and the staggered exits scale
down for ~300ms each; `getBoundingClientRect` during a scale animation reports the *scaled* box.
The pointer authority hit-tests every `pointermove` against the union of what is painted *at that
instant* — so while any box is mid-flight the union is contracted, and a real hand's inevitable
pixel of drift can test "provably outside", flip `pointerInMenus` false, and release **every**
hold at once (ground, covering freeze, reveal): the menus move on the very click. Synthetic input
never moves during the animation window, which is exactly why each round verified clean under CDP
and failed under Mike's mouse.

The lesson is not "add a third clause". Three generations of patch (read the region fresh from
the DOM; a click writes `pointerInMenus = true`; null keeps the previous answer) each closed one
window. **Deriving a boolean from an event stream raced against remounts and live animations is
the defect class**; there will always be another window behind the last one.

(Note on "no change": if the testing tab was an SPA session opened before the deploy, it was still
running the previous bundle — Next only picks up new chunks on a document load. But nothing in
this review leans on that: A is present in 1.15.2 as shipped, and B's class is unfixable
point-wise, so the report is consistent with the deployed code either way.)

## Why patching cannot converge

1. **Openness is derived, not stored** — the contract's two modes (fanned / collapsed) exist
   nowhere as a value; they are re-inferred every render and defended by interceptors.
2. **The final choice is inferred retrospectively** — nothing tells the component whether a row
   leads to another list, so it watches renders ("path complete + selection changed, twice in a
   row") and needed `heldSig`/`heldMoved`/`heldSettleArmed` plus a two-render confirmation
   (merged stacks register levels from `children` effects a commit late). And it still has no
   answer for gestures that never complete (regression A).
3. **Pointer containment is stream inference** raced against remounts and animations (regression
   B's class).
4. **State is scattered**: two module stores + component state, shared by two host components,
   with cross-field invariants enforced nowhere.
5. **One 3,300-line file, four layouts**, with the covering rules "ported verbatim" into the
   cascade and diverging since.

## Proposed architecture

Principle: **while the user is interacting, the cascade is an overlay; base geometry is
recomputed only at settle points.** Menus never move mid-gesture because *nothing recomputes* —
not because six freezes intercept the recomputation.

1. **One stored state machine per surface.** `mode: "fanned" | "collapsed"` (+ `immersed`), in
   ONE typed surface store outside React. Transitions are exactly the spec's events: «» toggle;
   pointer leaves the blue frame → collapsed; pointer enters the trigger lane / a peek → fanned;
   final choice → collapsed (auto-hide mode only). **A click is not a transition** — so no click
   can move the menus, structurally. Geometry is a pure function of (mode, levels, widths).
   *Deletes:* `heldCover`, the frozen-frontier ratchet/retreat, the blind-root cleanup,
   `hoverAll`/`groupStart` reveal rooting (the reveal *is* `mode: "fanned"`), the ground latch as
   a separate mechanism (the ground recomputes on transitions only), and `triggerFires` entry
   gating (enter → fanned is idempotent).

2. **The host declares leafness.** Add it to `TopicLevel` (per item `leadsTo: "list" | "detail"`,
   or per level `leaf: true`). The hub *knows* this — a workspace row opens the features list, a
   feature row opens its entity list, a persona row opens the detail; it is a fact of the data,
   not a runtime discovery. Then the final choice is **known at click time**.
   *Deletes:* `planChoiceSettle`, the two-render confirmation, `heldSig`/`heldMoved`/
   `heldSettleArmed`. The detail hold becomes three lines of policy: non-leaf select → keep
   showing what is showing; leaf select → the one swap; **clear/✕/breadcrumb → release
   immediately** and show the real frontier state (fixes A — up-navigation is not a choosing
   gesture).

3. **Containment as an idempotent query, not stream inference.** The document-level `pointermove`
   handler only records the last (x, y) — zero derivation. "Is the pointer in the menus?" is
   evaluated at the moments the state machine needs an answer (a candidate pointer-exit
   transition, after paint), against **settled** target geometry — the resting rects the layout
   model already assigns (`left`/`top`/`width`), never `getBoundingClientRect` of an animating
   box. An unanswerable query is simply not a transition. This closes the null-region window AND
   the scaled-rect window for good, because animation state can no longer feed the decision
   (fixes B's class).

4. **One store, named transitions.** Merge `surfaceStates` + `cascadeMemory` into one
   `SurfaceStore` with methods (`fan(reason)`, `collapse(reason)`, `holdDetail()`,
   `releaseDetail(reason)`…) so every invariant lives in one file and every write is a named,
   testable event — the same move that worked for `cascade-rules` (nothing pinned there ever
   regressed silently).

5. **Keep**: the named-rules module + vector tests (T57–T61 carry over as acceptance tests), the
   entrance/exit animations, connectors, narrow mode, «»/pins semantics, the overlay z-model.

Scope: the cascading path of the component plus the frame's hold logic; covered/minimized/narrow
untouched. Net LOC goes **down** — the six freeze mechanisms and the retrospective-settle
machinery are deleted, replaced by a small state-machine module.

## Recommendation

Stop patching 1.15.x; rebuild the cascade's interaction layer on the design above. If the rebuild
is deferred, regression A alone is worth a point fix now (add the missing release edge: clears
release the hold) — but B has **no** safe point fix, and the next symptom is already queued behind
whatever window the next patch closes.

Open rulings for Mike:
1. Rebuild vs. continue patching (recommendation: rebuild).
2. `WorkspaceShell`'s feature preservation on workspace switch (`/temporal/personas` when
   switching workspaces while in Personas): keep or drop?
3. Leafness declaration shape: per-item `leadsTo` vs. per-level `leaf`.
