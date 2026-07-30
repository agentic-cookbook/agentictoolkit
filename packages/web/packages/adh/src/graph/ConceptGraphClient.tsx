'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
} from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  MotionConfig,
  useAnimationControls,
  usePresence,
  useMotionValue,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  Bell,
  Blocks,
  BookMarked,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChefHat,
  Contact,
  Cpu,
  CreditCard,
  Database,
  Fingerprint,
  FolderKanban,
  Globe,
  GraduationCap,
  Handshake,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Link2,
  MapPin,
  Megaphone,
  MessageSquare,
  Network,
  Newspaper,
  Package,
  Puzzle,
  School,
  ShoppingBag,
  Sun,
  UserRound,
  Users,
  Waypoints,
  Wrench,
} from 'lucide-react'
import { InfoPanel } from '@agentic-toolkit/ui/blocks/info-panel'
import { Checkbox } from '@agentic-toolkit/ui/components/checkbox'
import { TextBubble } from '@agentic-toolkit/ui/components/text-bubble'
import type { GraphNode } from '@agentic-toolkit/adh/concepts'
import { detectEnv, getSite, siteHeaderTitle, type SiteEnv, type SiteId } from '@agentic-toolkit/adh-registry'
// The generic mounted-hostname hook (same story as marketing/SiteWordmark): this once
// reached the toolkit's own header barrel to keep the app tier's registry-bound site menu
// out of the graph client chunk. One merged barrel now publishes both halves, so the
// package path here buys a separate `external` chunk rather than a smaller one.
import { useClientHost } from '@agentic-toolkit/adh/header'
import { FOCUS_X, FOCUS_Y, findGraphNode, graphChain, parentSpot, placeChildren } from './layout'

export interface ConceptGraphClientProps {
  /** Slim graph tree (labels + structure only — no detail prose). */
  tree: GraphNode
  /** Node the graph opens focused on (the site's node, or a `?focus=` deep-link). */
  initialFocusId: string
  /** Small mono eyebrow above the title (the site node's kicker). */
  eyebrow?: string
  /** Plain lead of the headline (e.g. "Agentic Developer"). */
  titleLead?: string
  /** The accented (gold, italic) site word(s) ending the headline. */
  titleAccent: string
  /** The site this landing is for — used to flag the matching card "You are Here". */
  currentSiteId?: SiteId
  /** Environment (resolved server-side from the host). In `production` the diagram is
   *  replaced by a centered "Coming soon" banner. */
  env?: SiteEnv
}

type Role = 'center' | 'child' | 'parent'

/** A placed orb. Its rendered position is `lerp(origin, to, progress)` every frame,
 *  where `origin` is the LAYER's shared collapse point (a MotionValue) — `deployFrom`
 *  while the layer is present, animated to `retractTo` as it exits — and `progress` is
 *  the layer's shared deploy value (0 = collapsed at origin, 1 = fully settled). Scale
 *  lerps `fromScale → toScale` on progress alone. */
interface OrbSpec {
  /** Stable per node id. */
  key: string
  node: GraphNode
  role: Role
  fromScale: number
  toX: number
  toY: number
  toScale: number
  z: number
  /** Children/parent ramp opacity with progress (bloom in / retract out); the centre
   *  stays opaque (visible even undisclosed) and fades only with the whole layer. */
  fade: boolean
  /** Steady-state opacity multiplier (1 = full). Used by the ancestor "back" stack so
   *  each orb deeper in the stack reads dimmer than the one in front of it. */
  dim?: number
}

/** A spoke/arrow. Each endpoint = `lerp(origin + endpointOffset, to, progress)`. A
 *  child spoke's HEAD offset is `−(childCentre − target)`, so its head equals
 *  `childCentre − constOffset` at EVERY frame (locked by construction, for any origin
 *  and progress). The tail offset is 0, so the tail tracks the moving centre. */
interface EdgeSpec {
  key: string
  off1X: number
  off1Y: number
  to1X: number
  to1Y: number
  off2X: number
  off2Y: number
  to2X: number
  to2Y: number
  /** Cap the head with the open-chevron arrowhead. */
  arrow: boolean
}

interface LayerSpecs {
  orbs: OrbSpec[]
  edges: EdgeSpec[]
  /** The centre orb (also `orbs[0]`) — exposed so the panel line can track it without
   *  relying on array order. */
  center: OrbSpec
  /** Widest ring-orb width (rem) for this focus's children — drives `--ring-orb-w`. */
  ringOrbWidthRem: number
}

// The line from the focus centre to the info panel extends just past the bottom of
// the (fixed) chart to meet the panel.
const PANEL_LINE_Y = 103.4

// The spine line runs FROM the parent ("back") orb on the LEFT into the active (focus)
// orb; the arrowhead stops short of the focus centre by this much (chart units) so it
// sits in the gap just left of the focus, pointing at it.
const FOCUS_ARROW_BACKOFF = 12

// Child-spoke arrowheads stop this far past the child orb's edge (chart units).
const CHILD_ARROW_GAP = 1.5
// EMPIRICAL estimates (chart units) of a SITE child's rendered content-hug rect, used
// only for arrow targeting. They MUST track the `[data-kind='site'] .adh-graph__bubble`
// rule in adh-concepts.css (one line of text + padding, rendered at SCALE.child):
// half-HEIGHT is ~constant; half-WIDTH grows with the label word's char count. These
// are tolerance-checked against the live DOM by websites/main/hub/e2e/landing-graph.spec.ts,
// so a CSS change that invalidates them fails that test instead of silently drifting.
const SITE_HALF_HEIGHT = 2.0
const siteHalfWidth = (chars: number): number => 2.7 + 0.37 * chars
// Convert a ring-orb width (rem, at scale 1) to its rendered HALF-width in chart
// units: 44rem chart maps to 100 units, ring orbs render at SCALE.child (the 0.62
// below). Sizes the non-site (circle/pill) children for arrow targeting.
const REM_PX = 16
const CHART_REM = 44
const remToHalfUnit = (rem: number): number => (rem * REM_PX * 0.62) / ((CHART_REM * REM_PX) / 100) / 2

const SCALE: Record<Role, number> = {
  center: 1,
  child: 0.62,
  // the parent orb to the left — a dimmed, slightly-smaller replica of the orb
  // you'd return to (kind glyph + name), styled to recede vs the child orbs.
  parent: 0.68,
}
const Z: Record<Role, number> = { center: 4, child: 3, parent: 3 }
// Children/parent collapse to this scale at the layer origin (deploy start / retract end).
const COLLAPSE_SCALE = 0.2

