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
  | "startled"
  | "mad"
  | "laughing"
  | "inquisitive"
  | "sad"
  | "bored"
  | "silly"
  | "smug"
  | "asleep";

export const EXPRESSIONS: OlyloExpression[] = [
  "idle",
  "thinking",
  "excited",
  "surprised",
  "startled",
  "mad",
  "laughing",
  "inquisitive",
  "sad",
  "bored",
  "silly",
  "smug",
  "asleep",
];

/** A full pose for one expression. Tweened to with GSAP; the mouth is morphed. */
export interface Pose {
  /** Eye (the `o`s) scale about their own centre — openness + size. Drives both
   * eyes unless `eyeLeft` / `eyeRight` override one side (asymmetric squints). */
  eye: { scaleX: number; scaleY: number };
  /** Optional per-eye scale overrides for asymmetric looks — e.g. `inquisitive`
   * narrows one eye while the other stays open. Fall back to `eye` when omitted. */
  eyeLeft?: { scaleX: number; scaleY: number };
  eyeRight?: { scaleX: number; scaleY: number };
  /** Pupil (iris) dilation — multiplier on the base iris radius. <1 constricts
   * (focused/sleepy), >1 dilates (aroused/excited). 1 = neutral. */
  pupil: number;
  /** Whole-glyph size multiplier — an extra emotional-amplitude channel layered
   * on top of the consumer's base size. >1 swells (excited/surprised), <1
   * shrinks/withdraws (sad/bored/asleep). Omit for 1 (neutral). */
  scale?: number;
  /** Whole-glyph SETTLED rotation in degrees, held for the duration of the mood.
   * Full range — e.g. 180 hangs olylo upside-down when `silly`. Omit for 0. */
  rotation?: number;
  /** One-shot flourish: extra FULL turns whirled (eased, non-uniform velocity —
   * it accelerates then settles) on ENTERING the mood, landing at `rotation`.
   * Omit for 0 (no spin). Use whole numbers so it lands cleanly. */
  spinTurns?: number;
  /** Body color — the emotional/chameleon channel: antennae, mouth/Y, eyebrows,
   * and the eye RINGS all take it. Moods have a color (mad=red, excited=orange,
   * sad=blue…); withdrawn moods fade toward the page's black so he camouflages.
   * The PUPILS (iris) never use this — they stay a fixed lit blue-green, so even
   * fully camouflaged his pupils float in the dark. */
  body: string;
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

// Body palette — olylo's emotional color (the EYES always stay lit; this only
// colors the antennae, mouth/Y and eyebrows). Bright phosphor green is his
// resting/calm color; emotions take a hue; withdrawn moods fade toward the
// black page so he camouflages, leaving only his eyes.
const BODY = {
  green: "#00ff41", // idle / thinking — calm, blends into the matrix site
  orange: "#ff9500", // excited / laughing — warm, energized
  yellow: "#ffd400", // surprised — bright pop
  flash: "#fffce0", // startled — near-white jolt
  red: "#ff2d2d", // mad — anger
  blue: "#4f7cff", // sad — melancholy
  dimmer: "#2a2a2a", // bored — half-faded into the page
  hidden: "#0d0f0d", // asleep — near-black, just eyes floating in the rain
} as const;

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
  smirk: "M132,86 L160,85 L188,73", // one-sided grin: left flat, right corner pulled up
} as const;

