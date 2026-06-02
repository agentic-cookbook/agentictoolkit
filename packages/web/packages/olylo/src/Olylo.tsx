"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { POSES } from "./expressions";
import type { OlyloExpression } from "./expressions";
import { useBlink, useIdleLadder, useSpeech } from "./reflexes";

if (typeof window !== "undefined") {
  gsap.registerPlugin(MorphSVGPlugin);
}

const GREEN = "#00ff41";
const IRIS = "#33ccff"; // piercing icy-blue pupils (fixed — never change with mood)
const IRIS_BASE_R = 9; // base iris radius (viewBox units); poses scale it via `pupil`
const GAZE_MAX = 7; // max iris travel in viewBox units
const TWEEN = 0.45;
const EASE = "power3.out";
// Curious idle look-around: once the cursor's been still this long, he starts
// glancing about on his own, a new glance every WANDER_MIN..MAX ms.
const WANDER_AFTER_MS = 1200;
const WANDER_MIN_MS = 1400;
const WANDER_MAX_MS = 3200;
const TILT_MAX = 9; // head leans up to this many degrees toward a deliberate gaze
const LEAN_MAX = 6; // …and the whole glyph drifts up to this many units toward it

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export interface OlyloProps {
  /** Deliberate mood from a driver (chat today, persona later). */
  expression?: OlyloExpression;
  /**
   * A deliberate gaze direction, normalized: x ∈ [-1,1] (right is +), y ∈ [-1,1]
   * (down is +). e.g. `{ x: 0, y: 1 }` makes him look straight down — at an input
   * sitting below him. While set, it overrides his cursor-follow and his idle
   * look-around. Omit or pass null to hand his eyes back to those reflexes.
   */
  gaze?: { x: number; y: number } | null;
  /**
   * Reports his current effective mood whenever it changes, so a driver can
   * mirror his reflex state — e.g. show "zzz…" in a status line when he drifts
   * off to sleep on his own.
   */
  onState?: (state: OlyloExpression) => void;
}

