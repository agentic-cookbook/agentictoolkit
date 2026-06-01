"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { useGSAP } from "@gsap/react";
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

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export interface OlyloProps {
  /** Deliberate mood from a driver (chat today, persona later). */
  expression?: OlyloExpression;
}

export function Olylo({ expression }: OlyloProps): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftBlinkRef = useRef<SVGGElement>(null);
  const rightBlinkRef = useRef<SVGGElement>(null);
  const leftIrisRef = useRef<SVGCircleElement>(null);
  const rightIrisRef = useRef<SVGCircleElement>(null);
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

  // Arbitration: a click reaction wins, then the resting mood.
  const effective: OlyloExpression = reaction ?? resting;

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

    // Eyes lead (no delay); brows, antennae and mouth follow a beat later.
    gsap.to([leftEyeRef.current, rightEyeRef.current], {
      scaleX: p.eye.scaleX,
      scaleY: p.eye.scaleY,
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

    // Antennae wave — when lively (wiggle > 0), the l's oscillate about their
    // pose rotation, out of phase, like waving feelers (e.g. startled). The base
    // tween above lands them first; this loop then rocks them.
    if (p.wiggle > 0) {
      const sway = p.wiggle * 1.6;
      loopRef.current.push(
        gsap.to(lLeftRef.current, {
          rotation: p.lLeft.rotation - sway,
          transformOrigin: "50% 0%",
          duration: 0.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.12,
        }),
        gsap.to(lRightRef.current, {
          rotation: p.lRight.rotation + sway,
          transformOrigin: "50% 0%",
          duration: 0.24, // slightly different period → out of phase
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.12,
        }),
      );
    }

    // Chameleon: tween the body color (antennae, mouth, eyebrows all paint with
    // currentColor). Tweening `color` on the face group leaves the eyes — which
    // use explicit fills — fully lit. Follows the mouth's beat.
    gsap.to(faceRef.current, { color: p.body, duration: p.dur, ease: p.ease, delay: 0.08 });

    // Mouth morphs (idle = the Y arms). The descender is thick in "Y mode" and
    // thin elsewhere, and wiggles from the junction like a little tail when lively.
    gsap.to(mouthRef.current, { morphSVG: p.mouth, duration: p.dur, ease: p.ease, delay: 0.08 });
    gsap.to(descenderRef.current, {
      // Y mode: the angled logo tail (down-left). Otherwise: a straight-down tail.
      // Same stroke weight as the Y arms (8) in every mode.
      morphSVG: p.showY ? "M160,85 L142,115" : "M160,85 L160,115",
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

  // Gaze: irises follow the cursor (spring-damped via quickTo). Set up once.
  useGSAP(
    () => {
      const opts = { duration: 0.5, ease: "power3" };
      const qxL = gsap.quickTo(leftIrisRef.current, "x", opts);
      const qyL = gsap.quickTo(leftIrisRef.current, "y", opts);
      const qxR = gsap.quickTo(rightIrisRef.current, "x", opts);
      const qyR = gsap.quickTo(rightIrisRef.current, "y", opts);
      let raf = 0;
      const onMove = (e: PointerEvent) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const el = svgRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const len = Math.hypot(dx, dy) || 1;
          const gx = clamp((dx / len) * GAZE_MAX, -GAZE_MAX, GAZE_MAX);
          const gy = clamp((dy / len) * GAZE_MAX, -GAZE_MAX, GAZE_MAX);
          qxL(gx);
          qyL(gy);
          qxR(gx);
          qyR(gy);
        });
      };
      const onLeave = () => {
        qxL(0);
        qyL(0);
        qxR(0);
        qyR(0);
      };
      window.addEventListener("pointermove", onMove);
      document.addEventListener("mouseleave", onLeave);
      return () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("mouseleave", onLeave);
      };
    },
    { scope: svgRef },
  );

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
      }}
    >
      {/* arcs the eyebrows ride on (peak up, centred over each eye) */}
      {/* NOTE: a phosphor glow filter once lived here but was imperceptible over
          the matrix-rain background, so it was removed. Revisit later — see
          docs/olylo-backlog.md ("phosphor glow"). */}
      <defs>
        <path id="browArcLeft" d="M23,14 A45,45 0 0 1 50,5" />
        <path id="browArcRight" d="M270,5 A45,45 0 0 1 297,14" />
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

      <g ref={faceRef} style={{ color: GREEN }}>
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
      </g>
    </svg>
  );
}
