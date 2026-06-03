import gsap from "gsap";
import type { Pose } from "./expressions";

/**
 * The yawn is a CHOREOGRAPHED EVENT, not a held pose. A convincing yawn is an arc
 * over time — a slow inhale that grows the mouth and stretches him up, an apex
 * where the mouth gapes and the eyes squeeze nearly shut (the reflex that makes
 * real yawns clamp your eyes), then a quick exhale that closes the mouth, drops
 * the head, and settles him with a little squash back into idle.
 *
 * The rest of the system tweens each expression to ONE static pose; the yawn is
 * the one animation that doesn't fit that model, so it lives here behind a single
 * `playYawn` call. Olylo.tsx hands "yawning" to this timeline and returns early,
 * registering the returned timeline in its loop-list so any transition out of the
 * yawn (a click, the wake timer, a new mood) kills it like every other loop.
 */

/** The DOM nodes the yawn drives — injected so this module stays DOM-agnostic. */
export interface YawnRefs {
  body: SVGGElement | null; // whole-glyph stretch (scale)
  face: SVGGElement | null; // the head nod (rotation) + chameleon color
  leftEye: SVGGElement | null;
  rightEye: SVGGElement | null;
  leftIris: SVGCircleElement | null;
  rightIris: SVGCircleElement | null;
  lLeft: SVGPathElement | null; // antennae
  lRight: SVGPathElement | null;
  browLeft: SVGGElement | null;
  browRight: SVGGElement | null;
  mouth: SVGPathElement | null;
  descender: SVGPathElement | null; // the tail under the mouth
}

// A morph-safe "O": a closed 4-anchor cubic ellipse. Every yawn mouth shape uses
// this SAME anchor structure (M + 4×C + Z), so MorphSVG maps anchor-to-anchor and
// the grow → gape → close never wobbles. (The old yawn morphed an SVG arc, whose
// normalized point-count differs from the polyline mouths — that wobble was a big
// part of why the yawn read wrong.)
const K = 0.5523; // cubic constant for approximating a quarter-circle
const oPath = (cx: number, cy: number, rx: number, ry: number): string => {
  const ox = rx * K;
  const oy = ry * K;
  return (
    `M${cx},${cy - ry}` +
    `C${cx + ox},${cy - ry} ${cx + rx},${cy - oy} ${cx + rx},${cy}` +
    `C${cx + rx},${cy + oy} ${cx + ox},${cy + ry} ${cx},${cy + ry}` +
    `C${cx - ox},${cy + ry} ${cx - rx},${cy + oy} ${cx - rx},${cy}` +
    `C${cx - rx},${cy - oy} ${cx - ox},${cy - ry} ${cx},${cy - ry}Z`
  );
};
const MOUTH_O_SMALL = oPath(160, 86, 9, 11); // lips part — start of the inhale
const MOUTH_O_WIDE = oPath(160, 84, 17, 23); // full gape at the apex — taller than wide
const MOUTH_CLOSED = oPath(160, 85, 13, 1.4); // a near-flat slit — same structure, clean close
const TAIL_O = "M160,95 L160,114"; // hangs straight from the bottom of the "O"
const TAIL_IDLE = "M160,85 L160,115"; // the straight non-Y tail the idle pose lands on

// Pivots, matched to the generic pose engine so the handoff to/from idle is seamless.
const BODY_ORIGIN = "160 50"; // between the eyes
const FACE_ORIGIN = "50% 60%"; // the lower face / "neck" — a nod, not a spin
const EYE_ORIGIN = "50% 50%";
const ANTENNA_ORIGIN = "50% 0%"; // anchored at the top of the head
const BROW_L_ORIGIN = "50 50"; // left eye centre (viewBox units)
const BROW_R_ORIGIN = "270 50"; // right eye centre

// The three beats of the yawn — the entire tuning surface. `chinUp` is degrees of
// head tilt (negative = chin up / head back); `eyeScaleY` is the squeeze (apex ≈
// shut); `bodyScale` is the stretch (apex peak, release undershoots before idle).
const INHALE = { bodyScale: 1.06, chinUp: -7, eyeScaleX: 1.0, eyeScaleY: 0.45, eyeY: -6, pupil: 0.85, antennaY: -16, antennaRot: 10, browY: -6, browRot: 6 };
const APEX = { bodyScale: 1.12, chinUp: -10, eyeScaleX: 0.96, eyeScaleY: 0.08, eyeY: -9, pupil: 0.45, antennaY: -18 };

// Phase timing (seconds). Total ≈ 2.05s, inside the ~2.8s "waking" window, leaving
// headroom for the settle to hold briefly before the window hands back to idle.
const T_INHALE = 0.85;
const T_APEX = 0.85; // squeeze + gape land here, then a beat of stillness
const T_RELEASE = 1.4;