export const POSES: Record<OlyloExpression, Pose> = {
  idle: {
    eye: { scaleX: 1, scaleY: 1 },
    pupil: 1,
    body: BODY.green,
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
    body: BODY.green,
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
    scale: 1.1, // swells with delight
    body: BODY.orange,
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
    scale: 1.16, // a startle-pop bigger
    body: BODY.yellow,
    lLeft: { rotation: -4, y: -7 },
    lRight: { rotation: 4, y: -7 },
    browLeft: { y: -17, rotation: -12 },
    browRight: { y: -17, rotation: 12 },
    mouth: MOUTH.open,
    showY: false,
    // fast snap + overshoot for the "pop"
    dur: 0.16,
    ease: "back.out(2.4)",
    bob: 0,
    wiggle: 0,
    sayings: ["whoa!", "!?", "huh?!"],
  },
  startled: {
    // jolted awake: eyes snap wide, pupils blow open, antennae shoot upright and
    // wave (wiggle drives the oscillation), body flashes near-white.
    eye: { scaleX: 1.35, scaleY: 1.4 },
    pupil: 1.7,
    scale: 1.2, // the biggest jolt — he leaps at you
    body: BODY.flash,
    lLeft: { rotation: -2, y: -16 }, // antennae stand straight up
    lRight: { rotation: 2, y: -16 },
    browLeft: { y: -20, rotation: -14 },
    browRight: { y: -20, rotation: 14 },
    mouth: MOUTH.open,
    showY: false,
    bob: 0,
    wiggle: 7, // strong shimmy — the antennae/tail wave about
    dur: 0.12, // snappiest of all — a jolt
    ease: "back.out(3)",
    sayings: ["gah!", "wha—!", "!!"],
  },
  mad: {
    // anger: narrowed hard eyes, brows down + together (the "V"), antennae
    // bristled forward, body red.
    eye: { scaleX: 1.04, scaleY: 0.7 },
    pupil: 0.7, // tight glare
    scale: 1.06, // puffed up, bristling
    body: BODY.red,
    lLeft: { rotation: 14, y: -2 }, // bristling inward/forward
    lRight: { rotation: -14, y: -2 },
    // inner corners DOWN + together — the anger "V"
    browLeft: { y: 4, rotation: 16 },
    browRight: { y: 4, rotation: -16 },
    mouth: MOUTH.flat,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.18, // fast, hard — no anticipation
    ease: "power3.out",
    sayings: ["grr", "hmph", ">:("],
  },
  laughing: {
    eye: { scaleX: 1, scaleY: 0.14 },
    pupil: 1.3, // lively
    scale: 1.1, // shakes a little bigger with the giggles
    body: BODY.orange,
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
  inquisitive: {
    // the "huh?" look — one eye narrows to a squint while the OTHER brow lifts,
    // with a slight head-tilt. Asymmetry is the whole point, so it overrides one
    // eye via eyeLeft and leaves eyeRight open.
    eye: { scaleX: 1, scaleY: 1 },
    eyeLeft: { scaleX: 1, scaleY: 0.55 }, // left eye narrowed — the squint
    eyeRight: { scaleX: 1.04, scaleY: 1.06 }, // right eye a touch wider — engaged
    pupil: 1.1, // mildly piqued
    scale: 1.02,
    rotation: 6, // cocks his head to one side
    body: BODY.green,
    lLeft: { rotation: -6, y: -2 },
    lRight: { rotation: 10, y: -3 }, // one antenna perks up
    browLeft: { y: 4, rotation: -6 }, // squint-side brow settles down a touch
    browRight: { y: -16, rotation: 14 }, // the OTHER brow shoots up — the lift
    mouth: MOUTH.pursed,
    showY: false,
    bob: 0,
    wiggle: 0,
    dur: 0.42,
    ease: "power2.out",
    sayings: ["hm?", "oh?", "go on...", "...really?"],
  },
  sad: {
    eye: { scaleX: 1, scaleY: 0.62 }, // droopy / half-closed
    pupil: 0.8, // slightly small — withdrawn
    scale: 0.94, // shrinks inward
    body: BODY.blue, // melancholy blue
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
    scale: 0.9, // deflated, slumping
    body: BODY.dimmer, // half-faded into the page
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
  silly: {
    // pure goofiness: whirls a turn-and-a-half on entry and hangs UPSIDE-DOWN,
    // swollen and wobbling, grinning wide.
    eye: { scaleX: 1.1, scaleY: 1.1 },
    pupil: 1.35,
    scale: 1.15, // swelled up with the silliness
    rotation: 180, // settles upside-down
    spinTurns: 1, // …after a 1.5-turn whirl on the way in (lands at 180 + 360)
    body: BODY.orange,
    lLeft: { rotation: -8, y: -3 },
    lRight: { rotation: 8, y: -3 },
    browLeft: { y: -5, rotation: -16 },
    browRight: { y: -5, rotation: 16 },
    mouth: MOUTH.bigSmile,
    showY: false,
    bob: 2,
    wiggle: 5,
    dur: 0.4,
    ease: "back.out(1.6)",
    sayings: ["wheee", "boing", "hehe"],
  },
  smug: {
    // the cat-that-got-the-cream look after landing a reply: relaxed half-lidded
    // eyes (one a touch more than the other — sly), one knowing brow arched, an
    // asymmetric smirk, a cocky head-tilt and a light tail-flick. Warm, pleased,
    // a touch mischievous.
    eye: { scaleX: 1, scaleY: 0.72 }, // lidded — cool, not wide
    eyeLeft: { scaleX: 1, scaleY: 0.62 }, // one eye a touch more lidded — the sly side
    eyeRight: { scaleX: 1, scaleY: 0.8 },
    pupil: 0.95, // calm, slightly constricted — confident
    scale: 1.04, // a small self-satisfied puff
    rotation: 4, // cocks his head, pleased with himself
    body: BODY.orange, // warm, pleased
    lLeft: { rotation: -10, y: -3 }, // one antenna perks up jauntily
    lRight: { rotation: 3, y: 0 },
    browLeft: { y: 3, rotation: -4 }, // settled
    browRight: { y: -11, rotation: 11 }, // the knowing arch
    mouth: MOUTH.smirk,
    showY: false,
    bob: 0,
    wiggle: 2, // a light cheeky shimmy + tail-flick
    dur: 0.34,
    ease: "back.out(1.5)",
    sayings: ["heh", "nailed it", "obviously", "you're welcome", "*smirk*"],
  },
  asleep: {
    eye: { scaleX: 0.95, scaleY: 0.07 },
    pupil: 0.6, // shut — barely there
    scale: 0.88, // smallest — curled up, withdrawn into the rain
    body: BODY.hidden, // near-black — fully camouflaged, just eyes in the rain
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