// Per-node SILHOUETTE for the orb emblems AND the back-trail mini-shapes — the SINGLE
// source of truth for the category polygons. Injected onto each node as the `--shape`
// CSS var (the orb's `clip-path: var(--shape)` and the trail both read it), so the
// polygons live here only — never duplicated in adh-concepts.css. Categories are
// polygons keyed by id; root/site/feature fall back to a border-radius.
const SHAPE_CLIP: Record<string, string> = {
  learn: 'polygon(50% 5%, 95% 92%, 5% 92%)',
  sell: 'polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)',
  build: 'polygon(12% 12%, 88% 12%, 88% 88%, 12% 88%)',
  community: 'polygon(50% 3%, 97% 39%, 79% 97%, 21% 97%, 3% 39%)',
  connect: 'polygon(27% 6%, 73% 6%, 98% 50%, 73% 94%, 27% 94%, 2% 50%)',
  plan: 'polygon(24% 12%, 94% 12%, 76% 88%, 6% 88%)',
  hire: 'polygon(22% 14%, 78% 14%, 95% 86%, 5% 86%)',
}
// Back-trail shapes shrink + dim per step RIGHT→LEFT (rightmost = nearest the focus,
// full; older ones to the left recede). Size halves each step.
const TRAIL_SCALE_STEP = 0.5
const TRAIL_DIM_STEP = 0.58

// Hover flyout: a description card that flies out PAST the hovered child, along the
// continuation of that child's spoke. The connector line spans this far (chart units)
// from the child's edge to the card's near corner.
const FLYOUT_LINE_LEN = 5.5

type Spring = { type: 'spring'; stiffness: number; damping: number; mass: number }
type Transition = Spring | { duration: number }
// Bouncy, under-damped spring for the children springing OUT of the focus on deploy —
// they overshoot their position + size and settle after a couple of decaying bounces.
const BOUNCE: Spring = { type: 'spring', stiffness: 300, damping: 18, mass: 1 }
// Critically-damped spring for the RETRACT (recede + fade): no overshoot, so progress
// and opacity never swing past their targets into negative values (which would flash
// the layer invisible or extrapolate orbs past their collapse point).
const SETTLE: Spring = { type: 'spring', stiffness: 240, damping: 30, mass: 0.9 }
// When "reduce animation" is on, every transition collapses to this (instant) and
// MotionConfig also disables transform/layout motion — so the diagram snaps
// between states with no movement.
const INSTANT = { duration: 0 }
// localStorage key for the per-visitor "reduce animation" preference.
const REDUCE_MOTION_KEY = 'adh:reduce-animation'

// 10× slower while preserving the spring's SHAPE: scale stiffness by 1/f² and
// damping by 1/f (keeps the damping ratio, stretches the period by f).
const slowSpring = (s: Spring, slow: boolean, factor: number): Spring =>
  slow ? { ...s, stiffness: s.stiffness / (factor * factor), damping: s.damping / factor } : s

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

type Pt = { x: number; y: number }
const FOCUS: Pt = { x: FOCUS_X, y: FOCUS_Y }

/** The single word shown inside an orb (the orb auto-sizes to hold it on one
 *  line). The full label rides along on aria-label/title for SR + crawlers. */
function orbWord(label: string): string {
  return label.split(/\s+/)[0] || label
}

function nodeHref(node: GraphNode, rootId: string): string {
  return node.hasDetail ? `/details/${node.id}` : node.id === rootId ? '/' : `/?focus=${node.id}`
}

/** Widest ring-orb width (rem) for a node's children. Single source for both the arrow
 *  boundary geometry (via `buildSpecs`) and the CSS `--ring-orb-w` orb size. */
function ringWidthRem(node: GraphNode): number {
  const maxChars = node.children.reduce((m, n) => Math.max(m, orbWord(n.label).length), 0)
  return Math.min(16.5, maxChars * 0.55 * 1.4 + 4)
}

/** Half-extent (chart units) of a ring child along the centre→child ray. The spoke's
 *  arrowhead stops here on the way IN; the hover flyout's connector line starts here on
 *  the way OUT — so the line is the exact continuation of the arrow. Circle kinds use the
 *  ring-orb radius; rect/pill kinds use the ray-box exit (meet the box, not a face). */
function childRadialHalf(node: GraphNode, ux: number, uy: number, ringOrbHalf: number): number {
  if (node.kind === 'category' || node.kind === 'root') return ringOrbHalf
  const isSite = node.kind === 'site'
  const halfW = isSite ? siteHalfWidth(orbWord(node.label).length) : ringOrbHalf
  const halfH = isSite ? SITE_HALF_HEIGHT : ringOrbHalf / 2.5
  const tx = Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity
  const ty = Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity
  return Math.min(tx, ty)
}

/** Fallback glyph per node KIND. */
const KIND_ICON = { root: Sun, category: Layers, site: Globe, feature: Puzzle } as const

/** A DISTINCT glyph per topic (overrides the kind glyph). Falls back to the kind
 *  glyph for anything not listed (e.g. feature leaves). */
const NODE_GLYPH: Record<string, typeof Sun> = {
  // categories
  learn: GraduationCap,
  build: Blocks,
  connect: Waypoints,
  community: Users,
  sell: ShoppingBag,
  plan: CalendarDays,
  hire: Handshake,
  // sites
  academy: BookOpen,
  education: School,
  recipes: ChefHat,
  personas: Fingerprint,
  registries: BookMarked,
  ecosystems: Network,
  knowledgebases: Library,
  storage: Database,
  tools: Wrench,
  sites: Globe,
  domains: Link2,
  authentication: KeyRound,
  devices: Cpu,
  notifications: Bell,
  dashboards: LayoutDashboard,
  forums: MessageSquare,
  communities: UserRound,
  support: LifeBuoy,
  news: Newspaper,
  products: Package,
  customers: Contact,
  billing: CreditCard,
  projects: FolderKanban,
  consulting: Briefcase,
}

function glyphFor(node: GraphNode): typeof Sun {
  return NODE_GLYPH[node.id] ?? KIND_ICON[node.kind]
}

/** Where `targetId` SITS in the view focused on `viewFocusId` — the centre, the
 *  back-orb spot (if it's the parent), a ring slot (if it's a child), else the
 *  centre. Used to tether a drill: the new focus flies in FROM where it sat in the
 *  old view, and the old focus recedes TO where it sits in the new view. */
function spotInView(tree: GraphNode, viewFocusId: string, targetId: string): Pt {
  const vf = findGraphNode(tree, viewFocusId) ?? tree
  if (targetId === vf.id) return FOCUS
  const chain = graphChain(tree, vf.id)
  const ancestors = chain.slice(0, -1)
  // Any ancestor lives in the left-hand back trail — drilling to/from it flies in from
  // the classic parent spot (left of the focus).
  if (ancestors.some((a) => a.id === targetId)) return parentSpot()
  const ring = placeChildren(vf.children, ancestors.length > 0)
  const slot = ring.find((c) => c.node.id === targetId)
  return slot ? { x: slot.xPct, y: slot.yPct } : FOCUS
}

/** Build the (origin-independent) orbs + spokes for the view focused on `focusNode`.
 *  Positions are settled targets + per-element offsets from the layer origin; the live
 *  origin (deployFrom / retractTo) and progress are supplied at render via MotionValues.
 *  `staticCenter` keeps the centre full-size (the initial/undisclosed layer, which must
 *  show its centre before disclosure); otherwise the centre grows in / shrinks out. */
