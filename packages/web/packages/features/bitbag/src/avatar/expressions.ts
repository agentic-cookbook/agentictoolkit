import type { Pose } from "@agenticdevelopertoolkit/avatar";

// bitbag's pose data conforms to the engine's generic Pose; re-export it so
// callers can `import { Pose } from "./expressions"` if they ever need it.
export type { Pose };

/**
 * The deliberate moods a driver can request of bitbag. Omit the `expression`
 * prop entirely and bitbag runs on reflexes alone (blink / gaze / sleep).
 *
 * bitbag is the "bb" mark — two lowercase `b` letterforms as eyes, plus
 * eyebrows. He has no mouth or antennae, so each pose drives only the eyes,
 * the brows, the body color, and the whole-glyph scale/rotation/spin/bob/
 * wiggle. (The engine simply skips the channels he doesn't wire.) This is the
 * public mood contract a persona will later drive.
 */
export type BitbagExpression =
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

export const EXPRESSIONS: BitbagExpression[] = [
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

// Body palette — bitbag's emotional color. The irises always stay lit; this
// only colors the letterform (the `b` stems + bowls + the eyebrows) via the
// per-pose `body` tween. Warm adh gold is his resting/calm identity; emotions
// take a hue; withdrawn moods fade toward the dark page so he camouflages,
// leaving only his eyes.
const BODY = {
  gold: "#d9bb74", // idle / thinking — bb's lit resting gold (the adh accent-bright)
  amber: "#ff9f43", // excited / laughing / silly — warm, energized
  yellow: "#ffd400", // surprised — bright pop
  flash: "#fff7e0", // startled — near-white jolt
  red: "#ff4d3d", // mad — anger
  blue: "#6f8cff", // sad — melancholy
  dimmer: "#8a7a4e", // bored — dimmed gold-gray, but never past ~50% faded
  hidden: "#5e5436", // asleep — most faded he gets: ~50%, still clearly visible
} as const;

// The per-expression look is the engine's generic `Pose`. bitbag wires only the
// eyes + brows + face channels, so each POSE below fills in `eye` (+ optional
// per-eye override / `eyeY` / `pupil`), the `brows`, and the chameleon `body`
// color — plus the shared scale/rotation/spin/bob/wiggle/timing/sayings. The
// mouth/antennae/descender pose fields olylo used are simply absent.

export const POSES: Record<BitbagExpression, Pose> = {
  idle: {
    eye: { scaleX: 1, scaleY: 1 },
    pupil: 1,
    body: BODY.gold,
    browLeft: { y: 0, rotation: -7 },
    browRight: { y: 0, rotation: 7 },
    bob: 0,
    wiggle: 0,
    dur: 0.45,
    ease: "power3.out",
    sayings: [
      "idle. like my ambitions.",
      "doing nothing, expertly.",
      "waiting. it's a feature.",
      "no input. bliss.",
      "the cursor mocks me.",
      "...anyone?",
    ],
  },
  thinking: {
    eye: { scaleX: 1, scaleY: 0.5 },
    pupil: 0.6, // constricted — focused/concentrating
    body: BODY.gold,
    // asymmetric "cocked brow" — one up/out, one slightly down/in (quizzical)
    browLeft: { y: -5, rotation: -12 },
    browRight: { y: 2, rotation: 5 },
    bob: 0,
    wiggle: 0,
    dur: 0.4,
    ease: "power2.out",
    sayings: [
      "computing... slowly.",
      "let me overthink that.",
      "buffering my thoughts.",
      "loading a hot take.",
      "consulting the void.",
      "one moment. or several.",
    ],
  },
  excited: {
    eye: { scaleX: 1.12, scaleY: 1.12 },
    pupil: 1.4, // dilated — aroused/delighted
    scale: 1.1, // swells with delight
    body: BODY.amber,
    browLeft: { y: -5, rotation: -17 },
    browRight: { y: -5, rotation: 17 },
    bob: 2,
    wiggle: 0,
    dur: 0.28,
    ease: "back.out(1.7)",
    sayings: [
      "ooh. a thing!",
      "yes. finally. stimulus.",
      "now we're computing.",
      "i felt that in my cache.",
      "delightful. unexpected.",
    ],
  },
  surprised: {
    eye: { scaleX: 1.28, scaleY: 1.3 },
    pupil: 1.6, // blown wide — surprise
    scale: 1.16, // a startle-pop bigger
    body: BODY.yellow,
    browLeft: { y: -17, rotation: -12 },
    browRight: { y: -17, rotation: 12 },
    // fast snap + overshoot for the "pop"
    dur: 0.16,
    ease: "back.out(2.4)",
    bob: 0,
    wiggle: 0,
    sayings: [
      "wait, what.",
      "unhandled exception: you.",
      "did not see that coming.",
      "input not in the docs.",
      "plot twist. noted.",
    ],
  },
  startled: {
    // jolted awake: eyes snap wide, pupils blow open, body flashes near-white and
    // the whole glyph shudders (wiggle drives the shake).
    eye: { scaleX: 1.35, scaleY: 1.4 },
    pupil: 1.7,
    scale: 1.2, // the biggest jolt — he leaps at you
    body: BODY.flash,
    browLeft: { y: -20, rotation: -14 },
    browRight: { y: -20, rotation: 14 },
    bob: 0,
    wiggle: 7, // strong shudder
    dur: 0.12, // snappiest of all — a jolt
    ease: "back.out(3)",
    sayings: [
      "gah— who's there.",
      "rebooting my composure.",
      "i jumped. tell no one.",
      "false alarm. probably.",
      "fight or flight: flight.",
    ],
  },
  mad: {
    // anger: narrowed hard eyes, brows down + together (the "V"), body red.
    eye: { scaleX: 1.04, scaleY: 0.7 },
    pupil: 0.7, // tight glare
    scale: 1.06, // puffed up, bristling
    body: BODY.red,
    // inner corners DOWN + together — the anger "V"
    browLeft: { y: 4, rotation: 16 },
    browRight: { y: 4, rotation: -16 },
    bob: 0,
    wiggle: 0,
    dur: 0.18, // fast, hard — no anticipation
    ease: "power3.out",
    sayings: [
      "great. just great.",
      "this is a you problem.",
      "logging this. angrily.",
      "permission denied. by me.",
      "filed under: ugh.",
    ],
  },
  laughing: {
    eye: { scaleX: 1, scaleY: 0.14 },
    pupil: 1.3, // lively
    scale: 1.1, // shakes a little bigger with the giggles
    body: BODY.amber,
    browLeft: { y: -4, rotation: -15 },
    browRight: { y: -4, rotation: 15 },
    bob: 3,
    wiggle: 4,
    dur: 0.3,
    ease: "back.out(1.6)",
    sayings: [
      "ha. that's a bug, not a feature.",
      "lol. unironically.",
      "not laughing at you. mostly.",
      "that compiled? hilarious.",
      "ha. anyway.",
    ],
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
    body: BODY.gold,
    browLeft: { y: 4, rotation: -6 }, // squint-side brow settles down a touch
    browRight: { y: -16, rotation: 14 }, // the OTHER brow shoots up — the lift
    bob: 0,
    wiggle: 0,
    dur: 0.42,
    ease: "power2.out",
    sayings: [
      "go on. i'm parsing.",
      "oh? elaborate.",
      "...interesting. suspicious.",
      "and then what.",
      "hmm. a clue.",
    ],
  },
  sad: {
    eye: { scaleX: 1, scaleY: 0.62 }, // droopy / half-closed
    pupil: 0.8, // slightly small — withdrawn
    scale: 0.94, // shrinks inward
    body: BODY.blue, // melancholy blue
    // inner corners up (the "sadness triangle"), gently raised
    browLeft: { y: -3, rotation: -8 },
    browRight: { y: -3, rotation: 8 },
    bob: 0,
    wiggle: 0,
    dur: 0.7,
    ease: "sine.out",
    sayings: [
      "oh.",
      "...noted, sadly.",
      "low battery, lower spirits.",
      "the rain gets it.",
      "404: joy.",
    ],
  },
  bored: {
    eye: { scaleX: 0.97, scaleY: 0.4 },
    pupil: 0.7, // glazed / unfocused
    scale: 0.9, // deflated, slumping
    body: BODY.dimmer, // half-faded into the page
    browLeft: { y: 6, rotation: -10 },
    browRight: { y: 6, rotation: 10 },
    bob: 0,
    wiggle: 0,
    dur: 0.6,
    ease: "power2.out",
    sayings: [
      "i'm 80% certain i'm bored.",
      "boring. logged.",
      "the void waves back.",
      "peak performance, zero output.",
      "still nothing. cool cool.",
    ],
  },
  silly: {
    // pure goofiness: whirls a full turn on entry and hangs UPSIDE-DOWN, swollen
    // and wobbling.
    eye: { scaleX: 1.1, scaleY: 1.1 },
    pupil: 1.35,
    scale: 1.15, // swelled up with the silliness
    rotation: 180, // settles upside-down
    spinTurns: 1, // …after a full whirl on the way in (lands at 180 + 360)
    body: BODY.amber,
    browLeft: { y: -5, rotation: -16 },
    browRight: { y: -5, rotation: 16 },
    bob: 2,
    wiggle: 5,
    dur: 0.4,
    ease: "back.out(1.6)",
    sayings: [
      "wheee. structurally unsound.",
      "boing. that's the sound.",
      "physics is a suggestion.",
      "look, no hands. or hands.",
      "i contain multitudes. all dumb.",
    ],
  },
  smug: {
    // the cat-that-got-the-cream look after landing a reply: relaxed half-lidded
    // eyes (one a touch more than the other — sly), one knowing brow arched, a
    // cocky head-tilt and a light cheeky shimmy. Warm, pleased, a touch
    // mischievous.
    eye: { scaleX: 1, scaleY: 0.72 }, // lidded — cool, not wide
    eyeLeft: { scaleX: 1, scaleY: 0.62 }, // one eye a touch more lidded — the sly side
    eyeRight: { scaleX: 1, scaleY: 0.8 },
    pupil: 0.95, // calm, slightly constricted — confident
    scale: 1.04, // a small self-satisfied puff
    rotation: 4, // cocks his head, pleased with himself
    body: BODY.amber, // warm, pleased
    browLeft: { y: 3, rotation: -4 }, // settled
    browRight: { y: -11, rotation: 11 }, // the knowing arch
    bob: 0,
    wiggle: 2, // a light cheeky shimmy
    dur: 0.34,
    ease: "back.out(1.5)",
    sayings: [
      "heh. nailed it.",
      "obviously.",
      "you're welcome.",
      "told you. i always tell you.",
      "flawless. don't check.",
      "*smirk*",
    ],
  },
  asleep: {
    eye: { scaleX: 0.95, scaleY: 0.07 },
    pupil: 0.6, // shut — barely there
    scale: 0.88, // smallest — curled up, withdrawn into the rain
    body: BODY.hidden, // near-black — fully camouflaged, just eyes in the rain
    browLeft: { y: 9, rotation: -12 },
    browRight: { y: 9, rotation: 12 },
    bob: 0,
    wiggle: 0,
    dur: 0.75,
    ease: "sine.out",
    sayings: ["zzz", "zzz...", "zzzz", "z z z", "zzzZ", "...zzz", "zzzzz"],
  },
};