export function Olylo({ expression, gaze = null, onState }: OlyloProps): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  // Last time the cursor drove the gaze — shared so the idle fidget knows to hold
  // still (no random sway) while he's intentionally watching the mouse.
  const watchingRef = useRef(0);
  // Transform layers, outermost first, each with a single owner so they never
  // fight: idleRef = idle fidget (sway + breath), tiltRef = head-tilt toward a
  // deliberate gaze, bodyRef = emotional scale/rotation/spin, faceRef = bob/wiggle.
  const idleRef = useRef<SVGGElement>(null);
  const tiltRef = useRef<SVGGElement>(null);
  // Pure-translate layer: the glyph drifts a touch toward whatever he's watching.
  const leanRef = useRef<SVGGElement>(null);
  // Outer group carrying the whole-glyph emotional scale + rotation (+ spin),
  // kept separate from faceRef so those never fight its bob/wiggle.
  const bodyRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftBlinkRef = useRef<SVGGElement>(null);
  const rightBlinkRef = useRef<SVGGElement>(null);
  const leftIrisRef = useRef<SVGCircleElement>(null);
  const rightIrisRef = useRef<SVGCircleElement>(null);
  // Tiny lit pupils that persist when his eyes are shut (asleep) — outside the
  // eye-scale group so the closing eyelid never squishes them flat.
  const leftDotRef = useRef<SVGCircleElement>(null);
  const rightDotRef = useRef<SVGCircleElement>(null);
  const lLeftRef = useRef<SVGRectElement>(null);
  const lRightRef = useRef<SVGRectElement>(null);
  const browLeftRef = useRef<SVGGElement>(null);
  const browRightRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const descenderRef = useRef<SVGPathElement>(null);
  const speechRef = useRef<SVGTextElement>(null);
  const loopRef = useRef<gsap.core.Tween[]>([]);

  const ladder = useIdleLadder(expression != null);

  // The resting mood (no transient click reaction): a driver-set expression, else
  // the idle ladder. Used both for display and to decide how a click lands.
  const resting: OlyloExpression =
    expression ??
    (ladder === "asleep" ? "asleep" : ladder === "bored" ? "bored" : "idle");

  // Click reaction: a transient mood that briefly outranks everything. Clicking
  // a sleeping olylo STARTLES him (antennae shoot up and wave); otherwise he
  // giggles. The startle lingers a touch longer so the wave reads.
  const [reaction, setReaction] = useState<OlyloExpression | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const poke = (): void => {
    const startled = resting === "asleep";
    setReaction(startled ? "startled" : "laughing");
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), startled ? 1700 : 1400);
  };
  useEffect(() => {
    return () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
  }, []);

  // Waking yawn: when he rouses from sleep to plain idle on his own (not jolted
  // awake by a click, not handed a deliberate mood), he yawns groggily for a
  // couple of seconds before he's properly awake.
  const [waking, setWaking] = useState<OlyloExpression | null>(null);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevResting = useRef(resting);
  useEffect(() => {
    if (prevResting.current === "asleep" && resting === "idle" && reaction !== "startled") {
      setWaking("yawning");
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
      wakeTimer.current = setTimeout(() => setWaking(null), 2800);
    }
    prevResting.current = resting;
  }, [resting, reaction]);
  useEffect(() => () => clearTimeout(wakeTimer.current), []);

  // Arbitration: a click reaction wins, then the waking yawn, then the resting mood.
  const effective: OlyloExpression = reaction ?? waking ?? resting;

  // Awake and unoccupied (the plain idle mood) → his eyes wander curiously. Once
  // he's bored/asleep or has a deliberate mood, the look-around stops.
  const curious = effective === "idle";

  // Surface his current mood so a driver can mirror it (e.g. "zzz…" when asleep).
  useEffect(() => {
    onState?.(effective);
  }, [effective, onState]);

  const eyesShut = effective === "asleep";
  const blinkEnabled = !eyesShut && effective !== "laughing";
  const leftBlinking = useBlink(blinkEnabled);
  const rightBlinking = useBlink(blinkEnabled);
  const speech = useSpeech(effective);

  // Pose: tween every part toward the target pose; morph the mouth.
  useEffect(() => {
    const p = POSES[effective];
    loopRef.current.forEach((t) => t.kill());
    loopRef.current = [];

    // Whole-glyph emotional size + rotation. Size is its own amplitude channel
    // (swells when excited, shrinks when withdrawn). Rotation settles anywhere
    // (silly hangs upside-down); spinTurns adds full whirls on entry, eased with
    // a non-uniform curve (accelerates, then settles) — never a constant spin.
    // Both pivot between the eyes so he scales/flips about his own face.
    const scale = p.scale ?? 1;
    const rotation = p.rotation ?? 0;
    const spinTurns = p.spinTurns ?? 0;
    // Size + rotation in ONE tween so they share one transform matrix (separate
    // concurrent tweens with svgOrigin fight over it). When spinning, the longer
    // duration + power3.inOut gives the non-uniform whirl-then-settle.
    // `overwrite: "auto"` is essential: React re-runs this effect (incl. Strict
    // Mode's double-invoke) and without it the duplicate transform tweens fight
    // and cancel to identity — olylo never scales or flips.
    gsap.to(bodyRef.current, {
      scale,
      rotation: rotation + 360 * spinTurns, // land at `rotation` after N whirls
      svgOrigin: "160 50", // pivot between the eyes so he scales/flips about his face
      duration: spinTurns ? 0.9 : p.dur,
      ease: spinTurns ? "power3.inOut" : p.ease,
      overwrite: "auto",
    });

    // Eyes lead (no delay); brows, antennae and mouth follow a beat later.
    // Each eye can be driven independently (eyeLeft/eyeRight) for asymmetric
    // looks like the inquisitive one-eye squint; both fall back to `eye`.
    const eyeL = p.eyeLeft ?? p.eye;
    const eyeR = p.eyeRight ?? p.eye;
    const eyeY = p.eyeY ?? 0;
    gsap.to(leftEyeRef.current, {
      scaleX: eyeL.scaleX,
      scaleY: eyeL.scaleY,
      y: eyeY,
      transformOrigin: "50% 50%",
      duration: p.dur,
      ease: p.ease,
    });
    gsap.to(rightEyeRef.current, {
      scaleX: eyeR.scaleX,
      scaleY: eyeR.scaleY,
      y: eyeY,
      transformOrigin: "50% 50%",
      duration: p.dur,
      ease: p.ease,
    });
    // Pupils dilate/constrict with mood. Animating the `r` attribute keeps this
    // independent of the iris gaze translate (x/y), so they never fight.
    gsap.to([leftIrisRef.current, rightIrisRef.current], {
      attr: { r: IRIS_BASE_R * p.pupil },
      duration: p.dur,
      ease: p.ease,
    });
    gsap.to(lLeftRef.current, {
      rotation: p.lLeft.rotation,
      y: p.lLeft.y,
      transformOrigin: "50% 0%", // antennae: anchored at the top of the head
      duration: p.dur,
      ease: p.ease,
      delay: 0.04,
    });
    gsap.to(lRightRef.current, {
      rotation: p.lRight.rotation,
      y: p.lRight.y,
      transformOrigin: "50% 0%", // antennae: anchored at the top of the head
      duration: p.dur,
      ease: p.ease,
      delay: 0.04,
    });
    // ia / ai eyebrows
    gsap.to(browLeftRef.current, {
      rotation: p.browLeft.rotation,
      y: p.browLeft.y,
      svgOrigin: "50 50", // pivot at the left eye centre, so rotating swings the brow out/in
      duration: p.dur,
      ease: p.ease,
      delay: 0.06,
    });
    gsap.to(browRightRef.current, {
      rotation: p.browRight.rotation,
      y: p.browRight.y,
      svgOrigin: "270 50", // pivot at the right eye centre
      duration: p.dur,
      ease: p.ease,
      delay: 0.06,
    });

    // Antennae are always a little restless so he never reads as frozen — a
    // gentle slow sway about their pose rotation in calm moods, a faster bigger
    // wave when lively (wiggle > 0, e.g. startled). The base tween above lands
    // them first; this loop then rocks them, out of phase between the two.
    const lively = p.wiggle > 0;
    const sway = lively ? p.wiggle * 1.6 : 2.5;
    loopRef.current.push(
      gsap.to(lLeftRef.current, {
        rotation: p.lLeft.rotation - sway,
        transformOrigin: "50% 0%",
        duration: lively ? 0.2 : 1.3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.12,
      }),
      gsap.to(lRightRef.current, {
        rotation: p.lRight.rotation + sway,
        transformOrigin: "50% 0%",
        duration: lively ? 0.24 : 1.6, // different period → out of phase
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.12,
      }),
    );

    // Chameleon: tween the body color (antennae, mouth, eyebrows all paint with
    // currentColor). Tweening `color` on the face group leaves the eyes — which
    // use explicit fills — fully lit. Follows the mouth's beat.
    gsap.to(faceRef.current, { color: p.body, duration: p.dur, ease: p.ease, delay: 0.08 });

    // Mouth morphs (idle = the Y arms). The descender is thick in "Y mode" and
    // thin elsewhere, and wiggles from the junction like a little tail when lively.
    gsap.to(mouthRef.current, { morphSVG: p.mouth, duration: p.dur, ease: p.ease, delay: 0.08 });
    gsap.to(descenderRef.current, {
      // Y mode: the angled logo tail (down-left). A pose can override the path
      // (`tail`) when its mouth moves the attach point — e.g. the yawn's big "O".
      // Otherwise: a straight-down tail. Same stroke weight as the Y arms (8).
      morphSVG: p.tail ?? (p.showY ? "M160,85 L142,115" : "M160,85 L160,115"),
      duration: p.dur,
      ease: p.ease,
      delay: 0.08,
    });
    if (p.wiggle > 0) {
      gsap.set(descenderRef.current, { rotation: -9, svgOrigin: "160 85" });
      loopRef.current.push(
        gsap.to(descenderRef.current, {
          rotation: 9,
          duration: 0.22,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          svgOrigin: "160 85",
        }),
      );
    } else {
      gsap.to(descenderRef.current, {
        rotation: 0,
        svgOrigin: "160 85",
        duration: p.dur,
        ease: p.ease,
      });
    }

    // Face bob loop for lively moods.
    if (p.bob > 0) {
      loopRef.current.push(
        gsap.to(faceRef.current, {
          y: -p.bob,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );
    } else {
      gsap.to(faceRef.current, { y: 0, duration: TWEEN, ease: EASE });
    }

    // Face wiggle loop — a giggle shimmy.
    if (p.wiggle > 0) {
      gsap.set(faceRef.current, { rotation: -p.wiggle, transformOrigin: "50% 60%" });
      loopRef.current.push(
        gsap.to(faceRef.current, {
          rotation: p.wiggle,
          duration: 0.16,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );
    } else {
      gsap.to(faceRef.current, { rotation: 0, duration: TWEEN, ease: EASE });
    }
  }, [effective]);

  // Blink: collapse the dedicated blink group (independent of the pose scale).
  useEffect(() => {
    gsap.to(leftBlinkRef.current, {
      scaleY: leftBlinking ? 0.06 : 1,
      transformOrigin: "50% 50%",
      duration: 0.09,
      ease: "power1.inOut",
    });
  }, [leftBlinking]);
  useEffect(() => {
    gsap.to(rightBlinkRef.current, {
      scaleY: rightBlinking ? 0.06 : 1,
      transformOrigin: "50% 50%",
      duration: 0.09,
      ease: "power1.inOut",
    });
  }, [rightBlinking]);

  // Pinprick pupils: fade the tiny lit dots in when his eyes shut (asleep), so
  // there's always a spark in the dark; hidden when awake (the real irises show).
  useEffect(() => {
    gsap.to([leftDotRef.current, rightDotRef.current], {
      opacity: eyesShut ? 1 : 0,
      duration: eyesShut ? 0.6 : 0.2,
      ease: "power2.out",
    });
  }, [eyesShut]);

  // Gaze: where the irises point, spring-damped via quickTo. Priority:
  //   1. a deliberate `gaze` (e.g. eyes down at the input while you type),
  //   2. the cursor while it's moving,
  //   3. his own curious look-around when he's awake and the cursor's gone still.
  // Rebuilt when the gaze source changes. (Plain effect — like the pose/blink
  // effects above — so cleanup runs predictably between renders.)
  const forcedX = gaze ? clamp(gaze.x, -1, 1) : null;
  const forcedY = gaze ? clamp(gaze.y, -1, 1) : null;
  useEffect(() => {
    const opts = { duration: 0.5, ease: "power3" };
    const qxL = gsap.quickTo(leftIrisRef.current, "x", opts);
    const qyL = gsap.quickTo(leftIrisRef.current, "y", opts);
    const qxR = gsap.quickTo(rightIrisRef.current, "x", opts);
    const qyR = gsap.quickTo(rightIrisRef.current, "y", opts);
    const look = (gx: number, gy: number): void => {
      qxL(gx);
      qyL(gy);
      qxR(gx);
      qyR(gy);
    };

    // Head-tilt lives on its own layer (tiltRef) so it composes with the pose. He
    // leans toward whatever he's deliberately watching — the caret while you type,
    // the cursor while he tracks it — and levels off when nothing's moving.
    gsap.set(tiltRef.current, { svgOrigin: "160 50" });
    const tiltTo = gsap.quickTo(tiltRef.current, "rotation", { duration: 0.4, ease: "power3" });
    // The whole glyph drifts a touch toward what he watches (its own translate
    // layer, so no transform-origin tangle with the tilt/sway).
    const leanXTo = gsap.quickTo(leanRef.current, "x", { duration: 0.5, ease: "power3" });
    const leanYTo = gsap.quickTo(leanRef.current, "y", { duration: 0.5, ease: "power3" });
    const lean = (nx: number, ny: number): void => {
      leanXTo(nx * LEAN_MAX);
      leanYTo(ny * LEAN_MAX);
    };

    // 1. Deliberate gaze (typing): lock eyes + head toward it, ignore the rest.
    // (Tilt sign is negated so he leans INTO what he's watching, not away.)
    if (forcedX !== null && forcedY !== null) {
      look(forcedX * GAZE_MAX, forcedY * GAZE_MAX);
      tiltTo(-forcedX * TILT_MAX);
      lean(forcedX, forcedY);
      return;
    }
    tiltTo(0); // level + centred until the cursor takes over
    lean(0, 0);

    // 2. Cursor-follow.
    let lastMove = 0; // when the cursor last drove the gaze; wander waits for a lull
    let raf = 0;
    const onMove = (e: PointerEvent): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = svgRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const len = Math.hypot(dx, dy) || 1;
        look(
          clamp((dx / len) * GAZE_MAX, -GAZE_MAX, GAZE_MAX),
          clamp((dy / len) * GAZE_MAX, -GAZE_MAX, GAZE_MAX),
        );
        // turn his head to watch the cursor (its horizontal direction; negated so
        // he leans into it) and drift a touch toward it; mark that he's watching
        // so the idle sway holds.
        tiltTo(-clamp(dx / len, -1, 1) * TILT_MAX);
        lean(clamp(dx / len, -1, 1), clamp(dy / len, -1, 1));
        lastMove = Date.now();
        watchingRef.current = lastMove;
      });
    };
    const onLeave = (): void => look(0, 0);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseleave", onLeave);

    // 3. Restless eyes: when the cursor's still, his irises drift on their own so
    // he never stares blankly — a wide, curious look-around while idle, smaller
    // glances while he's in a mood. Skips its turn whenever the cursor's moving.
    let wander: ReturnType<typeof setTimeout> | undefined;
    const scheduleWander = (): void => {
      wander = setTimeout(
        () => {
          if (Date.now() - lastMove > WANDER_AFTER_MS) {
            tiltTo(0); // cursor's gone still — level his head; idle sway takes over
            lean(0, 0); // …and drift back to centre
            if (Math.random() < (curious ? 0.25 : 0.35)) {
              look(0, 0);
            } else {
              const angle = Math.random() * Math.PI * 2;
              const reach = curious ? 0.45 + Math.random() * 0.45 : 0.12 + Math.random() * 0.2;
              const radius = GAZE_MAX * reach;
              look(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
          }
          scheduleWander();
        },
        WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS),
      );
    };
    scheduleWander();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (wander) clearTimeout(wander);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [forcedX, forcedY, curious]);

  // Idle fidget: while he sits idle (awake + unoccupied) keep him subtly alive —
  // a small random head sway + breath (on idleRef) and a little brow drift around
  // their idle pose — so he never freezes into a static logo. (Antennae get their
  // own always-on sway in the pose effect.) Stops the moment he has a mood to
  // play (the pose then resets the brows).
  useEffect(() => {
    if (!curious) return;
    const base = POSES.idle;
    const rnd = (m: number): number => (Math.random() * 2 - 1) * m;
    // Breathing (zoom) is its OWN slow, continuous loop — much less frequent than
    // the head sway, so he swells and shrinks gently rather than constantly. Its
    // `scale` never conflicts with the sway's `rotation` on the same element.
    const breath = gsap.to(idleRef.current, {
      scale: 1.035,
      svgOrigin: "160 50",
      duration: 2.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fidget = (): void => {
      // Quick, varied, near-continuous — live people are never quite still. Each
      // move is ~0.5–0.9s and the next starts before this one settles, so he's
      // always drifting toward a fresh target rather than posing and pausing.
      const dur = 0.5 + Math.random() * 0.4;
      // While he's actively watching the cursor his head is purposefully aimed
      // (tiltRef), so hold the random sway at 0 — only the breath keeps going.
      const watching = Date.now() - watchingRef.current < WANDER_AFTER_MS;
      gsap.to(idleRef.current, {
        rotation: watching ? 0 : rnd(3.5), // small head sway (paused while watching)
        svgOrigin: "160 50",
        duration: dur,
        ease: "sine.inOut",
        overwrite: "auto",
      });
      gsap.to(browLeftRef.current, {
        rotation: base.browLeft.rotation + rnd(3),
        y: base.browLeft.y + rnd(2),
        svgOrigin: "50 50",
        duration: dur,
        ease: "sine.inOut",
        overwrite: "auto",
      });
      gsap.to(browRightRef.current, {
        rotation: base.browRight.rotation + rnd(3),
        y: base.browRight.y + rnd(2),
        svgOrigin: "270 50",
        duration: dur,
        ease: "sine.inOut",
        overwrite: "auto",
      });
      timer = setTimeout(fidget, dur * 1000 * 0.85 + Math.random() * 150);
    };
    fidget();
    return () => {
      if (timer) clearTimeout(timer);
      breath.kill();
      // settle the fidget layer back to neutral; the pose resets the brows.
      gsap.to(idleRef.current, {
        rotation: 0,
        scale: 1,
        svgOrigin: "160 50",
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    };
  }, [curious]);

  // Speech: pop the utterance above the head, then let it drift off at a random
  // angle (biased upward) while fading — like a thought floating away.
  useEffect(() => {
    const el = speechRef.current;
    if (!speech || !el) return;
    gsap.killTweensOf(el);
    // Random drift vector: angle within ±55° of straight up, ~40–90px of travel.
    const angle = (-90 + (Math.random() * 110 - 55)) * (Math.PI / 180);
    const dist = 40 + Math.random() * 50;
    const driftX = Math.cos(angle) * dist;
    const driftY = Math.sin(angle) * dist;
    const spin = Math.random() * 24 - 12; // gentle tumble, ±12°
    gsap.set(el, { x: 0, y: 0, rotation: 0 });
    const tl = gsap.timeline();
    tl.fromTo(
      el,
      { opacity: 0, scale: 0.7, y: 6, transformOrigin: "50% 100%" },
      { opacity: 0.7, scale: 1, y: -4, duration: 0.22, ease: "back.out(2)" },
    ).to(el, {
      x: driftX,
      y: -4 + driftY,
      rotation: spin,
      opacity: 0,
      scale: 0.95,
      duration: 1.3,
      delay: 0.5,
      ease: "power1.in",
    });
    return () => {
      tl.kill();
    };
  }, [speech?.id]);

  return (
    <svg
      ref={svgRef}
      viewBox="-15 -72 350 195"
      aria-label="ia.olylo.ai"
      className="block h-auto w-full"
      onClick={poke}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        // Don't clip the glyph to the viewBox: the emotional `scale`/`rotation`
        // (and the silly spin) push his extremities past the box, and the
        // default SVG overflow:hidden would shear them off. Layout box is
        // unchanged, so the chat's anchor to his frame is undisturbed.
        overflow: "visible",
      }}
    >
      {/* arcs the eyebrows ride on (peak up, centred over each eye) */}
      {/* NOTE: a phosphor glow filter once lived here but was imperceptible over
          the matrix-rain background, so it was removed. Revisit later — see
          docs/olylo-backlog.md ("phosphor glow"). */}
      <defs>
        <path id="browArcLeft" d="M23,14 A45,45 0 0 1 50,5" />
        <path id="browArcRight" d="M270,5 A45,45 0 0 1 297,14" />
        {/* Per-component phosphor glow: blur each shape's ALPHA and flood it green
            so every part (eyes, l's, mouth, brows) casts its own shaped halo —
            not one blob behind him. Driven by alpha, not the fill, so it never
            fades with his mood: when he camouflages himself (asleep, near-black)
            the glow still marks where he is. */}
        <filter
          id="olyloGlow"
          x="-90%"
          y="-90%"
          width="280%"
          height="280%"
          colorInterpolationFilters="sRGB"
        >
          {/* ONE big, dim, very diffuse aura far behind him — no tight glow that
              would fuzz his crisp lines. The graphic paints sharp on top. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="24" result="wide" />
          <feFlood floodColor={GREEN} floodOpacity={0.3} result="col" />
          <feComposite in="col" in2="wide" operator="in" result="halo" />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* full-bleed hit area so a click anywhere on him giggles (svg `auto` only
          hits painted pixels; his centre is transparent). `all` ignores fill. */}
      <rect
        x={-15}
        y={-72}
        width={350}
        height={195}
        fill="transparent"
        style={{ pointerEvents: "all" }}
      />

      {/* speech */}
      {speech && (
        <text
          ref={speechRef}
          x={160}
          y={-46}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight={400}
          fontSize={26}
          fill={GREEN}
          style={{ opacity: 0 }}
        >
          {speech.text}
        </text>
      )}

      <g ref={idleRef}>
       <g ref={tiltRef}>
        <g ref={leanRef}>
      <g ref={bodyRef}>
        <g ref={faceRef} filter="url(#olyloGlow)" style={{ color: GREEN }}>
          {/* ia / ai eyebrows — drawn as flat vector glyphs above each eye */}
          {/* eyebrows: the literal ia / ai with a single curved stroke trailing
              toward the centre — ia⌒ on the left, ⌒ai on the right */}
          {/* Everything that paints with `currentColor` (eyebrows, l antennae,
              mouth, descender, and the eye RINGS below) recolors together via the
              per-pose `body` tween. Only the pupils (iris) keep an explicit fixed
              fill, so they stay lit at every mood. */}
          <g ref={browLeftRef} opacity={0.8}>
            <path d="M50,5 A45,45 0 0 1 77,14" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
            <text fontFamily="monospace" fontWeight={700} fontSize={19} fill="currentColor" textAnchor="middle">
              <textPath href="#browArcLeft" startOffset="50%">ia</textPath>
            </text>
          </g>
          <g ref={browRightRef} opacity={0.8}>
            <path d="M243,14 A45,45 0 0 1 270,5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" />
            <text fontFamily="monospace" fontWeight={700} fontSize={19} fill="currentColor" textAnchor="middle">
              <textPath href="#browArcRight" startOffset="50%">ai</textPath>
            </text>
          </g>

          {/* left o (eye) — the RING recolors with mood (currentColor); the black
              middle and the iris/pupil stay fixed, so the pupil color never changes. */}
          <g ref={leftEyeRef}>
            <g ref={leftBlinkRef}>
              <circle cx={50} cy={50} r={35} fill="currentColor" />
              <circle cx={50} cy={50} r={27} fill="#000" />
              <circle ref={leftIrisRef} cx={50} cy={50} r={IRIS_BASE_R} fill={IRIS} />
            </g>
          </g>

          {/* l */}
          <rect ref={lLeftRef} x={102.5} y={-20} width={5} height={105} fill="currentColor" />

          {/* mouth — morphing; idle = the Y arms */}
          <path
            ref={mouthRef}
            d="M130,40 L160,85 L190,40"
            stroke="currentColor"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
          />

          {/* y descender — always present; thick in Y mode, thin (a little tail) otherwise */}
          <path
            ref={descenderRef}
            d="M160,85 L142,115"
            stroke="currentColor"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
          />

          {/* l */}
          <rect ref={lRightRef} x={212.5} y={-20} width={5} height={105} fill="currentColor" />

          {/* right o (eye) — ring recolors with mood; black middle + iris stay fixed. */}
          <g ref={rightEyeRef}>
            <g ref={rightBlinkRef}>
              <circle cx={270} cy={50} r={35} fill="currentColor" />
              <circle cx={270} cy={50} r={27} fill="#000" />
              <circle ref={rightIrisRef} cx={270} cy={50} r={IRIS_BASE_R} fill={IRIS} />
            </g>
          </g>

          {/* tiny pinprick pupils — OUTSIDE the eye-scale groups so the closing
              eyelid never squishes them. Faded in only when his eyes shut
              (asleep), so there's always a spark of him in the dark. */}
          <circle ref={leftDotRef} cx={50} cy={50} r={2.4} fill={IRIS} opacity={0} />
          <circle ref={rightDotRef} cx={270} cy={50} r={2.4} fill={IRIS} opacity={0} />
        </g>
      </g>
        </g>
       </g>
      </g>
    </svg>
  );
}
