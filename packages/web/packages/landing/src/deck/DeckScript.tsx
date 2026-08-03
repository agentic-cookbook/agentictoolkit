import type { ReactElement } from 'react'

/* Three things that must run before the first paint, and which no React
 * lifecycle is early enough to do — hence a literal inline <script> rather
 * than an effect. Early does NOT mean <head>: the tag belongs first inside
 * <body>, for the reason spelled out on `DeckScript` below. All three are
 * ported verbatim from the two sites that had their own copies of them; see
 * each constant. */

/* Every load starts at the hero. Without this the browser restores the last
 * scroll offset, and on iOS every pull-to-refresh IS a reload — so a reader
 * who pulled at the FAQ would land back at the FAQ, mid-section, with the
 * snap arming underneath them. */
const OPEN_AT_THE_TOP = `history.scrollRestoration="manual";`

/* Snapping is armed by the reader's FIRST input, not by load. The snap worth
 * avoiding is the one taken DURING load: a snap area picked while section
 * heights are still settling strands the reader between two screens, with no
 * scroll event ever having fired. Snapping has nothing to do until the reader
 * moves the page, so the surest way not to take that snap is not to be
 * snapping yet. Arming on first input also means the page is provably at rest
 * at a screen top when the property flips, so turning it on moves nothing. */
const ARM_SNAPPING = `["pointerdown","wheel","keydown"].forEach((e)=>addEventListener(e,()=>document.documentElement.setAttribute("data-snap",""),{once:true,passive:true}));`

/* Easing is armed by the same first input and DISARMED by a history traversal.
 * `scroll-behavior: smooth` (base.css) governs every programmatic scroll of
 * <html>, and the browser's own scroll RESTORATION is one of them — so a reader
 * coming back to a deck watched the page glide down to the offset they had
 * already been at, which says they travelled somewhere they never left.
 *
 * Clearing it on `popstate` makes the traversal instant without costing a
 * single real jump: every in-page jump is downstream of an input (a drawer has
 * to be opened before a row in it can be picked), so the next input arms it
 * again before there is anything to ease. This is the first `popstate` listener
 * on the page — the script runs before any framework hydrates — so the
 * attribute is gone before a router's own restoration runs.
 *
 * Not `{once:true}`, unlike the snapping above: that attribute is set once and
 * stays, this one has to come back after each traversal clears it. Setting an
 * attribute that is already set is a no-op, so the repeat costs nothing. */
const ARM_SMOOTH = `(function(){var d=document.documentElement;["pointerdown","wheel","keydown"].forEach(function(e){addEventListener(e,function(){d.setAttribute("data-smooth","")},{passive:true})});addEventListener("popstate",function(){d.removeAttribute("data-smooth")})})();`

/* `maximum-scale=1` is the only way to stop iOS Safari zooming the page when a
 * form field takes focus, and it also disables pinch-zoom — an accessibility
 * regression everywhere that hazard doesn't exist. So it ships in the meta tag
 * for iOS and is stripped back off on every other platform. */
const RESTORE_ZOOM_OFF_IOS = `(function(){if(/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1))return;var f=function(){var m=document.querySelector('meta[name=viewport]');if(m)m.setAttribute("content",m.getAttribute("content").replace(/,?\\s*maximum-scale=[^,]*/,""))};f();addEventListener("load",f)})();`

export interface DeckScriptOptions {
  /** Start every load at the top of the deck. Default true. */
  openAtTop?: boolean
  /** Promote <html> to `scroll-snap-type: y mandatory` on first input. Default true. */
  armSnapping?: boolean
  /**
   * Ease in-page jumps from the reader's first input, and never during a history
   * traversal. Default true. The other half of `html[data-smooth]` in base.css:
   * without this, that stylesheet eases nothing.
   */
  armSmooth?: boolean
  /** Strip `maximum-scale` from the viewport meta off iOS. Default true. */
  restoreZoomOffIos?: boolean
}

/** The script body, as a string — for a host that injects it its own way. */
export function deckScript(o: DeckScriptOptions = {}): string {
  const {
    openAtTop = true,
    armSnapping = true,
    armSmooth = true,
    restoreZoomOffIos = true,
  } = o
  return (
    (openAtTop ? OPEN_AT_THE_TOP : '') +
    (armSnapping ? ARM_SNAPPING : '') +
    (armSmooth ? ARM_SMOOTH : '') +
    (restoreZoomOffIos ? RESTORE_ZOOM_OFF_IOS : '')
  )
}

/**
 * Render first inside <body>, ahead of everything else — not inside <head>.
 * `RESTORE_ZOOM_OFF_IOS` calls `document.querySelector('meta[name=viewport]')`
 * immediately, and in <head> there is no guarantee that tag has been parsed
 * yet; it lands there via the framework's own `viewport` export, in an order
 * relative to a hand-rendered `<script>` that isn't ours to control. Placed
 * first in <body>, the meta tag it needs is already behind it. (The
 * `addEventListener("load", f)` fallback still catches a miss, but only at
 * `load` — a window during which non-iOS pinch-zoom stays disabled for
 * nothing.)
 *
 * Not a client component: this is a literal <script> tag with an inline body,
 * which is what makes it run before hydration — `useEffect` would be several
 * frames too late for all three.
 */
export function DeckScript(props: DeckScriptOptions): ReactElement {
  return <script dangerouslySetInnerHTML={{ __html: deckScript(props) }} />
}