function buildSpecs(tree: GraphNode, focusNode: GraphNode, staticCenter: boolean): LayerSpecs {
  const chain = graphChain(tree, focusNode.id)
  const parent = chain.length >= 2 ? chain[chain.length - 2] : null
  const ringNodes = focusNode.children
  const ring = placeChildren(ringNodes, parent != null)
  const ringOrbWidthRem = ringWidthRem(focusNode)
  const ringOrbHalf = remToHalfUnit(ringOrbWidthRem)

  const orbs: OrbSpec[] = []
  const edges: EdgeSpec[] = []

  // Centre: collapses to the layer origin, settles at the chart centre. Full-size only
  // for the initial/undisclosed layer; otherwise it grows in (a drilled-in focus) or
  // shrinks out (a receding old focus).
  const center: OrbSpec = {
    key: `node:${focusNode.id}`,
    node: focusNode,
    role: 'center',
    fromScale: staticCenter ? SCALE.center : SCALE.child,
    toX: FOCUS_X,
    toY: FOCUS_Y,
    toScale: SCALE.center,
    z: Z.center,
    fade: false,
  }
  orbs.push(center)

  ring.forEach((c) => {
    orbs.push({
      key: `node:${c.node.id}`,
      node: c.node,
      role: 'child',
      fromScale: COLLAPSE_SCALE,
      toX: c.xPct,
      toY: c.yPct,
      toScale: SCALE.child,
      z: Z.child,
      fade: true,
    })
    // The spoke runs CENTRE → CENTRE (focus centre to child centre); we only draw the
    // segment BETWEEN the orbs — the opaque centre orb (z above the edges) hides the
    // tail end, and the head stops a small gap outside the child. So we aim along the
    // centre→child line and find where it exits the child:
    //  - circle (category / root) → its radius,
    //  - rect / pill (site / feature) → the ray-box exit (the point on the box the
    //    centre line crosses), so the arrow points at the child's CENTRE, not a face.
    const dx = c.xPct - FOCUS_X
    const dy = c.yPct - FOCUS_Y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const boundary = childRadialHalf(c.node, ux, uy, ringOrbHalf)
    const d = boundary + CHILD_ARROW_GAP
    const target: Pt = { x: c.xPct - ux * d, y: c.yPct - uy * d }
    // Lock: head = childCentre − offset at EVERY frame. head's origin-offset = −(child
    // centre − target); the tail's offset is 0 so it tracks the moving centre.
    const offX = c.xPct - target.x
    const offY = c.yPct - target.y
    edges.push({
      key: `link:${focusNode.id}:${c.node.id}`,
      off1X: 0,
      off1Y: 0,
      to1X: FOCUS_X,
      to1Y: FOCUS_Y,
      off2X: -offX,
      off2Y: -offY,
      to2X: target.x,
      to2Y: target.y,
      arrow: true,
    })
  })

  // The IMMEDIATE parent is a full "back" orb at the classic parent spot (left of the
  // focus) with the spine arrow into the focus — same as before the stack. The OLDER
  // ancestors are drawn as a small-shape breadcrumb (BackTrail) extending LEFT from it.
  if (parent) {
    const p = parentSpot()
    orbs.push({
      key: `node:${parent.id}`,
      node: parent,
      role: 'parent',
      fromScale: COLLAPSE_SCALE,
      toX: p.x,
      toY: p.y,
      toScale: SCALE.parent,
      z: Z.parent,
      fade: true,
    })
    edges.push({
      key: `link:${parent.id}:${focusNode.id}`,
      off1X: 0,
      off1Y: 0,
      to1X: p.x,
      to1Y: p.y,
      off2X: 0,
      off2Y: 0,
      to2X: FOCUS_X - FOCUS_ARROW_BACKOFF,
      to2Y: FOCUS_Y,
      arrow: true,
    })
  }

  return { orbs, edges, center, ringOrbWidthRem }
}

/** One orb, positioned by the layer's shared `origin` + `progress` MotionValues
 *  (position lerps origin→to; scale/opacity lerp on progress alone). */
function RingOrb({
  originX,
  originY,
  progress,
  spec,
  href,
  accent,
  reduceMotion,
  slowFactor,
  onClick,
  onHoverStart,
  onHoverEnd,
}: {
  originX: MotionValue<number>
  originY: MotionValue<number>
  progress: MotionValue<number>
  spec: OrbSpec
  href: string
  accent?: string
  reduceMotion: boolean
  slowFactor: number
  onClick: (e: MouseEvent) => void
  onHoverStart?: (node: GraphNode, x: number, y: number, accent?: string) => void
  onHoverEnd?: () => void
}): ReactElement {
  const left = useTransform(() => `${lerp(originX.get(), spec.toX, progress.get())}%`)
  const top = useTransform(() => `${lerp(originY.get(), spec.toY, progress.get())}%`)
  const scale = useTransform(progress, (p) => lerp(spec.fromScale, spec.toScale, p))
  // children/parent bloom in over the first quarter of the deploy; the centre is
  // always opaque (it shows even undisclosed) and fades only with the whole layer.
  // Clamped ≥ 0 so a bouncy overshoot can't drive it negative.
  const opacity = useTransform(progress, (p) => (spec.fade ? clamp(p * 4, 0, 1) : 1))
  // Back-stack depth is dimmed via the COLOUR, not opacity — the orb body stays opaque so
  // it occludes the items stacked behind it. Mix the family hue toward the muted grey by
  // the `dim` factor (1 = front/full, lower = deeper/dimmer borders + glow + glyph).
  const effAccent =
    accent != null && spec.dim != null && spec.dim < 1
      ? `color-mix(in srgb, ${accent} ${Math.round(spec.dim * 100)}%, var(--cg-dim))`
      : accent
  // Only ring children get a hover flyout (the centre is inert; the back stack is a
  // navigation target, not a thing to describe).
  const flyoutHover = spec.role === 'child' && onHoverStart != null
  const NodeGlyph = glyphFor(spec.node)
  const isSun = spec.node.kind === 'root' && spec.role === 'center'
  // Categories are distinct geometric EMBLEMS (the shape is a clip-path keyed by
  // data-node-id), but — like every other kind — they carry their icon AND name
  // PAIRED together inside the shape, framed by a bright family-hue outline + glow.
  const label = orbWord(spec.node.label)
  // Family hue + silhouette as CSS vars: `--shape` comes from the SHAPE_CLIP map (the one
  // source of truth) so the CSS only declares `clip-path: var(--shape)` — no polygon literals.
  const nodeVars: Record<string, string> = {}
  if (effAccent != null) nodeVars['--cg-accent'] = effAccent
  const shapeClip = SHAPE_CLIP[spec.node.id]
  if (shapeClip != null) nodeVars['--shape'] = shapeClip
  return (
    <motion.div
      className="adh-graph__pos"
      style={{ translateX: '-50%', translateY: '-50%', zIndex: spec.z, left, top, scale, opacity }}
    >
      <a
        href={href}
        className="adh-graph__node"
        data-role={spec.role}
        data-kind={spec.node.kind}
        data-node-id={spec.node.id}
        aria-current={spec.role === 'center' ? 'true' : undefined}
        aria-label={spec.node.label}
        onClick={onClick}
        onMouseEnter={
          flyoutHover
            ? () => {
                // Only describe a PARKED orb. While the ring is still springing out the
                // orb sits at lerp(origin→to, progress), not at spec.to, so a flyout placed
                // at spec.to would dangle its connector into empty space. Wait for settle.
                if (progress.get() < 0.99) return
                onHoverStart?.(spec.node, spec.toX, spec.toY, accent)
              }
            : undefined
        }
        onMouseLeave={flyoutHover ? onHoverEnd : undefined}
        style={Object.keys(nodeVars).length > 0 ? (nodeVars as CSSProperties) : undefined}
      >
        <span className="adh-graph__bubble">
          {isSun && (
            <motion.span
              className="adh-graph__sun-aura"
              aria-hidden="true"
              animate={
                reduceMotion
                  ? { scale: 1, opacity: 0.6 }
                  : { scale: [1, 1.16, 1.04, 1.12, 1], opacity: [0.5, 0.85, 0.62, 0.8, 0.5] }
              }
              transition={
                reduceMotion
                  ? INSTANT
                  : { duration: 6.5 * slowFactor, repeat: Infinity, ease: 'easeInOut' }
              }
            />
          )}
          <NodeGlyph className="adh-graph__glyph" size={24} aria-hidden="true" />
          <span className="adh-graph__label">{label}</span>
        </span>
      </a>
    </motion.div>
  )
}

