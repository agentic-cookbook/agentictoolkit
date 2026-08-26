'use client'

"use client";

// src/graph/ConceptGraphClient.tsx
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  MotionConfig,
  useAnimationControls,
  usePresence,
  useMotionValue,
  useTransform
} from "motion/react";
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
  Wrench
} from "lucide-react";
import { InfoPanel } from "@agenticdevelopertoolkit/ui/blocks/info-panel";
import { Checkbox } from "@agenticdevelopertoolkit/ui/components/checkbox";
import { TextBubble } from "@agenticdevelopertoolkit/ui/components/text-bubble";
import { detectEnv, getSite, siteHeaderTitle } from "@agentic-toolkit/adh-registry";
import { useClientHost } from "@agentic-toolkit/adh/header";

// src/graph/layout.ts
var FOCUS_X = 50;
var FOCUS_Y = 42;
var RING_RADIUS = 30;
var PARENT_ANGLE_DEG = 180;
var PANEL_ANGLE_DEG = 90;
var PARENT_GAP_DEG = 60;
var PANEL_GAP_DEG = 10;
function parentSpot() {
  return { x: FOCUS_X - RING_RADIUS, y: FOCUS_Y };
}
function placeChildren(kids, reserveParent = false) {
  const n = kids.length;
  const place = (node, angleDeg) => {
    const a = angleDeg * Math.PI / 180;
    return {
      node,
      xPct: FOCUS_X + Math.cos(a) * RING_RADIUS,
      yPct: FOCUS_Y + Math.sin(a) * RING_RADIUS
    };
  };
  if (!reserveParent) {
    return kids.map(
      (node, i) => place(node, n === 1 ? -50 : 90 + 360 / n * (i + 0.5))
    );
  }
  const start = PARENT_ANGLE_DEG + PARENT_GAP_DEG / 2;
  const beforeNotch = PANEL_ANGLE_DEG + 360 - PANEL_GAP_DEG / 2 - start;
  const avail = 360 - PARENT_GAP_DEG - PANEL_GAP_DEG;
  return kids.map((node, i) => {
    const t = avail * (i + 0.5) / n;
    const angleDeg = t <= beforeNotch ? start + t : start + t + PANEL_GAP_DEG;
    return place(node, angleDeg);
  });
}
function findGraphNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findGraphNode(child, id);
    if (found) return found;
  }
  return null;
}
function graphChain(root, id) {
  const path = [];
  const dfs = (n) => {
    path.push(n);
    if (n.id === id) return true;
    for (const child of n.children) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  };
  dfs(root);
  return path.length ? path : [root];
}

// src/graph/ConceptGraphClient.tsx
import { Fragment as Fragment2, jsx, jsxs } from "react/jsx-runtime";
var PANEL_LINE_Y = 103.4;
var FOCUS_ARROW_BACKOFF = 12;
var CHILD_ARROW_GAP = 1.5;
var SITE_HALF_HEIGHT = 2;
var siteHalfWidth = (chars) => 2.7 + 0.37 * chars;
var REM_PX = 16;
var CHART_REM = 44;
var remToHalfUnit = (rem) => rem * REM_PX * 0.62 / (CHART_REM * REM_PX / 100) / 2;
var SCALE = {
  center: 1,
  child: 0.62,
  // the parent orb to the left — a dimmed, slightly-smaller replica of the orb
  // you'd return to (kind glyph + name), styled to recede vs the child orbs.
  parent: 0.68
};
var Z = { center: 4, child: 3, parent: 3 };
var COLLAPSE_SCALE = 0.2;
var SHAPE_CLIP = {
  learn: "polygon(50% 5%, 95% 92%, 5% 92%)",
  sell: "polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)",
  build: "polygon(12% 12%, 88% 12%, 88% 88%, 12% 88%)",
  community: "polygon(50% 3%, 97% 39%, 79% 97%, 21% 97%, 3% 39%)",
  connect: "polygon(27% 6%, 73% 6%, 98% 50%, 73% 94%, 27% 94%, 2% 50%)",
  plan: "polygon(24% 12%, 94% 12%, 76% 88%, 6% 88%)",
  hire: "polygon(22% 14%, 78% 14%, 95% 86%, 5% 86%)"
};
var TRAIL_SCALE_STEP = 0.5;
var TRAIL_DIM_STEP = 0.58;
var FLYOUT_LINE_LEN = 5.5;
var BOUNCE = { type: "spring", stiffness: 300, damping: 18, mass: 1 };
var SETTLE = { type: "spring", stiffness: 240, damping: 30, mass: 0.9 };
var INSTANT = { duration: 0 };
var REDUCE_MOTION_KEY = "adh:reduce-animation";
var slowSpring = (s, slow, factor) => slow ? { ...s, stiffness: s.stiffness / (factor * factor), damping: s.damping / factor } : s;
var lerp = (a, b, p) => a + (b - a) * p;
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var FOCUS = { x: FOCUS_X, y: FOCUS_Y };
function orbWord(label) {
  return label.split(/\s+/)[0] || label;
}
function nodeHref(node, rootId) {
  return node.hasDetail ? `/details/${node.id}` : node.id === rootId ? "/" : `/?focus=${node.id}`;
}
function ringWidthRem(node) {
  const maxChars = node.children.reduce((m, n) => Math.max(m, orbWord(n.label).length), 0);
  return Math.min(16.5, maxChars * 0.55 * 1.4 + 4);
}
function childRadialHalf(node, ux, uy, ringOrbHalf) {
  if (node.kind === "category" || node.kind === "root") return ringOrbHalf;
  const isSite = node.kind === "site";
  const halfW = isSite ? siteHalfWidth(orbWord(node.label).length) : ringOrbHalf;
  const halfH = isSite ? SITE_HALF_HEIGHT : ringOrbHalf / 2.5;
  const tx = Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}
