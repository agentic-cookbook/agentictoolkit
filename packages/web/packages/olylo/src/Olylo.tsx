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
const IRIS = "#aaffaa";
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
  const yGroupRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const speechRef = useRef<SVGTextElement>(null);
  const loopRef = useRef<gsap.core.Tween[]>([]);

  const ladder = useIdleLadder(expression != null);

  // Click-to-giggle: a transient reaction that briefly outranks everything.
  const [reaction, setReaction] = useState<OlyloExpression | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const giggle = (): void => {
    setReaction("laughing");
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), 1400);
  };
  useEffect(() => {
    return () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
  }, []);

  // Arbitration: a click giggle wins, then a deliberate expression, then the ladder.
  const effective: OlyloExpression =
    reaction ??
    expression ??
    (ladder === "asleep" ? "asleep" : ladder === "bored" ? "bored" : "idle");

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

    gsap.to([leftEyeRef.current, rightEyeRef.current], {
      scaleX: p.eye.scaleX,
      scaleY: p.eye.scaleY,
      transformOrigin: "50% 50%",
      duration: TWEEN,
      ease: EASE,
    });
    gsap.to(lLeftRef.current, {
      rotation: p.lLeft.rotation,
      y: p.lLeft.y,
      transformOrigin: "50% 100%",
      duration: TWEEN,
      ease: EASE,
    });
    gsap.to(lRightRef.current, {
      rotation: p.lRight.rotation,
      y: p.lRight.y,
      transformOrigin: "50% 100%",
      duration: TWEEN,
      ease: EASE,
    });
    // ia / ai eyebrows
    gsap.to(browLeftRef.current, {
      rotation: p.browLeft.rotation,
      y: p.browLeft.y,
      transformOrigin: "50% 50%",
      duration: TWEEN,
      ease: EASE,
    });
    gsap.to(browRightRef.current, {
      rotation: p.browRight.rotation,
      y: p.browRight.y,
      transformOrigin: "50% 50%",
      duration: TWEEN,
      ease: EASE,
    });

    // Mouth: crossfade between the literal `y` (idle) and the morphing mouth.
    gsap.to(yGroupRef.current, { autoAlpha: p.showY ? 1 : 0, duration: 0.25 });
    gsap.to(mouthRef.current, { autoAlpha: p.showY ? 0 : 1, duration: 0.25 });
    gsap.to(mouthRef.current, { morphSVG: p.mouth, duration: TWEEN, ease: EASE });

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

  // Speech: pop the utterance above the head, then fade.
  useEffect(() => {
    const el = speechRef.current;
    if (!speech || !el) return;
    gsap.killTweensOf(el);
    const tl = gsap.timeline();
    tl.fromTo(
      el,
      { opacity: 0, scale: 0.7, y: 6, transformOrigin: "50% 100%" },
      { opacity: 0.7, scale: 1, y: -4, duration: 0.22, ease: "back.out(2)" },
    ).to(el, { opacity: 0, duration: 0.4, delay: 1 });
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
      onClick={giggle}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        filter:
          "drop-shadow(0 0 6px var(--green)) drop-shadow(0 0 18px var(--green-soft)) drop-shadow(0 0 36px rgba(0, 255, 65, 0.25))",
      }}
    >
      {/* arcs the eyebrows ride on (peak up, centred over each eye) */}
      <defs>
        <path id="browArcLeft" d="M18,16 Q50,-22 82,16" />
        <path id="browArcRight" d="M238,16 Q270,-22 302,16" />
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

      <g ref={faceRef}>
        {/* ia / ai eyebrows — drawn as flat vector glyphs above each eye */}
        {/* eyebrows: the literal ia / ai with a single curved stroke trailing
            toward the centre — ia⌒ on the left, ⌒ai on the right */}
        <g ref={browLeftRef} opacity={0.8}>
          <path d="M66,2 Q74,6 82,16" fill="none" stroke={GREEN} strokeWidth={3.5} strokeLinecap="round" />
          <text fontFamily="monospace" fontWeight={700} fontSize={19} fill={GREEN} textAnchor="middle">
            <textPath href="#browArcLeft" startOffset="50%">ia</textPath>
          </text>
        </g>
        <g ref={browRightRef} opacity={0.8}>
          <path d="M238,16 Q246,6 254,2" fill="none" stroke={GREEN} strokeWidth={3.5} strokeLinecap="round" />
          <text fontFamily="monospace" fontWeight={700} fontSize={19} fill={GREEN} textAnchor="middle">
            <textPath href="#browArcRight" startOffset="50%">ai</textPath>
          </text>
        </g>

        {/* left o (eye) */}
        <g ref={leftEyeRef}>
          <g ref={leftBlinkRef}>
            <circle cx={50} cy={50} r={35} fill={GREEN} />
            <circle cx={50} cy={50} r={27} fill="#000" />
            <circle ref={leftIrisRef} cx={50} cy={50} r={9} fill={IRIS} />
          </g>
        </g>

        {/* l */}
        <rect ref={lLeftRef} x={102.5} y={-20} width={5} height={105} fill={GREEN} />

        {/* y (resting wordmark) */}
        <g ref={yGroupRef}>
          <line x1={130} y1={40} x2={160} y2={85} stroke={GREEN} strokeWidth={8} />
          <line x1={190} y1={40} x2={140} y2={115} stroke={GREEN} strokeWidth={8} />
        </g>

        {/* mouth (morph target) */}
        <path
          ref={mouthRef}
          d="M134,93 Q160,93 186,93"
          stroke={GREEN}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />

        {/* l */}
        <rect ref={lRightRef} x={212.5} y={-20} width={5} height={105} fill={GREEN} />

        {/* right o (eye) */}
        <g ref={rightEyeRef}>
          <g ref={rightBlinkRef}>
            <circle cx={270} cy={50} r={35} fill={GREEN} />
            <circle cx={270} cy={50} r={27} fill="#000" />
            <circle ref={rightIrisRef} cx={270} cy={50} r={9} fill={IRIS} />
          </g>
        </g>
      </g>
    </svg>
  );
}