/** Hover description that flies out PAST a child orb, along the continuation of that
 *  child's spoke (centre → child → flyout, colinear). A thin connector line bridges the
 *  child's edge to the card. Stays open while the pointer is over the orb, the card, OR
 *  the corridor between them; clicking the card drills, exactly like clicking the orb.
 *  Positioned from the child's SETTLED ring spot (it only shows once the ring is parked). */
function GraphFlyout({
  node,
  x,
  y,
  accent,
  ringOrbHalf,
  onEnter,
  onLeave,
  onActivate,
}: {
  node: GraphNode
  x: number
  y: number
  accent?: string
  ringOrbHalf: number
  onEnter: () => void
  onLeave: () => void
  onActivate: (e: MouseEvent) => void
}): ReactElement {
  // While AnimatePresence fades this card OUT, it stays mounted with the old node — drop
  // its pointer-events so a click during the exit can't drill the node being dismissed.
  // (The corridor + card re-enable pointer-events in CSS, so a wrapper rule won't cascade.)
  const [isPresent] = usePresence()
  const hoverEvents = isPresent ? 'auto' : 'none'
  const dx = x - FOCUS_X
  const dy = y - FOCUS_Y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const angleDeg = (Math.atan2(uy, ux) * 180) / Math.PI
  // Line runs from the orb's edge (where the inbound arrow would stop) outward.
  const startD = childRadialHalf(node, ux, uy, ringOrbHalf) + CHILD_ARROW_GAP
  const sx = x + ux * startD
  const sy = y + uy * startD
  const ex = x + ux * (startD + FLYOUT_LINE_LEN)
  const ey = y + uy * (startD + FLYOUT_LINE_LEN)
  // Anchor the card by the corner nearest the line end, so it grows OUTWARD (text upright).
  const tx = ux > 0.25 ? '0%' : ux < -0.25 ? '-100%' : '-50%'
  const ty = uy > 0.25 ? '0%' : uy < -0.25 ? '-100%' : '-50%'
  const FlyoutGlyph = glyphFor(node)
  return (
    <motion.div
      className="adh-graph__flyout"
      style={accent ? ({ '--cg-accent': accent } as CSSProperties) : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
    >
      <svg
        className="adh-graph__flyout-edges"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1={sx} y1={sy} x2={ex} y2={ey} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* invisible "safe corridor" over the gap, so moving orb → card never closes it */}
      <div
        className="adh-graph__flyout-corridor"
        style={{
          left: `${sx}%`,
          top: `${sy}%`,
          width: `${FLYOUT_LINE_LEN}%`,
          transform: `translateY(-50%) rotate(${angleDeg}deg)`,
          transformOrigin: '0 50%',
          pointerEvents: hoverEvents,
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onActivate}
      />
      {/* The card itself is a plain site UI element — the shared InfoPanel, same as the
          detail card below the chart — so it reads as chrome, not as part of the diagram. */}
      <div
        className="adh-graph__flyout-card"
        style={{
          left: `${ex}%`,
          top: `${ey}%`,
          transform: `translate(${tx}, ${ty})`,
          pointerEvents: hoverEvents,
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onActivate}
      >
        <InfoPanel
          className="adh-graph__flyout-panel"
          icon={<FlyoutGlyph size={13} className="adh-graph__flyout-icon" aria-hidden="true" />}
          title={node.label}
          ariaLabel={node.label}
        >
          <p className="adh-graph__flyout-desc">{node.blurb}</p>
        </InfoPanel>
      </div>
    </motion.div>
  )
}

/** One spoke/arrow, whose endpoints lerp on the SAME origin + progress as the orbs. */
function RingEdge({
  originX,
  originY,
  progress,
  spec,
}: {
  originX: MotionValue<number>
  originY: MotionValue<number>
  progress: MotionValue<number>
  spec: EdgeSpec
}): ReactElement {
  const x1 = useTransform(() => lerp(originX.get() + spec.off1X, spec.to1X, progress.get()))
  const y1 = useTransform(() => lerp(originY.get() + spec.off1Y, spec.to1Y, progress.get()))
  const x2 = useTransform(() => lerp(originX.get() + spec.off2X, spec.to2X, progress.get()))
  const y2 = useTransform(() => lerp(originY.get() + spec.off2Y, spec.to2Y, progress.get()))
  // Clamped ≥ 0 so a bouncy overshoot can't drive opacity negative.
  const opacity = useTransform(progress, (p) => clamp(p * 2.4, 0, 0.6))
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      style={{ opacity }}
      vectorEffect="non-scaling-stroke"
      markerEnd={spec.arrow ? 'url(#adh-back-arrow)' : undefined}
    />
  )
}

/** One ring of the diagram (centre + children + back orb + all their spokes), driven
 *  by shared `origin` + `progress` MotionValues — so a child orb and its arrow can never
 *  drift apart. Exit is managed by AnimatePresence/usePresence: while present it deploys
 *  progress 0→1 with origin fixed at `deployFrom`; once removed it animates progress→0
 *  AND origin→`retractTo` (read from a mutable ref so it isn't frozen by AnimatePresence)
 *  + fades, then `safeToRemove`s. Animating the origin (rather than swapping it) keeps the
 *  recede continuous even if a deploy was interrupted mid-flight — no jump. */
function RingLayer({
  tree,
  node,
  layerId,
  deployFrom,
  isInitial,
  disclosed,
  deployTransition,
  retractTransition,
  reduceMotion,
  slowFactor,
  rootId,
  accentById,
  onNodeClick,
  onChildHoverStart,
  onChildHoverEnd,
  retractToRef,
}: {
  tree: GraphNode
  node: GraphNode
  layerId: string
  deployFrom: Pt
  isInitial: boolean
  disclosed: boolean
  deployTransition: Transition
  retractTransition: Transition
  reduceMotion: boolean
  slowFactor: number
  rootId: string
  accentById: Map<string, string>
  onNodeClick: (e: MouseEvent, node: GraphNode, role: Role) => void
  onChildHoverStart: (node: GraphNode, x: number, y: number, accent?: string) => void
  onChildHoverEnd: () => void
  retractToRef: { current: Map<string, Pt> }
}): ReactElement {
  const [isPresent, safeToRemove] = usePresence()
  const originX = useMotionValue(deployFrom.x)
  const originY = useMotionValue(deployFrom.y)
  const progress = useMotionValue(0)
  const opacity = useMotionValue(1)

  // Latest transitions via refs so toggling speed/reduce-motion mid-flight re-targets
  // future animations without restarting (and re-jerking) the in-flight one.
  const deployTransitionRef = useRef(deployTransition)
  deployTransitionRef.current = deployTransition
  const retractTransitionRef = useRef(retractTransition)
  retractTransitionRef.current = retractTransition

  // The centre stays full-size only for the present initial layer; a drilled-in centre
  // grows, a receding centre shrinks.
  const staticCenter = isPresent && isInitial
  const specs = useMemo(() => buildSpecs(tree, node, staticCenter), [tree, node, staticCenter])
  const ringOrbWidth = `${specs.ringOrbWidthRem.toFixed(2)}rem`

  // Panel line follows the selected (centre) node: top tracks the centre (origin → chart
  // centre), bottom anchored at the info card. Visible only while progress ≳ 0.45 so the
  // retracting and deploying layers' lines cross-fade through a brief overlap at the
  // halfway point — the line hands the connection from old node to new node.
  const panelX = useTransform(() => lerp(originX.get(), FOCUS_X, progress.get()))
  const panelY = useTransform(() => lerp(originY.get(), FOCUS_Y, progress.get()))
  const panelOpacity = useTransform(progress, (p) => clamp((p - 0.45) * 1.6, 0, 0.6))

  useEffect(() => {
    if (isPresent) {
      const a = animate(progress, disclosed ? 1 : 0, deployTransitionRef.current)
      if (disclosed) return () => a.stop()
      // Re-collapsing while present (clicking the focused hub): slide the shared origin to
      // the chart centre too, so the centre orb stays put and only the children fall back
      // into it — the hub itself doesn't animate anywhere.
      const ox = animate(originX, FOCUS_X, deployTransitionRef.current)
      const oy = animate(originY, FOCUS_Y, deployTransitionRef.current)
      return () => {
        a.stop()
        ox.stop()
        oy.stop()
      }
    }
    // Exiting: recede the origin + collapse for continuity, but FADE OUT FAST so the old
    // layer doesn't linger as a second visible set of orbs while the new one deploys —
    // it's gone almost immediately, leaving the new deploy as the single visible animation.
    // Remove the layer as soon as it's invisible (don't wait for the slow collapse).
    const t = retractTransitionRef.current
    const fade = reduceMotion ? INSTANT : { duration: 0.18 * slowFactor }
    const rt = retractToRef.current.get(layerId) ?? FOCUS
    const a = animate(progress, 0, t)
    const b = animate(opacity, 0, fade)
    const ox = animate(originX, rt.x, t)
    const oy = animate(originY, rt.y, t)
    let done = false
    b.finished.then(() => {
      if (!done) safeToRemove()
    })
    return () => {
      done = true
      a.stop()
      b.stop()
      ox.stop()
      oy.stop()
    }
  }, [
    isPresent,
    disclosed,
    progress,
    opacity,
    originX,
    originY,
    layerId,
    safeToRemove,
    retractToRef,
    reduceMotion,
    slowFactor,
  ])

  return (
    <motion.div
      className="adh-graph__layer"
      style={{ opacity, pointerEvents: isPresent ? 'auto' : 'none' }}
    >
      <svg
        className="adh-graph__edges"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* the line down to the info card, tracking this layer's centre node */}
        <motion.line
          className="adh-graph__panel-line"
          x1={panelX}
          y1={panelY}
          x2={FOCUS_X}
          y2={PANEL_LINE_Y}
          style={{ opacity: panelOpacity }}
          vectorEffect="non-scaling-stroke"
        />
        {specs.edges.map((edge) => (
          <RingEdge key={edge.key} originX={originX} originY={originY} progress={progress} spec={edge} />
        ))}
      </svg>
      {/* `--ring-orb-w` is per-layer (display:contents so the orbs still position
          against the chart) — so a retracting layer's orbs keep their OWN ring width. */}
      <div style={{ display: 'contents', '--ring-orb-w': ringOrbWidth } as CSSProperties}>
        {specs.orbs.map((orb) => (
          <RingOrb
            key={orb.key}
            originX={originX}
            originY={originY}
            progress={progress}
            spec={orb}
            href={nodeHref(orb.node, rootId)}
            accent={accentById.get(orb.node.id)}
            reduceMotion={reduceMotion}
            slowFactor={slowFactor}
            onClick={(e) => onNodeClick(e, orb.node, orb.role)}
            onHoverStart={onChildHoverStart}
            onHoverEnd={onChildHoverEnd}
          />
        ))}
      </div>
    </motion.div>
  )
}

/** The "back" path as a horizontal breadcrumb of small colourised shapes (no text) to the
 *  LEFT of the focus: hub … parent, oldest on the left, connected by dashes, the deck
 *  expanding leftward as you drill deeper. Each shape drills back to that ancestor. */
function BackTrail({
  ancestors,
  accentById,
  onSelect,
  transition,
}: {
  ancestors: GraphNode[]
  accentById: Map<string, string>
  onSelect: (id: string) => void
  transition: Transition
}): ReactElement | null {
  if (ancestors.length === 0) return null
  return (
    <div className="adh-graph__trail" aria-label="Back to a parent">
      {ancestors.map((anc, i) => {
        const clip = SHAPE_CLIP[anc.id]
        const radius =
          anc.kind === 'root'
            ? '50%'
            : anc.kind === 'feature'
              ? '999px'
              : anc.kind === 'site'
                ? '0.3rem'
                : '0'
        // progressively smaller + dimmer from RIGHT (nearest the focus, full) to LEFT
        const dRight = ancestors.length - 1 - i
        const steadyScale = TRAIL_SCALE_STEP ** dRight
        const steadyOpacity = TRAIL_DIM_STEP ** dRight
        const Glyph = glyphFor(anc)
        return (
          <Fragment key={anc.id}>
            {i > 0 && <span className="adh-graph__trail-line" aria-hidden="true" />}
            {/* an OUTLINED shape (family-hue rim + dark body) carrying the node's icon. A
                node demoting from the full back orb to this shape shrinks + translates in
                from the orb's side with a little bounce (mounts once per id). */}
            <motion.button
              type="button"
              className="adh-graph__trail-shape"
              data-kind={anc.kind}
              style={
                {
                  '--cg-accent': accentById.get(anc.id) ?? 'var(--color-accent, #c4a35a)',
                  '--shape': clip ?? 'none',
                  borderRadius: clip ? '0' : radius,
                } as CSSProperties
              }
              title={anc.label}
              aria-label={`Back to ${anc.label}`}
              initial={{ scale: 2, x: 52, opacity: 0 }}
              animate={{ scale: steadyScale, x: 0, opacity: steadyOpacity }}
              whileHover={{ scale: steadyScale * 1.3, opacity: 1 }}
              transition={transition}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(anc.id)
              }}
            >
              <Glyph className="adh-graph__trail-icon" size={16} aria-hidden="true" />
            </motion.button>
          </Fragment>
        )
      })}
      {/* a final connector line pointing on toward the focus/parent orb */}
      <span className="adh-graph__trail-line" aria-hidden="true" />
    </div>
  )
}

