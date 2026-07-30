import type { GraphNode } from '@agentic-toolkit/adh/concepts'

// Unified chart geometry. The WHOLE chart — the breadcrumb row plus the radial
// graph — lives in ONE square coordinate space (0..100 on both axes). Because the
// SVG edge-lines and the percentage-positioned nodes share that space, a single
// node can animate continuously between a breadcrumb slot and the radial graph,
// and an edge stays glued to its endpoints as they move. Pure + deterministic, so
// the chart server-renders and hydrates without a layout mismatch.

/** Centre of the focused node — also the hub the child spokes radiate from. Sits
 *  in the upper portion of the square so the breadcrumb row can live below it. */
export const FOCUS_X = 50
export const FOCUS_Y = 42
/** Breadcrumb row: a horizontally-centred row of half-scale replicas BELOW the
 *  main diagram (near the bottom of the square). */
export const CRUMB_Y = 91
const CRUMB_STEP = 12
/** Child-ring radius. Square space ⇒ this renders as a true circle. */
const RING_RADIUS = 30
/** Mini fan radius. Sized so MINI_RADIUS ÷ crumb-orb-diameter ≈ RING_RADIUS ÷
 *  centre-orb-diameter — i.e. the children sit as far out, proportionally, as in
 *  the full expansion (with the fixed breadcrumb orb base from the CSS). */
const MINI_RADIUS = 4.3
/** First spoke points straight up (12 o'clock), then clockwise. Used by the mini
 *  crumb fans. */
const START_ANGLE_DEG = -90
/** The parent ("back") orb sits to the LEFT of the focus (180° = 9 o'clock); the
 *  info-panel line drops straight DOWN (90° = 6 o'clock). When a parent is present
 *  the children fan the whole ring EXCEPT a wedge reserved for the parent (left)
 *  plus a small notch right at straight-down. A child MAY overlap the panel line,
 *  but must never sit DIRECTLY below the focus — there its spoke would be drawn
 *  entirely on top of the panel line. Crowded rings overlap — a data-shape call
 *  upstream. */
const PARENT_ANGLE_DEG = 180
const PANEL_ANGLE_DEG = 90
const PARENT_GAP_DEG = 60
// Just wide enough to keep a child off the exact straight-down line (so its spoke
// is never collinear with the panel line); children may still come close + overlap.
const PANEL_GAP_DEG = 10

/** The parent orb's spot — straight LEFT of the focus, one ring-radius away, so
 *  "back" reads as moving left rather than up. */
export function parentSpot(): { x: number; y: number } {
  return { x: FOCUS_X - RING_RADIUS, y: FOCUS_Y }
}

export interface Placed {
  node: GraphNode
  /** Centre of the node as a percentage of the (square) chart. */
  xPct: number
  yPct: number
}

/** Lay the ancestor crumbs out as a horizontally-centred row near the bottom. */
export function placeCrumbs(ancestors: GraphNode[]): Placed[] {
  const x0 = FOCUS_X - ((ancestors.length - 1) * CRUMB_STEP) / 2
  return ancestors.map((node, i) => ({
    node,
    xPct: x0 + i * CRUMB_STEP,
    yPct: CRUMB_Y,
  }))
}

/** Place the focused node's ring nodes around the centre.
 *
 *  - `reserveParent = false` (root, no parent orb): EVEN full-circle 360/n spacing,
 *    rotated so straight-DOWN is a gap (the info-panel line's lane). A lone child
 *    is nudged off the vertical so it never sits straight up.
 *  - `reserveParent = true` (a parent orb sits to the LEFT): children fan the whole
 *    ring except the parent wedge (left) and a small straight-down notch — so they
 *    may sit at the bottom and overlap the panel line, just never directly below
 *    it. Walk the open arc clockwise from just past the parent wedge, skipping the
 *    straight-down notch mid-walk. */
export function placeChildren(kids: GraphNode[], reserveParent = false): Placed[] {
  const n = kids.length
  const place = (node: GraphNode, angleDeg: number): Placed => {
    const a = (angleDeg * Math.PI) / 180
    return {
      node,
      xPct: FOCUS_X + Math.cos(a) * RING_RADIUS,
      yPct: FOCUS_Y + Math.sin(a) * RING_RADIUS,
    }
  }
  if (!reserveParent) {
    return kids.map((node, i) =>
      place(node, n === 1 ? -50 : 90 + (360 / n) * (i + 0.5)),
    )
  }
  // Open arc = full ring minus the parent wedge minus the straight-down notch.
  // Walk it clockwise from the parent wedge's upper edge; once the walk reaches the
  // notch's near edge, jump the notch so no child lands directly below the focus.
  const start = PARENT_ANGLE_DEG + PARENT_GAP_DEG / 2
  const beforeNotch = PANEL_ANGLE_DEG + 360 - PANEL_GAP_DEG / 2 - start
  const avail = 360 - PARENT_GAP_DEG - PANEL_GAP_DEG
  return kids.map((node, i) => {
    const t = (avail * (i + 0.5)) / n
    const angleDeg = t <= beforeNotch ? start + t : start + t + PANEL_GAP_DEG
    return place(node, angleDeg)
  })
}

/** A breadcrumb is a scaled-down *replica* of a node's own expanded state: the
 *  crumb orb with ALL its children fanned around it (textless dots) at the SAME
 *  angles they hold when expanded, just at a small radius. The child the path
 *  runs through is kept too — the caller anchors the outgoing trail line on it. */
export function placeCrumbChildren(crumb: Placed, children: GraphNode[]): Placed[] {
  const n = children.length
  return children.map((node, i) => {
    const angleDeg = START_ANGLE_DEG + (360 / Math.max(n, 1)) * i
    const a = (angleDeg * Math.PI) / 180
    return {
      node,
      xPct: crumb.xPct + Math.cos(a) * MINI_RADIUS,
      yPct: crumb.yPct + Math.sin(a) * MINI_RADIUS,
    }
  })
}

/** Find a node by id within a (slim) graph tree. */
export function findGraphNode(root: GraphNode, id: string): GraphNode | null {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = findGraphNode(child, id)
    if (found) return found
  }
  return null
}

/** Root → node inclusive chain (the breadcrumb). Returns [root] if id is absent. */
export function graphChain(root: GraphNode, id: string): GraphNode[] {
  const path: GraphNode[] = []
  const dfs = (n: GraphNode): boolean => {
    path.push(n)
    if (n.id === id) return true
    for (const child of n.children) {
      if (dfs(child)) return true
    }
    path.pop()
    return false
  }
  dfs(root)
  return path.length ? path : [root]
}
