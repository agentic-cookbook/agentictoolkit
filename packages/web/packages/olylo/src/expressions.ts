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
  | "bored"
  | "asleep";

export const EXPRESSIONS: OlyloExpression[] = [
  "idle",
  "thinking",
  "excited",
  "surprised",
  "laughing",
  "bored",
  "asleep",
];

/** A full pose for one expression. Tweened to with GSAP; the mouth is morphed. */
export interface Pose {
  /** Eye (the `o`s) scale about their own centre — openness + size. */
  eye: { scaleX: number; scaleY: number };
  /** `l` strokes pivot at their base (body language). */
  lLeft: { rotation: number; y: number };
  lRight: { rotation: number; y: number };
  /** `ia` / `ai` eyebrows above each eye: y raises(-)/lowers(+); rotation furrows/arches. */
  browLeft: { y: number; rotation: number };
  browRight: { y: number; rotation: number };
  /** Mouth path `d` — MorphSVG morphs between these. All single-quadratic so morphs stay clean. */
  mouth: string;
  /** "Y mode": when true, the mouth is the literal Y arms and the descender is thick
   * (so olylo reads as the logo). Otherwise the mouth is a facial expression and the
   * descender thins to a little tail. */
  showY: boolean;
  /** Face bob amplitude in viewBox units (0 = still); loops while in this mood. */
  bob: number;
  /** Face wiggle (rotation degrees, 0 = none); loops while in this mood — e.g. giggling. */
  wiggle: number;
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
    lLeft: { rotation: 0, y: 0 },
    lRight: { rotation: 0, y: 0 },
    browLeft: { y: 0, rotation: 0 },
    browRight: { y: 0, rotation: 0 },
    mouth: MOUTH.y,
    showY: true,
    bob: 0,
    wiggle: 0,
    sayings: [],
  },
  thinking: {
    eye: { scaleX: 1, scaleY: 0.5 },
    lLeft: { rotation: -8, y: -2 },
    lRight: { rotation: 12, y: -4 },
    browLeft: { y: 2, rotation: 9 },
    browRight: { y: 2, rotation: -9 },
    mouth: MOUTH.pursed,
    showY: false,
    bob: 0,
    wiggle: 0,
    sayings: ["hmmm", "hmm...", "let me think"],
  },
  excited: {
    eye: { scaleX: 1.12, scaleY: 1.12 },
    lLeft: { rotation: 0, y: -4 },
    lRight: { rotation: 0, y: -4 },
    browLeft: { y: -3, rotation: -12 },
    browRight: { y: -3, rotation: 12 },
    mouth: MOUTH.smile,
    showY: false,
    bob: 2,
    wiggle: 0,
    sayings: ["ooh!", "yes!", "nice"],
  },
  surprised: {
    eye: { scaleX: 1.28, scaleY: 1.3 },
    lLeft: { rotation: -4, y: -7 },
    lRight: { rotation: 4, y: -7 },
    browLeft: { y: -12, rotation: -8 },
    browRight: { y: -12, rotation: 8 },
    mouth: MOUTH.open,
    showY: false,
    bob: 0,
    wiggle: 0,
    sayings: ["whoa!", "!?", "huh?!"],
  },
  laughing: {
    eye: { scaleX: 1, scaleY: 0.14 },
    lLeft: { rotation: -3, y: 0 },
    lRight: { rotation: 3, y: 0 },
    browLeft: { y: -2, rotation: -10 },
    browRight: { y: -2, rotation: 10 },
    mouth: MOUTH.bigSmile,
    showY: false,
    bob: 3,
    wiggle: 4,
    sayings: ["lol", "haha", "lmao"],
  },
  bored: {
    eye: { scaleX: 0.97, scaleY: 0.4 },
    lLeft: { rotation: 6, y: 2 },
    lRight: { rotation: -6, y: 2 },
    browLeft: { y: 4, rotation: -6 },
    browRight: { y: 4, rotation: 6 },
    mouth: MOUTH.frown,
    showY: false,
    bob: 0,
    wiggle: 0,
    sayings: ["boring!", "yawn...", "meh"],
  },
  asleep: {
    eye: { scaleX: 0.95, scaleY: 0.07 },
    lLeft: { rotation: 10, y: 3 },
    lRight: { rotation: -10, y: 3 },
    browLeft: { y: 6, rotation: -8 },
    browRight: { y: 6, rotation: 8 },
    mouth: MOUTH.flat,
    showY: false,
    bob: 0,
    wiggle: 0,
    sayings: ["zzzz...", "zzz"],
  },
};
