/**
 * The deliberate moods a driver can request of olylo. Omit the `expression`
 * prop entirely and olylo runs on reflexes alone (blink / gaze / sleep).
 *
 * This is the public contract a persona will later drive.
 */
export type OlyloExpression =
  | "idle"
  | "thinking"
  | "excited"
  | "surprised"
  | "laughing"
  | "sad"
  | "bored"
  | "asleep";

export const EXPRESSIONS: OlyloExpression[] = [
  "idle",
  "thinking",
  "excited",
  "surprised",
  "laughing",
  "sad",
  "bored",
  "asleep",
];

/** A full pose for one expression. Tweened to with GSAP; the mouth is morphed. */
export interface Pose {
  /** Eye (the `o`s) scale about their own centre — openness + size. */
  eye: { scaleX: number; scaleY: number };
  /** Pupil (iris) dilation — multiplier on the base iris radius. <1 constricts
   * (focused/sleepy), >1 dilates (aroused/excited). 1 = neutral. */
  pupil: number;
  /** `l` strokes pivot at their base (body language). */
  lLeft: { rotation: number; y: number };
  lRight: { rotation: number; y: number };
  /** `ia` / `ai` eyebrows above each eye: y raises(-)/lowers(+); rotation swings out(-)/in(+). */
  browLeft: { y: number; rotation: number };
  browRight: { y: number; rotation: number };
  /** Mouth path `d` — MorphSVG morphs between these. All 3-point so morphs stay clean. */
  mouth: string;
  /** "Y mode": when true, the mouth is the literal Y arms and the descender is the
   * angled logo tail (so olylo reads as the logo). Otherwise a facial expression. */
  showY: boolean;
  /** Face bob amplitude in viewBox units (0 = still); loops while in this mood. */
  bob: number;
  /** Face wiggle (rotation degrees, 0 = none); loops while in this mood — e.g. giggling. */
  wiggle: number;
  /** Transition duration (s) — fast for surprise/anger, slow for sad/sleepy. */
  dur: number;
  /** Transition ease (gsap string) — e.g. back.out for an overshoot/pop. */
  ease: string;
  /** What olylo blurts when entering this mood (one picked at random). */
  sayings: string[];
}

// Mouth shapes — all 3-point polylines (M + L + L) so point counts match and
// MorphSVG morphs cleanly. `y` is the literal Y arms ("Y mode", idle); the rest
// are facial mouths. The descender tail attaches at the junction (160,85).
const MOUTH = {
  y: "M130,40 L160,85 L190,40",
  flat: "M134,85 L160,85 L186,85",
  pursed: "M144,80 L160,85 L176,80",
  smile: "M132,71 L160,85 L188,71",
  open: "M148,73 L160,85 L172,73",
  bigSmile: "M128,66 L160,85 L192,66",
  frown: "M132,99 L160,85 L188,99",
} as const;

export const POSES: Record<OlyloExpression, Pose> = {
  idle: {
    eye: { scaleX: 1, scaleY: 1 },
    pupil: 1,
    lLeft: { rotation: 0, y: 0 },
    lRight: { rotation: 0, y: 0 },
    browLeft: { y: 0, rotation: -7 },
    browRight: { y: 0, rotation: 7 },
    mouth: MOUTH.y,
    showY: true,
    bob: 0,
    wiggle: 0,
    dur: 0.45,
    ease: "power3.out",
    sayings: [],
  },
  thinking: {
    eye: { scaleX: 1, scaleY: 0.5 },
    pupil: 0.6, // constricted — focused/concentrating
    lLeft: { rotation: -10, y: -3 },
    lRight: { rotation: 6, y: -1 },
    // asymmetric "cocked brow" — one up/out, one slightly down/in (quizzical)
    browLeft: { y: -5, rotation: -12 },
    browRight: { y: 2, rotation: 5 },
    mouth: MOUTH.pursed,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.4,
    ease: "power2.out",
    sayings: ["hmmm", "hmm...", "let me think"],
  },
  excited: {
    eye: { scaleX: 1.12, scaleY: 1.12 },
    pupil: 1.4, // dilated — aroused/delighted
    lLeft: { rotation: 0, y: -4 },
    lRight: { rotation: 0, y: -4 },
    browLeft: { y: -5, rotation: -17 },
    browRight: { y: -5, rotation: 17 },
    mouth: MOUTH.smile,
    showY: false,
    bob: 2,
    wiggle: 0,
    dur: 0.28,
    ease: "back.out(1.7)",
    sayings: ["ooh!", "yes!", "nice"],
  },
  surprised: {
    eye: { scaleX: 1.28, scaleY: 1.3 },
    pupil: 1.6, // blown wide — surprise
    lLeft: { rotation: -4, y: -7 },
    lRight: { rotation: 4, y: -7 },
    browLeft: { y: -17, rotation: -12 },
    browRight: { y: -17, rotation: 12 },
    mouth: MOUTH.open,
    showY: false,
    bob: 0,
    wiggle: 0,
    // fast snap + overshoot for the "pop"
    dur: 0.16,
    ease: "back.out(2.4)",
    sayings: ["whoa!", "!?", "huh?!"],
  },
  laughing: {
    eye: { scaleX: 1, scaleY: 0.14 },
    pupil: 1.3, // lively
    lLeft: { rotation: -3, y: 0 },
    lRight: { rotation: 3, y: 0 },
    browLeft: { y: -4, rotation: -15 },
    browRight: { y: -4, rotation: 15 },
    mouth: MOUTH.bigSmile,
    showY: false,
    bob: 3,
    wiggle: 4,
    dur: 0.3,
    ease: "back.out(1.6)",
    sayings: ["lol", "haha", "lmao"],
  },
  sad: {
    eye: { scaleX: 1, scaleY: 0.62 }, // droopy / half-closed
    pupil: 0.8, // slightly small — withdrawn
    lLeft: { rotation: 8, y: 3 }, // antennae droop inward
    lRight: { rotation: -8, y: 3 },
    // inner corners up (the "sadness triangle"), gently raised
    browLeft: { y: -3, rotation: -8 },
    browRight: { y: -3, rotation: 8 },
    mouth: MOUTH.frown,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.7,
    ease: "sine.out",
    sayings: ["...", "aw", "oh"],
  },
  bored: {
    eye: { scaleX: 0.97, scaleY: 0.4 },
    pupil: 0.7, // glazed / unfocused
    lLeft: { rotation: 6, y: 2 },
    lRight: { rotation: -6, y: 2 },
    browLeft: { y: 6, rotation: -10 },
    browRight: { y: 6, rotation: 10 },
    mouth: MOUTH.frown,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.6,
    ease: "power2.out",
    sayings: ["boring!", "yawn...", "meh"],
  },
  asleep: {
    eye: { scaleX: 0.95, scaleY: 0.07 },
    pupil: 0.6, // shut — barely there
    lLeft: { rotation: 10, y: 3 },
    lRight: { rotation: -10, y: 3 },
    browLeft: { y: 9, rotation: -12 },
    browRight: { y: 9, rotation: 12 },
    mouth: MOUTH.flat,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.75,
    ease: "sine.out",
    sayings: ["zzzz...", "zzz"],
  },
};
