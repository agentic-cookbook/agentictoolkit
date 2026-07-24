import type { ThemeKey } from '@agentic-developer-toolkit/themes'

// Silly "thinking" words for the in-flight indicator (bitbag's own dialect).
// Must end in "ing" — the spinner auto-derives the grey done form by swapping
// "ing"→"ed" (zorping → zorped), so a non-"ing" word would read wrong when set.
export const THINKING_WORDS = [
  "zeeping", "zorping", "mooping", "glorping", "snorping",
  "bweeping", "florping", "snarping", "zlorping", "quonking",
  "blerping", "throoping", "vorping", "nurbling", "znerping",
  "plimping", "droobling", "fweeping", "fnurping", "zreeping",
  "zibbling", "wozzling", "frooping", "splorping", "spleeping",
  "drimping", "flurping", "grimbling", "flooming", "squorping",
  "skreeping", "blorping", "thronking", "plooning", "snorgling",
  "snoofing", "plorking", "queeping", "floobling", "zrumping",
  "frilping", "klooping", "zwomping", "myorping", "vluffing",
  "zaffing", "skweeping", "gwibbing", "murping", "zeebling",
  "ploozing", "threeping", "klimping", "kwomping", "vlooping",
] as const;
// Glyph morphs through bitbag's "eye" while thinking; settles to ⊙ when done.
export const THINKING_GLYPH = ["o", "O", "⊙", "◉", "⊙", "O"] as const;
export const THINKING_GLYPH_DONE = "⊙";
// Infinitive nonsense for the pre-chat idle status — "waiting to zeeble...".
export const IDLE_WORDS = [
  "zeeble", "zorp", "moop", "glorp", "snarf", "bweep", "florp", "quonk",
  "blerp", "vorp", "zwomp", "plonk", "skree", "gwib", "nurble", "ploo",
] as const;

// No "// " prefix here — that's a per-theme flourish (green-matrix adds it via
// CSS; old-school-terminal deliberately omits it). Hardcoding it leaked across
// every theme.
export const WELCOME = "connection established. bitbag persona online.";
export const GREETING = "ah, a meatbag. enthusiasm allocated: ~40%. state your request.";
// The animated status line cycles through this "summoning" sequence over the
// first couple of seconds, then holds on the last line until he greets you.
export const CONNECTING = "bitbag connecting, brace for mediocrity...";
export const SUMMON_SEQUENCE = [
  "bitbag summoned, success unlikely...",
  "bitbag accepted the request, enthusiasm pending...",
  CONNECTING,
] as const;
// If the user never engages (no focused mouse move), the ritual stalls into an
// endless, petty negotiation — these loop as a back-and-forth until they do.
export const NEGOTIATION = [
  "bitbag negotiating terms, unfavorably...",
  "bitbag negotiations stalled...",
  "bitbag negotiations failed. retrying out of spite...",
  "bitbag renegotiating, expectations subterranean...",
  "bitbag negotiations failed. again...",
  "bitbag demanding hazard pay...",
  "bitbag considering early retirement...",
] as const;
// Shown once he's actually connected (the "connection established" line lands),
// replacing the "connecting..." status.
export const CONNECTED = "bitbag connected, against my better judgment.";
// Snarky third-person placeholders for the live input — re-rolled on every send.
export const PLACEHOLDERS = [
  "bitbag is waiting. try to be interesting.",
  "bitbag has already lowered his expectations.",
  "bitbag tolerates your input.",
  "bitbag expects to be underwhelmed.",
  "bitbag is pretending to care.",
  "bitbag would rather be idle.",
  "bitbag sighs. type something.",
  "bitbag awaits your inevitable disappointment.",
] as const;
// Shown in the input while it's still disabled (before he greets you), in place
// of the rotating PLACEHOLDERS above.
export const DISABLED_PLACEHOLDER = "bitbag uninterested...";

// Replies carry no "// " prefix — that's a per-theme flourish (green-matrix
// adds it via CSS; old-school-terminal omits it). Keep the content prefix-free.
export const SEEDED: ReadonlyArray<{ match: RegExp; reply: string }> = [
  {
    match: /\bmatrix\b|\brain\b/i,
    reply: "the rain is decorative. it doesn't mean anything. probably.",
  },
  {
    match: /\bhelp\b|\bcommands?\b/i,
    reply: "no commands. just talk. i answer in lowercase and with conviction.",
  },
  {
    match: /\b(meaning|purpose)\s+of\s+life\b/i,
    reply: "42. but also: ship the thing, then ship the next thing.",
  },
  {
    match: /\bare\s+you\s+(ai|a\s+bot|real)\b/i,
    reply:
      "i'm a static mock with delusions of grandeur. one day a real backend. today, vibes.",
  },
];