/**
 * Build the yawn timeline. `idle` supplies the values the release settles back to,
 * so the handoff when "yawning" → "idle" has almost nothing left to move.
 */
export function playYawn(r: YawnRefs, idle: Pose, irisBaseR: number): gsap.core.Timeline {
  const tl = gsap.timeline();

  // ── INHALE / build: a slow drawn-in breath. `overwrite:"auto"` on this first
  // beat clears any still-settling tweens from the asleep pose we're waking from.
  tl.to(r.body, { scale: INHALE.bodyScale, svgOrigin: BODY_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.face, { rotation: INHALE.chinUp, transformOrigin: FACE_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.face, { color: idle.body, duration: 0.6, ease: "sine.out", overwrite: "auto" }, 0) // light back up out of camouflage
    .to([r.leftEye, r.rightEye], { scaleX: INHALE.eyeScaleX, scaleY: INHALE.eyeScaleY, y: INHALE.eyeY, transformOrigin: EYE_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to([r.leftIris, r.rightIris], { attr: { r: irisBaseR * INHALE.pupil }, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.lLeft, { rotation: -INHALE.antennaRot, y: INHALE.antennaY, transformOrigin: ANTENNA_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.lRight, { rotation: INHALE.antennaRot, y: INHALE.antennaY, transformOrigin: ANTENNA_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.browLeft, { rotation: -INHALE.browRot, y: INHALE.browY, svgOrigin: BROW_L_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.browRight, { rotation: INHALE.browRot, y: INHALE.browY, svgOrigin: BROW_R_ORIGIN, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.mouth, { morphSVG: MOUTH_O_SMALL, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)
    .to(r.descender, { morphSVG: TAIL_O, duration: T_INHALE, ease: "power2.in", overwrite: "auto" }, 0)

    // ── APEX: eyes squeeze nearly shut (lands fast), mouth gapes to its widest,
    // body reaches peak stretch — then ~0.15s of stillness before the release.
    .to([r.leftEye, r.rightEye], { scaleX: APEX.eyeScaleX, scaleY: APEX.eyeScaleY, y: APEX.eyeY, transformOrigin: EYE_ORIGIN, duration: 0.3, ease: "power2.in" }, T_APEX)
    .to([r.leftIris, r.rightIris], { attr: { r: irisBaseR * APEX.pupil }, duration: 0.3, ease: "power2.in" }, T_APEX)
    .to(r.mouth, { morphSVG: MOUTH_O_WIDE, duration: 0.4, ease: "power2.out" }, T_APEX)
    .to(r.body, { scale: APEX.bodyScale, svgOrigin: BODY_ORIGIN, duration: 0.4, ease: "power2.out" }, T_APEX)
    .to(r.face, { rotation: APEX.chinUp, transformOrigin: FACE_ORIGIN, duration: 0.4, ease: "power2.out" }, T_APEX)
    .to([r.lLeft, r.lRight], { y: APEX.antennaY, duration: 0.4, ease: "power2.out" }, T_APEX)

    // ── RELEASE / exhale: mouth closes quickly, eyes blink back open, the head
    // drops forward and levels, and the body squash-overshoots down into idle.
    .to(r.mouth, { morphSVG: MOUTH_CLOSED, duration: 0.45, ease: "power2.out" }, T_RELEASE)
    .to(r.descender, { morphSVG: TAIL_IDLE, duration: 0.5, ease: "power2.out" }, T_RELEASE + 0.15)
    .to([r.leftEye, r.rightEye], { scaleX: idle.eye.scaleX, scaleY: idle.eye.scaleY, y: 0, transformOrigin: EYE_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05)
    .to([r.leftIris, r.rightIris], { attr: { r: irisBaseR * idle.pupil }, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05)
    .to(r.body, { scale: 1, svgOrigin: BODY_ORIGIN, duration: 0.65, ease: "back.out(1.6)" }, T_RELEASE + 0.05) // squash-overshoot to idle
    .to(r.face, { rotation: 0, transformOrigin: FACE_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05) // head forward → level
    .to(r.lLeft, { rotation: idle.lLeft.rotation, y: idle.lLeft.y, transformOrigin: ANTENNA_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05)
    .to(r.lRight, { rotation: idle.lRight.rotation, y: idle.lRight.y, transformOrigin: ANTENNA_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05)
    .to(r.browLeft, { rotation: idle.browLeft.rotation, y: idle.browLeft.y, svgOrigin: BROW_L_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05)
    .to(r.browRight, { rotation: idle.browRight.rotation, y: idle.browRight.y, svgOrigin: BROW_R_ORIGIN, duration: 0.55, ease: "power2.out" }, T_RELEASE + 0.05);

  return tl;
}