export function ConceptGraphClient({
  tree,
  initialFocusId,
  eyebrow,
  titleLead,
  titleAccent,
  currentSiteId,
  env,
}: ConceptGraphClientProps): ReactElement {
  const [focusId, setFocusId] = useState(initialFocusId)

  // Family hue per node: a top-level category sets `accent`; its whole subtree
  // inherits it. Resolved from the slim tree (no detail prose) so it stays out of
  // the heavy bundle. Applied as each orb's `--cg-accent` (border/glow/fill).
  const accentById = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (n: GraphNode, inherited?: string) => {
      const eff = n.accent ?? inherited
      if (eff) map.set(n.id, eff)
      n.children.forEach((c) => walk(c, eff))
    }
    walk(tree)
    return map
  }, [tree])
  // The diagram opens UNDISCLOSED: ONLY the focus orb shows — no children, no
  // parent/up-line, no info card — until the visitor first clicks to explore.
  const [disclosed, setDisclosed] = useState(false)

  // The new focus flies in FROM here (its spot in the previous view). Null until the
  // first drill → the initial / disclosed layer blooms from the centre.
  const [deployFrom, setDeployFrom] = useState<Pt | null>(null)
  // Where each (now-outgoing) focus recedes TO — its spot in the view that replaced it.
  // A ref (not state) so AnimatePresence's frozen exiting layer can still read the
  // latest target; bounded by node count.
  const retractToRef = useRef<Map<string, Pt>>(new Map())

  // "Reduce animation" preference. Starts false for a deterministic SSR/first
  // render, then the saved choice is restored after mount (localStorage isn't
  // available server-side, and reading it in the initializer would risk a
  // hydration mismatch).
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    try {
      if (window.localStorage.getItem(REDUCE_MOTION_KEY) === '1') setReduceMotion(true)
    } catch {
      // private mode / blocked storage — just keep the default.
    }
  }, [])
  const toggleReduceMotion = useCallback((on: boolean) => {
    setReduceMotion(on)
    try {
      window.localStorage.setItem(REDUCE_MOTION_KEY, on ? '1' : '0')
    } catch {
      // ignore — the in-memory state still applies for this session.
    }
  }, [])
  // "Slow animations" — a LOCAL-ONLY dev aid that runs every transition 10× slower
  // so the choreography can be inspected. Ephemeral (not persisted).
  const [slow, setSlow] = useState(false)
  const host = useClientHost()
  const isLocalEnv = host != null && detectEnv(host) === 'local'
  const slowFactor = slow ? 10 : 1
  // One source for each transition (stable identity → no effect churn): deploy bounces
  // out, retract settles in without overshoot. The info card reuses the deploy bounce.
  const deployTransition = useMemo<Transition>(
    () => (reduceMotion ? INSTANT : slowSpring(BOUNCE, slow, slowFactor)),
    [reduceMotion, slow, slowFactor],
  )
  const retractTransition = useMemo<Transition>(
    () => (reduceMotion ? INSTANT : slowSpring(SETTLE, slow, slowFactor)),
    [reduceMotion, slow, slowFactor],
  )
  const bounce = deployTransition

  // A quick scale pulse on the info panel — feedback when the visitor clicks the already-
  // selected orb (which is otherwise inert). reduce-motion makes it a no-op.
  const panelControls = useAnimationControls()
  const bouncePanel = useCallback(() => {
    if (reduceMotion) return
    void panelControls.start({
      scale: [1, 1.05, 0.99, 1],
      transition: { duration: 0.5, times: [0, 0.35, 0.7, 1], ease: 'easeInOut' },
    })
  }, [panelControls, reduceMotion])

  // Hover flyout: the description card for the child the pointer is over (or whose
  // flyout/corridor it's still within). One at a time; a short close delay lets the
  // pointer travel orb → corridor → card without it snapping shut. Cleared on any drill.
  const [flyout, setFlyout] = useState<{
    node: GraphNode
    x: number
    y: number
    accent?: string
  } | null>(null)
  const flyoutCloseTimer = useRef<number | null>(null)
  // Has the pointer MOVED since the last disclose/drill? If not, a child orb that
  // settles under a stationary cursor (and fires a synthetic mouseenter) must NOT pop
  // its flyout — only a fresh hover gesture (move, then enter a child) should. Reset on
  // every nav; set true on any real pointer movement.
  const movedSinceNav = useRef(false)
  useEffect(() => {
    const onMove = (): void => {
      movedSinceNav.current = true
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  const clearFlyoutTimer = useCallback(() => {
    if (flyoutCloseTimer.current != null) {
      window.clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
  }, [])
  const openFlyout = useCallback(
    (node: GraphNode, x: number, y: number, accent?: string) => {
      // Ignore a hover the cursor was already sitting in when the animation finished.
      if (!movedSinceNav.current) return
      clearFlyoutTimer()
      setFlyout({ node, x, y, accent })
    },
    [clearFlyoutTimer],
  )
  const keepFlyout = useCallback(() => clearFlyoutTimer(), [clearFlyoutTimer])
  const closeFlyoutSoon = useCallback(() => {
    clearFlyoutTimer()
    flyoutCloseTimer.current = window.setTimeout(() => setFlyout(null), 140)
  }, [clearFlyoutTimer])
  // Clear any pending close-timer if the graph unmounts mid-fade (e.g. route change), so the
  // 140ms timeout can't fire setFlyout on a gone component (balances the pointermove/keydown
  // listener cleanups below).
  useEffect(() => clearFlyoutTimer, [clearFlyoutTimer])

  const drill = useCallback(
    (id: string) => {
      // Clicking the already-selected node does nothing.
      if (id === focusId) return
      clearFlyoutTimer()
      setFlyout(null)
      movedSinceNav.current = false
      const prev = focusId
      // New focus flies in from where it sat in the OLD view; old focus recedes to
      // where it sits in the NEW view (back orb / a ring slot / centre).
      setDeployFrom(spotInView(tree, prev, id))
      retractToRef.current.set(prev, spotInView(tree, id, prev))
      setFocusId(id)
      setDisclosed(true)
      if (typeof window !== 'undefined') {
        const url = id === tree.id ? window.location.pathname : `?focus=${id}`
        window.history.replaceState(null, '', url)
      }
    },
    [focusId, tree, clearFlyoutTimer],
  )

  const focus = useMemo(() => findGraphNode(tree, focusId) ?? tree, [tree, focusId])
  const chain = useMemo(() => graphChain(tree, focus.id), [tree, focus.id])
  const parent = chain.length >= 2 ? chain[chain.length - 2] : null
  // Half-extent of this focus's ring orbs — positions the hover flyout's connector line
  // start (shared with the spoke arrow geometry).
  const focusRingOrbHalf = useMemo(() => remToHalfUnit(ringWidthRem(focus)), [focus])

  // The marketing site the focused node IS (site nodes only).
  const focusSite = focus.siteId ? getSite(focus.siteId) : undefined
  // The focus's family hue, applied to the info panel so its call-out matches the
  // focused orb's colour.
  const focusAccent = accentById.get(focus.id)
  // The focus node's own title — shown centred in the card body, above the URL.
  const panelTitle = focusSite ? siteHeaderTitle(focusSite) : focus.label
  // The focused card IS the site whose landing this is → "You are Here".
  const isCurrentSite = focusSite != null && focus.siteId === currentSiteId
  // This landing opens on the root → it's the hub's own page; only there does the
  // quiet "the" ride in front of the page title ("the Agentic Developer Hub").
  const isHubLanding = initialFocusId === tree.id

  const onNodeClick = useCallback(
    (e: MouseEvent, node: GraphNode, role: Role) => {
      e.preventDefault()
      e.stopPropagation()
      if (role === 'center') {
        if (!disclosed) {
          // Undisclosed → open the diagram.
          movedSinceNav.current = false
          setDisclosed(true)
          return
        }
        // Disclosed: clicking the HUB (root) when it's the focus collapses back to the
        // original undisclosed state — the founder's note shows again.
        if (node.id === tree.id) {
          clearFlyoutTimer()
          setFlyout(null)
          movedSinceNav.current = false
          // Treat the hub as the initial layer again so its centre orb stays full-size
          // (staticCenter) and pinned while the children retract — it doesn't fly anywhere.
          setDeployFrom(null)
          setDisclosed(false)
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname)
          }
          return
        }
        // Any other selected orb is inert for navigation — give a little panel bounce
        // as feedback so the click registers.
        bouncePanel()
        return
      }
      // Parent orb / child → make that node the new focus.
      drill(node.id)
    },
    [disclosed, drill, tree.id, clearFlyoutTimer, bouncePanel],
  )

  const onBackdrop = () => {
    // Disclosing happens ONLY by clicking the hub orb itself (see onNodeClick); a click
    // on the empty chart no longer opens it. While disclosed, a backdrop click steps back.
    if (disclosed && parent) drill(parent.id)
  }

  // Keyboard: Esc / Backspace ascend one level (ignored while typing in a field).
  const parentId = parent?.id
  useEffect(() => {
    if (!parentId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      drill(parentId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [parentId, drill])

  const titleHeader = (
    <header className="adh-graph__page">
      {eyebrow && eyebrow.trim().toLowerCase() !== (titleLead ?? '').trim().toLowerCase() && (
        <p className="adh-graph__page-eyebrow">{eyebrow}</p>
      )}
      <h1 className="adh-graph__page-title">
        {isHubLanding && <span className="adh-graph__page-title-lead">the </span>}
        {titleLead && <>{titleLead} </>}
        <span className="adh-graph__page-title-accent">{titleAccent}</span>
      </h1>
    </header>
  )

  // Production: hide the whole diagram (note, panel, cards, toggles) — show only the page
  // title and a centred "Coming soon" banner. The site header + footer live outside this.
  if (env === 'production') {
    return (
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
        <div className="adh-graph adh-graph--coming">
          {titleHeader}
          <div className="adh-graph__coming" role="status">
            <p className="adh-graph__coming-text">Coming soon!</p>
          </div>
        </div>
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
      <div className="adh-graph">
        {titleHeader}

        <div className="adh-graph__chart" onClick={onBackdrop}>
          {/* Stable layer: just the arrowhead marker (referenced by id, document-wide).
              The panel line lives INSIDE each ring layer so it follows that layer's
              centre node as it moves (and hands over on a switch). */}
          <svg
            className="adh-graph__edges"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              {/* Arrowhead capping a spoke. userSpaceOnUse (not strokeWidth) so the
                  hairline stroke doesn't shrink it to nothing; orient="auto" keeps it
                  aligned with the line. */}
              <marker
                id="adh-back-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="3.4"
                markerHeight="3.4"
                orient="auto"
                overflow="visible"
              >
                {/* an OPEN chevron (two strokes, no fill) so it reads as an arrowhead,
                    not a solid triangle. non-scaling-stroke makes its weight match the
                    line's 1.25px hairline exactly. */}
                <path
                  className="adh-graph__edge-arrow"
                  d="M1,1 L9,5 L1,9"
                  vectorEffect="non-scaling-stroke"
                />
              </marker>
            </defs>
          </svg>

          {/* One layer per focus. AnimatePresence keeps the outgoing layer mounted while
              it recedes + fades (driven by usePresence inside RingLayer), so a drill
              cross-fades the old ring out and the new ring in — each one shared-progress
              layer, so every arrow stays locked to its child throughout. */}
          <AnimatePresence initial={false}>
            <RingLayer
              key={focus.id}
              tree={tree}
              node={focus}
              layerId={focus.id}
              deployFrom={deployFrom ?? FOCUS}
              isInitial={deployFrom == null}
              disclosed={disclosed}
              deployTransition={deployTransition}
              retractTransition={retractTransition}
              reduceMotion={reduceMotion}
              slowFactor={slowFactor}
              rootId={tree.id}
              accentById={accentById}
              onNodeClick={onNodeClick}
              onChildHoverStart={openFlyout}
              onChildHoverEnd={closeFlyoutSoon}
              retractToRef={retractToRef}
            />
          </AnimatePresence>

          {/* Hover description flying out past the hovered child, along its spoke. */}
          <AnimatePresence>
            {disclosed && flyout && (
              <GraphFlyout
                key={flyout.node.id}
                node={flyout.node}
                x={flyout.x}
                y={flyout.y}
                accent={flyout.accent}
                ringOrbHalf={focusRingOrbHalf}
                onEnter={keepFlyout}
                onLeave={closeFlyoutSoon}
                onActivate={(e) => onNodeClick(e, flyout.node, 'child')}
              />
            )}
          </AnimatePresence>

          {/* Older ancestors (above the immediate parent) as a left-expanding breadcrumb
              of small shapes, extending LEFT from the full back orb. */}
          {disclosed && (
            <BackTrail
              ancestors={chain.slice(0, -2)}
              accentById={accentById}
              onSelect={drill}
              transition={deployTransition}
            />
          )}
        </div>

        {/* The info card + the undisclosed founder's note share one reserved slot, so
            the page never reflows when you disclose: the note overlays the (hidden)
            panel's space, bottom-aligned so it sits just above the toggles below. */}
        <div className="adh-graph__panel-slot">
        {/* The info card. Hidden until the first click, then it just FADES in at its
            fixed size — it never scales/resizes (no zoom-out, no per-focus bounce), so
            the card is always exactly one size. Always in the DOM — its box reserves
            space so the chart never shifts, and the blurb stays crawlable. */}
        <motion.div
          className="adh-graph__panel-wrap"
          initial={false}
          animate={{ opacity: disclosed ? 1 : 0 }}
          transition={bounce}
          style={{ pointerEvents: disclosed ? 'auto' : 'none' }}
        >
          {/* Re-keyed on the focus id so a node change remounts the panel (re-splits the
              blurb lens). No per-focus scale (the card never changes size on its own) —
              `panelControls` only fires a one-shot bounce when the selected orb is clicked. */}
          <motion.div
            key={focus.id}
            className="adh-graph__panel-bounce"
            initial={{ scale: 1 }}
            animate={panelControls}
          >
            <InfoPanel
              className="adh-graph__panel"
              ariaLabel={focus.label}
              scroll
              flex="0 0 auto"
              style={focusAccent ? ({ '--cg-accent': focusAccent } as CSSProperties) : undefined}
              title={
                <span className="adh-graph__panel-crumbs">
                  {chain.map((n, i) => {
                    const SegIcon = glyphFor(n)
                    return (
                      <span
                        key={n.id}
                        className="adh-graph__panel-crumb"
                        style={
                          {
                            '--cg-accent':
                              accentById.get(n.id) ?? 'var(--color-accent, #c4a35a)',
                          } as CSSProperties
                        }
                      >
                        {i > 0 && (
                          <span className="adh-graph__panel-crumb-sep" aria-hidden="true">
                            {'>'}
                          </span>
                        )}
                        <a
                          className="adh-graph__panel-crumb-link"
                          href={nodeHref(n, tree.id)}
                          aria-current={i === chain.length - 1 ? 'page' : undefined}
                          onClick={(e) => {
                            e.preventDefault()
                            drill(n.id)
                          }}
                        >
                          <SegIcon
                            size={13}
                            className="adh-graph__panel-crumb-icon"
                            aria-hidden="true"
                          />
                          <span className="adh-graph__panel-crumb-label">{orbWord(n.label)}</span>
                        </a>
                      </span>
                    )
                  })}
                </span>
              }
              actions={
                focus.hasDetail ? (
                  <a className="adh-graph__panel-details" href={`/details/${focus.id}`}>
                    Details →
                  </a>
                ) : undefined
              }
            >
              <div className="adh-graph__panel-body">
                <div className="adh-graph__panel-name">{panelTitle}</div>
                {focusSite && (
                  <a
                    className="adh-graph__panel-url"
                    href={`https://${focusSite.prodHost}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {`https://${focusSite.prodHost}`}
                  </a>
                )}
                {focusSite && (
                  <p className="adh-graph__panel-intro">
                    {siteHeaderTitle(focusSite)} is one of the sites in the{' '}
                    <a
                      className="adh-graph__panel-intro-link"
                      href={nodeHref(tree, tree.id)}
                      onClick={(e) => {
                        e.preventDefault()
                        drill(tree.id)
                      }}
                    >
                      Agentic Developer Hub
                    </a>{' '}
                    ecosystem.
                  </p>
                )}
                {/* The blurb carries a traveling "distortion lens" that rides over
                    it in reading order (right-to-left in RTL locales). Paused while
                    the card is hidden or "reduce animation" is on; re-splits per
                    focus. The warm shift is toward the focused node's accent. */}
                <TextBubble
                  as="p"
                  className="adh-graph__panel-desc"
                  text={focus.blurb}
                  active={disclosed && !reduceMotion}
                  resetKey={focus.id}
                  colorTo="var(--cg-accent)"
                  pauseMs={2000}
                />
                {isCurrentSite && (
                  <div className="adh-graph__panel-foot">
                    <span className="adh-graph__panel-here">
                      <MapPin size={13} aria-hidden="true" /> You are Here!
                    </span>
                  </div>
                )}
              </div>
            </InfoPanel>
          </motion.div>
        </motion.div>

          {/* A personal note from the founder, styled like a message / notification.
              Overlays the panel slot, bottom-aligned. Always mounted so it can CROSS-FADE
              with the info panel on disclose (note fades out as the panel fades in).
              Clicking it bubbles up to disclose; links navigate out. */}
          <motion.div
            className="adh-graph__intro"
            role="note"
            aria-label="A note from the founder"
            aria-hidden={disclosed}
            initial={false}
            animate={{ opacity: disclosed ? 0 : 1 }}
            transition={bounce}
            style={{ pointerEvents: disclosed ? 'none' : 'auto' }}
          >
              <div className="adh-graph__intro-head">
                <div className="adh-graph__intro-headrow">
                  <Megaphone className="adh-graph__intro-icon" size={16} aria-hidden="true" />
                  <span className="adh-graph__intro-title">Click the Hub to explore!</span>
                  <span className="adh-graph__intro-when">just now</span>
                </div>
                <div className="adh-graph__intro-from">
                  From:{' '}
                  <a
                    className="adh-graph__intro-fromlink"
                    href="https://agenticdeveloperhub.com/mikefullerton"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @mikefullerton
                  </a>
                </div>
              </div>
              <div className="adh-graph__intro-msg">
                <p>The Hub is everything your agents need to become real software.</p>
                <p>This map is the fastest way to see how — click around.</p>
                <p className="adh-graph__intro-sign">— Mike</p>
                <p className="adh-graph__intro-ps">
                  P.S. Prefer a traditional tour?{' '}
                  <a
                    className="adh-graph__intro-link"
                    href="/details"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Browse the details instead →
                  </a>
                </p>
              </div>
          </motion.div>
        </div>

        <div className="adh-graph__toggles">
          {/* always available — arm reduce-motion before the first disclose too */}
          <div className="adh-graph__reduce-motion">
            <Checkbox
              id="adh-reduce-motion"
              checked={reduceMotion}
              onCheckedChange={(c) => toggleReduceMotion(c === true)}
            />
            <label htmlFor="adh-reduce-motion">reduce animation</label>
          </div>
          {/* dev aid: local only */}
          {isLocalEnv && (
            <div className="adh-graph__reduce-motion">
              <Checkbox
                id="adh-slow-motion"
                checked={slow}
                onCheckedChange={(c) => setSlow(c === true)}
              />
              <label htmlFor="adh-slow-motion">slow animations (10×)</label>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}