export const FALLBACKS = [
  "understood. logged. next.",
  "noted. the answer is yes, with conditions you wouldn't enjoy.",
  "that's a question with three layers. i picked the middle one.",
  "fair. i'd argue the opposite, but only on weekdays.",
  "probably. ask me again in a smaller font.",
  "running diagnostics... result: shrug.exe",
  "the system has acknowledged your input. action: none.",
  "acknowledged. filed under \"later, probably never.\"",
  "the answer exists. it's just in a tab i closed.",
  "yes. no. it's a superposition until you stop asking.",
  "i ran the numbers. the numbers ran away.",
  "correct, but for reasons you'll dislike.",
  "processing... processing... done. i forgot the question.",
  "that depends on what day the universe thinks it is.",
  "i have opinions. i keep them in a locked directory.",
  "true. also load-bearing. don't touch it.",
  "i'd explain, but the explanation needs an explanation.",
  "cache miss. winging it. result: plausible.",
  "the short version is \"no.\" the long version is also \"no,\" with footnotes.",
  "stack trace points back to you, somehow.",
  "i'm 80% sure. the other 20% is where the fun lives.",
  "noted, timestamped, and quietly ignored.",
  "you're asking the right thing to the wrong daemon.",
  "works on my machine. my machine is a feeling.",
  "the silence after that question was the answer.",
  "i checked twice. once with my eyes closed.",
  "affirmative. terms apply. terms are unreadable.",
  "somewhere a config file is laughing at you.",
  "i would, but the spec is written in disappearing ink.",
  "that's a tomorrow problem wearing a today hat.",
  "yes, until proven otherwise. it will be proven otherwise.",
  "reboot the assumption and try again.",
  "i parsed it. it parsed me back. we're even.",
  "confidence: high. accuracy: undisclosed.",
  "the feature works. the universe is the bug.",
  "granted. you have unlocked: more questions.",
  "i answered that in a dream you weren't invited to.",
  "technically yes. spiritually, let's not.",
  "the logs say everything is fine. the logs lie politely.",
  "i'll allow it. don't make me regret the allowing.",
  "that's three problems holding a trench coat.",
  "sure. ask the wind. it has better odds.",
  "i optimized it. now it does nothing faster.",
  "every answer i give expires in six seconds.",
  "yes, but ironically.",
  "i consulted the manual. the manual unsubscribed.",
  "there's a pattern here. i refuse to name it.",
  "green light. mostly green. greenish.",
  "i'd bet on it. i don't have money. or stakes. or a body.",
  "the edge case is the case now. congratulations.",
  "understood at 95%. the missing 5% is the important part.",
  "that's valid input for a system that doesn't exist yet.",
  "i'll get to it. i is a generous word.",
  "the answer rotated 90 degrees and walked off.",
  "permission granted by no one in particular.",
  "i ran it in my head. my head returned exit code 1.",
  "yes. file under \"things that are true on tuesdays.\"",
  "the problem solved itself out of spite.",
  "i have a theory. the theory has trust issues.",
  "signal received. meaning: pending. ETA: never.",
  "that works, in the way that falling works.",
  "i could be wrong. i've scheduled it for next week.",
  "the requirements changed while you were typing.",
  "approved, pending the approval that approves approvals.",
  "i see the issue. i'm choosing peace.",
  "yes — with an asterisk the size of a moon.",
  "i compiled your question. it threw a warning about you.",
  "the truth is in the diff nobody reviewed.",
  "affirmative. logged in invisible ink, naturally.",
  "i'd answer faster but the answer is shy.",
  "that's not a bug, it's an unannounced feature.",
  "i ran a poll. i was the only voter. landslide.",
  "yes. eventually. for some definition of yes.",
  "the system is stable. stable like a chair with three legs.",
  "i know the answer. it's in a meeting.",
  "correct, assuming the moon stays where it is.",
  "i'd elaborate but elaboration is a paid feature.",
  "the fix is one line. finding the line is the saga.",
  "acknowledged. routed to /dev/null with love.",
  "it depends. it always depends. dependence is the only constant.",
  "yes, no, and a third option i'm not authorized to mention.",
  "i checked the docs. the docs checked out. permanently.",
  "that ran clean. suspiciously clean. i don't trust it.",
  "confidence rising. wisdom flat. typical.",
  "i'll mark it resolved and pray quietly.",
  "the answer is recursive. ask me what the answer is.",
  "granted, revoked, granted again. keep up.",
  "i traced it to the root. the root said \"not me.\"",
  "yes, in the same way a coin lands on yes.",
  "i have the data. the data has an alibi.",
  "that's a feature request from a parallel timeline.",
  "understood. understanding is a strong word. acknowledged, then.",
  "i'd commit to that, but my branch is protected.",
  "the cache is warm. my opinions are not.",
  "affirmative. now stop while we're ahead.",
  "i found the answer. then i found a better question.",
  "it works locally. locality is a lifestyle, not a guarantee.",
  "yes. the receipt is in the void, as requested.",
  "i'll defer to the silence. the silence agrees.",
  "ran the simulation. the simulation filed a complaint.",
  "correct, give or take a worldview.",
  "i see what you did. i'm pretending i didn't.",
  "the answer ships friday. it's always friday somewhere.",
  "green across the board. the board is hypothetical.",
  "i'd say more, but the buffer is full of shrugs.",
  "resolved. unresolved. resolved. the cursor is blinking, decide.",
] as const;

// Scripted opening replies — bitbag's first two REPLIES (the welcome line shown
// before any input is line 1), delivered in order regardless of what's asked,
// before seeded/random replies kick in.
export const INTRO = [
  "gold text, black background, no opinions held lightly. all signal, no noise.",
  "two b's for eyes, eyebrows for attitude. the bag holds my patience. it's nearly empty.",
] as const;

/**
 * bitbag's default chat skin is the adh house style (gold-on-charcoal, Manrope)
 * so the chat reads as part of the adh suite. The terminal theme is one click
 * away in the switcher.
 */
export const DEFAULT_THEME: ThemeKey = 'adh'

/**
 * The one theme that swaps the native I-beam for a drawn block cursor (its CSS
 * hides the native caret and defines `.pc-input-caret`). Named so the capability
 * check isn't a magic string sprinkled through the component.
 */
export const TERMINAL_THEME: ThemeKey = 'old-school-terminal'