var KIND_ICON = { root: Sun, category: Layers, site: Globe, feature: Puzzle };
var NODE_GLYPH = {
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
  consulting: Briefcase
};
function glyphFor(node) {
  return NODE_GLYPH[node.id] ?? KIND_ICON[node.kind];
}
function spotInView(tree, viewFocusId, targetId) {
  const vf = findGraphNode(tree, viewFocusId) ?? tree;
  if (targetId === vf.id) return FOCUS;
  const chain = graphChain(tree, vf.id);
  const ancestors = chain.slice(0, -1);
  if (ancestors.some((a) => a.id === targetId)) return parentSpot();
  const ring = placeChildren(vf.children, ancestors.length > 0);
  const slot = ring.find((c) => c.node.id === targetId);
  return slot ? { x: slot.xPct, y: slot.yPct } : FOCUS;
}
function buildSpecs(tree, focusNode, staticCenter) {
  const chain = graphChain(tree, focusNode.id);
  const parent = chain.length >= 2 ? chain[chain.length - 2] : null;
  const ringNodes = focusNode.children;
  const ring = placeChildren(ringNodes, parent != null);
  const ringOrbWidthRem = ringWidthRem(focusNode);
  const ringOrbHalf = remToHalfUnit(ringOrbWidthRem);
  const orbs = [];
  const edges = [];
  const center = {
    key: `node:${focusNode.id}`,
    node: focusNode,
    role: "center",
    fromScale: staticCenter ? SCALE.center : SCALE.child,
    toX: FOCUS_X,
    toY: FOCUS_Y,
    toScale: SCALE.center,
    z: Z.center,
    fade: false
  };
  orbs.push(center);
  ring.forEach((c) => {
    orbs.push({
      key: `node:${c.node.id}`,
      node: c.node,
      role: "child",
      fromScale: COLLAPSE_SCALE,
      toX: c.xPct,
      toY: c.yPct,
      toScale: SCALE.child,
      z: Z.child,
      fade: true
    });
    const dx = c.xPct - FOCUS_X;
    const dy = c.yPct - FOCUS_Y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const boundary = childRadialHalf(c.node, ux, uy, ringOrbHalf);
    const d = boundary + CHILD_ARROW_GAP;
    const target = { x: c.xPct - ux * d, y: c.yPct - uy * d };
    const offX = c.xPct - target.x;
    const offY = c.yPct - target.y;
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
      arrow: true
    });
  });
  if (parent) {
    const p = parentSpot();
    orbs.push({
      key: `node:${parent.id}`,
      node: parent,
      role: "parent",
      fromScale: COLLAPSE_SCALE,
      toX: p.x,
      toY: p.y,
      toScale: SCALE.parent,
      z: Z.parent,
      fade: true
    });
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
      arrow: true
    });
  }
  return { orbs, edges, center, ringOrbWidthRem };
}
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
  onHoverEnd
}) {
  const left = useTransform(() => `${lerp(originX.get(), spec.toX, progress.get())}%`);
  const top = useTransform(() => `${lerp(originY.get(), spec.toY, progress.get())}%`);
  const scale = useTransform(progress, (p) => lerp(spec.fromScale, spec.toScale, p));
  const opacity = useTransform(progress, (p) => spec.fade ? clamp(p * 4, 0, 1) : 1);
  const effAccent = accent != null && spec.dim != null && spec.dim < 1 ? `color-mix(in srgb, ${accent} ${Math.round(spec.dim * 100)}%, var(--cg-dim))` : accent;
  const flyoutHover = spec.role === "child" && onHoverStart != null;
  const NodeGlyph = glyphFor(spec.node);
  const isSun = spec.node.kind === "root" && spec.role === "center";
  const label = orbWord(spec.node.label);
  const nodeVars = {};
  if (effAccent != null) nodeVars["--cg-accent"] = effAccent;
  const shapeClip = SHAPE_CLIP[spec.node.id];
  if (shapeClip != null) nodeVars["--shape"] = shapeClip;
  return /* @__PURE__ */ jsx(
    motion.div,
    {
      className: "adh-graph__pos",
      style: { translateX: "-50%", translateY: "-50%", zIndex: spec.z, left, top, scale, opacity },
      children: /* @__PURE__ */ jsx(
        "a",
        {
          href,
          className: "adh-graph__node",
          "data-role": spec.role,
          "data-kind": spec.node.kind,
          "data-node-id": spec.node.id,
          "aria-current": spec.role === "center" ? "true" : void 0,
          "aria-label": spec.node.label,
          onClick,
          onMouseEnter: flyoutHover ? () => {
            if (progress.get() < 0.99) return;
            onHoverStart?.(spec.node, spec.toX, spec.toY, accent);
          } : void 0,
          onMouseLeave: flyoutHover ? onHoverEnd : void 0,
          style: Object.keys(nodeVars).length > 0 ? nodeVars : void 0,
          children: /* @__PURE__ */ jsxs("span", { className: "adh-graph__bubble", children: [
            isSun && /* @__PURE__ */ jsx(
              motion.span,
              {
                className: "adh-graph__sun-aura",
                "aria-hidden": "true",
                animate: reduceMotion ? { scale: 1, opacity: 0.6 } : { scale: [1, 1.16, 1.04, 1.12, 1], opacity: [0.5, 0.85, 0.62, 0.8, 0.5] },
                transition: reduceMotion ? INSTANT : { duration: 6.5 * slowFactor, repeat: Infinity, ease: "easeInOut" }
              }
            ),
            /* @__PURE__ */ jsx(NodeGlyph, { className: "adh-graph__glyph", size: 24, "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { className: "adh-graph__label", children: label })
          ] })
        }
      )
    }
  );
}
function GraphFlyout({
  node,
  x,
  y,
  accent,
  ringOrbHalf,
  onEnter,
  onLeave,
  onActivate
}) {
  const [isPresent] = usePresence();
  const hoverEvents = isPresent ? "auto" : "none";
  const dx = x - FOCUS_X;
  const dy = y - FOCUS_Y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const angleDeg = Math.atan2(uy, ux) * 180 / Math.PI;
  const startD = childRadialHalf(node, ux, uy, ringOrbHalf) + CHILD_ARROW_GAP;
  const sx = x + ux * startD;
  const sy = y + uy * startD;
  const ex = x + ux * (startD + FLYOUT_LINE_LEN);
  const ey = y + uy * (startD + FLYOUT_LINE_LEN);
  const tx = ux > 0.25 ? "0%" : ux < -0.25 ? "-100%" : "-50%";
  const ty = uy > 0.25 ? "0%" : uy < -0.25 ? "-100%" : "-50%";
  const FlyoutGlyph = glyphFor(node);
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      className: "adh-graph__flyout",
      style: accent ? { "--cg-accent": accent } : void 0,
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.14 },
      children: [
        /* @__PURE__ */ jsx(
          "svg",
          {
            className: "adh-graph__flyout-edges",
            viewBox: "0 0 100 100",
            preserveAspectRatio: "none",
            "aria-hidden": "true",
            children: /* @__PURE__ */ jsx("line", { x1: sx, y1: sy, x2: ex, y2: ey, vectorEffect: "non-scaling-stroke" })
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "adh-graph__flyout-corridor",
            style: {
              left: `${sx}%`,
              top: `${sy}%`,
              width: `${FLYOUT_LINE_LEN}%`,
              transform: `translateY(-50%) rotate(${angleDeg}deg)`,
              transformOrigin: "0 50%",
              pointerEvents: hoverEvents
            },
            onMouseEnter: onEnter,
            onMouseLeave: onLeave,
            onClick: onActivate
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "adh-graph__flyout-card",
            style: {
              left: `${ex}%`,
              top: `${ey}%`,
              transform: `translate(${tx}, ${ty})`,
              pointerEvents: hoverEvents
            },
            onMouseEnter: onEnter,
            onMouseLeave: onLeave,
            onClick: onActivate,
            children: /* @__PURE__ */ jsx(
              InfoPanel,
              {
                className: "adh-graph__flyout-panel",
                icon: /* @__PURE__ */ jsx(FlyoutGlyph, { size: 13, className: "adh-graph__flyout-icon", "aria-hidden": "true" }),
                title: node.label,
                ariaLabel: node.label,
                children: /* @__PURE__ */ jsx("p", { className: "adh-graph__flyout-desc", children: node.blurb })
              }
            )
          }
        )
      ]
    }
  );
}
function RingEdge({
  originX,
  originY,
  progress,
  spec
}) {
  const x1 = useTransform(() => lerp(originX.get() + spec.off1X, spec.to1X, progress.get()));
  const y1 = useTransform(() => lerp(originY.get() + spec.off1Y, spec.to1Y, progress.get()));
  const x2 = useTransform(() => lerp(originX.get() + spec.off2X, spec.to2X, progress.get()));
  const y2 = useTransform(() => lerp(originY.get() + spec.off2Y, spec.to2Y, progress.get()));
  const opacity = useTransform(progress, (p) => clamp(p * 2.4, 0, 0.6));
  return /* @__PURE__ */ jsx(
    motion.line,
    {
      x1,
      y1,
      x2,
      y2,
      style: { opacity },
      vectorEffect: "non-scaling-stroke",
      markerEnd: spec.arrow ? "url(#adh-back-arrow)" : void 0
    }
  );
}
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
  retractToRef
}) {
  const [isPresent, safeToRemove] = usePresence();
  const originX = useMotionValue(deployFrom.x);
  const originY = useMotionValue(deployFrom.y);
  const progress = useMotionValue(0);
  const opacity = useMotionValue(1);
  const deployTransitionRef = useRef(deployTransition);
  deployTransitionRef.current = deployTransition;
  const retractTransitionRef = useRef(retractTransition);
  retractTransitionRef.current = retractTransition;
  const staticCenter = isPresent && isInitial;
  const specs = useMemo(() => buildSpecs(tree, node, staticCenter), [tree, node, staticCenter]);
  const ringOrbWidth = `${specs.ringOrbWidthRem.toFixed(2)}rem`;
  const panelX = useTransform(() => lerp(originX.get(), FOCUS_X, progress.get()));
  const panelY = useTransform(() => lerp(originY.get(), FOCUS_Y, progress.get()));
  const panelOpacity = useTransform(progress, (p) => clamp((p - 0.45) * 1.6, 0, 0.6));
  useEffect(() => {
    if (isPresent) {
      const a2 = animate(progress, disclosed ? 1 : 0, deployTransitionRef.current);
      if (disclosed) return () => a2.stop();
      const ox2 = animate(originX, FOCUS_X, deployTransitionRef.current);
      const oy2 = animate(originY, FOCUS_Y, deployTransitionRef.current);
      return () => {
        a2.stop();
        ox2.stop();
        oy2.stop();
      };
    }
    const t = retractTransitionRef.current;
    const fade = reduceMotion ? INSTANT : { duration: 0.18 * slowFactor };
    const rt = retractToRef.current.get(layerId) ?? FOCUS;
    const a = animate(progress, 0, t);
    const b = animate(opacity, 0, fade);
    const ox = animate(originX, rt.x, t);
    const oy = animate(originY, rt.y, t);
    let done = false;
    b.finished.then(() => {
      if (!done) safeToRemove();
    });
    return () => {
      done = true;
      a.stop();
      b.stop();
      ox.stop();
      oy.stop();
    };
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
    slowFactor
  ]);
  return /* @__PURE__ */ jsxs(
    motion.div,
    {
      className: "adh-graph__layer",
      style: { opacity, pointerEvents: isPresent ? "auto" : "none" },
      children: [
        /* @__PURE__ */ jsxs(
          "svg",
          {
            className: "adh-graph__edges",
            viewBox: "0 0 100 100",
            preserveAspectRatio: "none",
            "aria-hidden": "true",
            children: [
              /* @__PURE__ */ jsx(
                motion.line,
                {
                  className: "adh-graph__panel-line",
                  x1: panelX,
                  y1: panelY,
                  x2: FOCUS_X,
                  y2: PANEL_LINE_Y,
                  style: { opacity: panelOpacity },
                  vectorEffect: "non-scaling-stroke"
                }
              ),
              specs.edges.map((edge) => /* @__PURE__ */ jsx(RingEdge, { originX, originY, progress, spec: edge }, edge.key))
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "contents", "--ring-orb-w": ringOrbWidth }, children: specs.orbs.map((orb) => /* @__PURE__ */ jsx(
          RingOrb,
          {
            originX,
            originY,
            progress,
            spec: orb,
            href: nodeHref(orb.node, rootId),
            accent: accentById.get(orb.node.id),
            reduceMotion,
            slowFactor,
            onClick: (e) => onNodeClick(e, orb.node, orb.role),
            onHoverStart: onChildHoverStart,
            onHoverEnd: onChildHoverEnd
          },
          orb.key
        )) })
      ]
    }
  );
}
function BackTrail({
  ancestors,
  accentById,
  onSelect,
  transition
}) {
  if (ancestors.length === 0) return null;
  return /* @__PURE__ */ jsxs("div", { className: "adh-graph__trail", "aria-label": "Back to a parent", children: [
    ancestors.map((anc, i) => {
      const clip = SHAPE_CLIP[anc.id];
      const radius = anc.kind === "root" ? "50%" : anc.kind === "feature" ? "999px" : anc.kind === "site" ? "0.3rem" : "0";
      const dRight = ancestors.length - 1 - i;
      const steadyScale = TRAIL_SCALE_STEP ** dRight;
      const steadyOpacity = TRAIL_DIM_STEP ** dRight;
      const Glyph = glyphFor(anc);
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        i > 0 && /* @__PURE__ */ jsx("span", { className: "adh-graph__trail-line", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx(
          motion.button,
          {
            type: "button",
            className: "adh-graph__trail-shape",
            "data-kind": anc.kind,
            style: {
              "--cg-accent": accentById.get(anc.id) ?? "var(--color-accent, #c4a35a)",
              "--shape": clip ?? "none",
              borderRadius: clip ? "0" : radius
            },
            title: anc.label,
            "aria-label": `Back to ${anc.label}`,
            initial: { scale: 2, x: 52, opacity: 0 },
            animate: { scale: steadyScale, x: 0, opacity: steadyOpacity },
            whileHover: { scale: steadyScale * 1.3, opacity: 1 },
            transition,
            onClick: (e) => {
              e.stopPropagation();
              onSelect(anc.id);
            },
            children: /* @__PURE__ */ jsx(Glyph, { className: "adh-graph__trail-icon", size: 16, "aria-hidden": "true" })
          }
        )
      ] }, anc.id);
    }),
    /* @__PURE__ */ jsx("span", { className: "adh-graph__trail-line", "aria-hidden": "true" })
  ] });
}
function ConceptGraphClient({
  tree,
  initialFocusId,
  eyebrow,
  titleLead,
  titleAccent,
  currentSiteId,
  env
}) {
  const [focusId, setFocusId] = useState(initialFocusId);
  const accentById = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    const walk = (n, inherited) => {
      const eff = n.accent ?? inherited;
      if (eff) map.set(n.id, eff);
      n.children.forEach((c) => walk(c, eff));
    };
    walk(tree);
    return map;
  }, [tree]);
  const [disclosed, setDisclosed] = useState(false);
  const [deployFrom, setDeployFrom] = useState(null);
  const retractToRef = useRef(/* @__PURE__ */ new Map());
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(REDUCE_MOTION_KEY) === "1") setReduceMotion(true);
    } catch {
    }
  }, []);
  const toggleReduceMotion = useCallback((on) => {
    setReduceMotion(on);
    try {
      window.localStorage.setItem(REDUCE_MOTION_KEY, on ? "1" : "0");
    } catch {
    }
  }, []);
  const [slow, setSlow] = useState(false);
  const host = useClientHost();
  const isLocalEnv = host != null && detectEnv(host) === "local";
  const slowFactor = slow ? 10 : 1;
  const deployTransition = useMemo(
    () => reduceMotion ? INSTANT : slowSpring(BOUNCE, slow, slowFactor),
    [reduceMotion, slow, slowFactor]
  );
  const retractTransition = useMemo(
    () => reduceMotion ? INSTANT : slowSpring(SETTLE, slow, slowFactor),
    [reduceMotion, slow, slowFactor]
  );
  const bounce = deployTransition;
  const panelControls = useAnimationControls();
  const bouncePanel = useCallback(() => {
    if (reduceMotion) return;
    void panelControls.start({
      scale: [1, 1.05, 0.99, 1],
      transition: { duration: 0.5, times: [0, 0.35, 0.7, 1], ease: "easeInOut" }
    });
  }, [panelControls, reduceMotion]);
  const [flyout, setFlyout] = useState(null);
  const flyoutCloseTimer = useRef(null);
  const movedSinceNav = useRef(false);
  useEffect(() => {
    const onMove = () => {
      movedSinceNav.current = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  const clearFlyoutTimer = useCallback(() => {
    if (flyoutCloseTimer.current != null) {
      window.clearTimeout(flyoutCloseTimer.current);
      flyoutCloseTimer.current = null;
    }
  }, []);
  const openFlyout = useCallback(
    (node, x, y, accent) => {
      if (!movedSinceNav.current) return;
      clearFlyoutTimer();
      setFlyout({ node, x, y, accent });
    },
    [clearFlyoutTimer]
  );
  const keepFlyout = useCallback(() => clearFlyoutTimer(), [clearFlyoutTimer]);
  const closeFlyoutSoon = useCallback(() => {
    clearFlyoutTimer();
    flyoutCloseTimer.current = window.setTimeout(() => setFlyout(null), 140);
  }, [clearFlyoutTimer]);
  useEffect(() => clearFlyoutTimer, [clearFlyoutTimer]);
  const drill = useCallback(
    (id) => {
      if (id === focusId) return;
      clearFlyoutTimer();
      setFlyout(null);
      movedSinceNav.current = false;
      const prev = focusId;
      setDeployFrom(spotInView(tree, prev, id));
      retractToRef.current.set(prev, spotInView(tree, id, prev));
      setFocusId(id);
      setDisclosed(true);
      if (typeof window !== "undefined") {
        const url = id === tree.id ? window.location.pathname : `?focus=${id}`;
        window.history.replaceState(null, "", url);
      }
    },
    [focusId, tree, clearFlyoutTimer]
  );
  const focus = useMemo(() => findGraphNode(tree, focusId) ?? tree, [tree, focusId]);
  const chain = useMemo(() => graphChain(tree, focus.id), [tree, focus.id]);
  const parent = chain.length >= 2 ? chain[chain.length - 2] : null;
  const focusRingOrbHalf = useMemo(() => remToHalfUnit(ringWidthRem(focus)), [focus]);
  const focusSite = focus.siteId ? getSite(focus.siteId) : void 0;
  const focusAccent = accentById.get(focus.id);
  const panelTitle = focusSite ? siteHeaderTitle(focusSite) : focus.label;
  const isCurrentSite = focusSite != null && focus.siteId === currentSiteId;
  const isHubLanding = initialFocusId === tree.id;
  const onNodeClick = useCallback(
    (e, node, role) => {
      e.preventDefault();
      e.stopPropagation();
      if (role === "center") {
        if (!disclosed) {
          movedSinceNav.current = false;
          setDisclosed(true);
          return;
        }
        if (node.id === tree.id) {
          clearFlyoutTimer();
          setFlyout(null);
          movedSinceNav.current = false;
          setDeployFrom(null);
          setDisclosed(false);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
          return;
        }
        bouncePanel();
        return;
      }
      drill(node.id);
    },
    [disclosed, drill, tree.id, clearFlyoutTimer, bouncePanel]
  );
  const onBackdrop = () => {
    if (disclosed && parent) drill(parent.id);
  };
  const parentId = parent?.id;
  useEffect(() => {
    if (!parentId) return;
    const onKey = (e) => {
      if (e.key !== "Escape" && e.key !== "Backspace") return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      drill(parentId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parentId, drill]);
  const titleHeader = /* @__PURE__ */ jsxs("header", { className: "adh-graph__page", children: [
    eyebrow && eyebrow.trim().toLowerCase() !== (titleLead ?? "").trim().toLowerCase() && /* @__PURE__ */ jsx("p", { className: "adh-graph__page-eyebrow", children: eyebrow }),
    /* @__PURE__ */ jsxs("h1", { className: "adh-graph__page-title", children: [
      isHubLanding && /* @__PURE__ */ jsx("span", { className: "adh-graph__page-title-lead", children: "the " }),
      titleLead && /* @__PURE__ */ jsxs(Fragment2, { children: [
        titleLead,
        " "
      ] }),
      /* @__PURE__ */ jsx("span", { className: "adh-graph__page-title-accent", children: titleAccent })
    ] })
  ] });
  if (env === "production") {
    return /* @__PURE__ */ jsx(MotionConfig, { reducedMotion: reduceMotion ? "always" : "never", children: /* @__PURE__ */ jsxs("div", { className: "adh-graph adh-graph--coming", children: [
      titleHeader,
      /* @__PURE__ */ jsx("div", { className: "adh-graph__coming", role: "status", children: /* @__PURE__ */ jsx("p", { className: "adh-graph__coming-text", children: "Coming soon!" }) })
    ] }) });
  }
  return /* @__PURE__ */ jsx(MotionConfig, { reducedMotion: reduceMotion ? "always" : "never", children: /* @__PURE__ */ jsxs("div", { className: "adh-graph", children: [
    titleHeader,
    /* @__PURE__ */ jsxs("div", { className: "adh-graph__chart", onClick: onBackdrop, children: [
      /* @__PURE__ */ jsx(
        "svg",
        {
          className: "adh-graph__edges",
          viewBox: "0 0 100 100",
          preserveAspectRatio: "none",
          "aria-hidden": "true",
          children: /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx(
            "marker",
            {
              id: "adh-back-arrow",
              viewBox: "0 0 10 10",
              refX: "9",
              refY: "5",
              markerUnits: "userSpaceOnUse",
              markerWidth: "3.4",
              markerHeight: "3.4",
              orient: "auto",
              overflow: "visible",
              children: /* @__PURE__ */ jsx(
                "path",
                {
                  className: "adh-graph__edge-arrow",
                  d: "M1,1 L9,5 L1,9",
                  vectorEffect: "non-scaling-stroke"
                }
              )
            }
          ) })
        }
      ),
      /* @__PURE__ */ jsx(AnimatePresence, { initial: false, children: /* @__PURE__ */ jsx(
        RingLayer,
        {
          tree,
          node: focus,
          layerId: focus.id,
          deployFrom: deployFrom ?? FOCUS,
          isInitial: deployFrom == null,
          disclosed,
          deployTransition,
          retractTransition,
          reduceMotion,
          slowFactor,
          rootId: tree.id,
          accentById,
          onNodeClick,
          onChildHoverStart: openFlyout,
          onChildHoverEnd: closeFlyoutSoon,
          retractToRef
        },
        focus.id
      ) }),
      /* @__PURE__ */ jsx(AnimatePresence, { children: disclosed && flyout && /* @__PURE__ */ jsx(
        GraphFlyout,
        {
          node: flyout.node,
          x: flyout.x,
          y: flyout.y,
          accent: flyout.accent,
          ringOrbHalf: focusRingOrbHalf,
          onEnter: keepFlyout,
          onLeave: closeFlyoutSoon,
          onActivate: (e) => onNodeClick(e, flyout.node, "child")
        },
        flyout.node.id
      ) }),
      disclosed && /* @__PURE__ */ jsx(
        BackTrail,
        {
          ancestors: chain.slice(0, -2),
          accentById,
          onSelect: drill,
          transition: deployTransition
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "adh-graph__panel-slot", children: [
      /* @__PURE__ */ jsx(
        motion.div,
        {
          className: "adh-graph__panel-wrap",
          initial: false,
          animate: { opacity: disclosed ? 1 : 0 },
          transition: bounce,
          style: { pointerEvents: disclosed ? "auto" : "none" },
          children: /* @__PURE__ */ jsx(
            motion.div,
            {
              className: "adh-graph__panel-bounce",
              initial: { scale: 1 },
              animate: panelControls,
              children: /* @__PURE__ */ jsx(
                InfoPanel,
                {
                  className: "adh-graph__panel",
                  ariaLabel: focus.label,
                  scroll: true,
                  flex: "0 0 auto",
                  style: focusAccent ? { "--cg-accent": focusAccent } : void 0,
                  title: /* @__PURE__ */ jsx("span", { className: "adh-graph__panel-crumbs", children: chain.map((n, i) => {
                    const SegIcon = glyphFor(n);
                    return /* @__PURE__ */ jsxs(
                      "span",
                      {
                        className: "adh-graph__panel-crumb",
                        style: {
                          "--cg-accent": accentById.get(n.id) ?? "var(--color-accent, #c4a35a)"
                        },
                        children: [
                          i > 0 && /* @__PURE__ */ jsx("span", { className: "adh-graph__panel-crumb-sep", "aria-hidden": "true", children: ">" }),
                          /* @__PURE__ */ jsxs(
                            "a",
                            {
                              className: "adh-graph__panel-crumb-link",
                              href: nodeHref(n, tree.id),
                              "aria-current": i === chain.length - 1 ? "page" : void 0,
                              onClick: (e) => {
                                e.preventDefault();
                                drill(n.id);
                              },
                              children: [
                                /* @__PURE__ */ jsx(
                                  SegIcon,
                                  {
                                    size: 13,
                                    className: "adh-graph__panel-crumb-icon",
                                    "aria-hidden": "true"
                                  }
                                ),
                                /* @__PURE__ */ jsx("span", { className: "adh-graph__panel-crumb-label", children: orbWord(n.label) })
                              ]
                            }
                          )
                        ]
                      },
                      n.id
                    );
                  }) }),
                  actions: focus.hasDetail ? /* @__PURE__ */ jsx("a", { className: "adh-graph__panel-details", href: `/details/${focus.id}`, children: "Details \u2192" }) : void 0,
                  children: /* @__PURE__ */ jsxs("div", { className: "adh-graph__panel-body", children: [
                    /* @__PURE__ */ jsx("div", { className: "adh-graph__panel-name", children: panelTitle }),
                    focusSite && /* @__PURE__ */ jsx(
                      "a",
                      {
                        className: "adh-graph__panel-url",
                        href: `https://${focusSite.prodHost}/`,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        children: `https://${focusSite.prodHost}`
                      }
                    ),
                    focusSite && /* @__PURE__ */ jsxs("p", { className: "adh-graph__panel-intro", children: [
                      siteHeaderTitle(focusSite),
                      " is one of the sites in the",
                      " ",
                      /* @__PURE__ */ jsx(
                        "a",
                        {
                          className: "adh-graph__panel-intro-link",
                          href: nodeHref(tree, tree.id),
                          onClick: (e) => {
                            e.preventDefault();
                            drill(tree.id);
                          },
                          children: "Agentic Developer Hub"
                        }
                      ),
                      " ",
                      "ecosystem."
                    ] }),
                    /* @__PURE__ */ jsx(
                      TextBubble,
                      {
                        as: "p",
                        className: "adh-graph__panel-desc",
                        text: focus.blurb,
                        active: disclosed && !reduceMotion,
                        resetKey: focus.id,
                        colorTo: "var(--cg-accent)",
                        pauseMs: 2e3
                      }
                    ),
                    isCurrentSite && /* @__PURE__ */ jsx("div", { className: "adh-graph__panel-foot", children: /* @__PURE__ */ jsxs("span", { className: "adh-graph__panel-here", children: [
                      /* @__PURE__ */ jsx(MapPin, { size: 13, "aria-hidden": "true" }),
                      " You are Here!"
                    ] }) })
                  ] })
                }
              )
            },
            focus.id
          )
        }
      ),
      /* @__PURE__ */ jsxs(
        motion.div,
        {
          className: "adh-graph__intro",
          role: "note",
          "aria-label": "A note from the founder",
          "aria-hidden": disclosed,
          initial: false,
          animate: { opacity: disclosed ? 0 : 1 },
          transition: bounce,
          style: { pointerEvents: disclosed ? "none" : "auto" },
          children: [
            /* @__PURE__ */ jsxs("div", { className: "adh-graph__intro-head", children: [
              /* @__PURE__ */ jsxs("div", { className: "adh-graph__intro-headrow", children: [
                /* @__PURE__ */ jsx(Megaphone, { className: "adh-graph__intro-icon", size: 16, "aria-hidden": "true" }),
                /* @__PURE__ */ jsx("span", { className: "adh-graph__intro-title", children: "Click the Hub to explore!" }),
                /* @__PURE__ */ jsx("span", { className: "adh-graph__intro-when", children: "just now" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "adh-graph__intro-from", children: [
                "From:",
                " ",
                /* @__PURE__ */ jsx(
                  "a",
                  {
                    className: "adh-graph__intro-fromlink",
                    href: "https://agenticdeveloperhub.com/mikefullerton",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    onClick: (e) => e.stopPropagation(),
                    children: "@mikefullerton"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "adh-graph__intro-msg", children: [
              /* @__PURE__ */ jsx("p", { children: "The Hub is everything your agents need to become real software." }),
              /* @__PURE__ */ jsx("p", { children: "This map is the fastest way to see how \u2014 click around." }),
              /* @__PURE__ */ jsx("p", { className: "adh-graph__intro-sign", children: "\u2014 Mike" }),
              /* @__PURE__ */ jsxs("p", { className: "adh-graph__intro-ps", children: [
                "P.S. Prefer a traditional tour?",
                " ",
                /* @__PURE__ */ jsx(
                  "a",
                  {
                    className: "adh-graph__intro-link",
                    href: "/details",
                    onClick: (e) => e.stopPropagation(),
                    children: "Browse the details instead \u2192"
                  }
                )
              ] })
            ] })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "adh-graph__toggles", children: [
      /* @__PURE__ */ jsxs("div", { className: "adh-graph__reduce-motion", children: [
        /* @__PURE__ */ jsx(
          Checkbox,
          {
            id: "adh-reduce-motion",
            checked: reduceMotion,
            onCheckedChange: (c) => toggleReduceMotion(c === true)
          }
        ),
        /* @__PURE__ */ jsx("label", { htmlFor: "adh-reduce-motion", children: "reduce animation" })
      ] }),
      isLocalEnv && /* @__PURE__ */ jsxs("div", { className: "adh-graph__reduce-motion", children: [
        /* @__PURE__ */ jsx(
          Checkbox,
          {
            id: "adh-slow-motion",
            checked: slow,
            onCheckedChange: (c) => setSlow(c === true)
          }
        ),
        /* @__PURE__ */ jsx("label", { htmlFor: "adh-slow-motion", children: "slow animations (10\xD7)" })
      ] })
    ] })
  ] }) });
}
export {
  ConceptGraphClient
};
//# sourceMappingURL=ConceptGraphClient.js.map