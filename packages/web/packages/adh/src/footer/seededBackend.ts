// The local traceable copy, NOT `@agenticdevelopertoolkit/chat` — that package is in
// a sibling submodule this one must not depend on (see the header of chat-types.ts
// for why). These are type-only, so nothing crosses at runtime; the structural shape
// is what a consumer's real chat package has to satisfy.
import type {
  ChatBackend,
  ChatMessage,
  ChatResponse,
} from '../persona-chat/chat-types'

// Shared, dependency-free chat backend MECHANISM for the family's canned
// assistant. There is NO anonymous chat-completion endpoint yet — the registry's
// `complete`/`chat` route is still pending (the persona toolkit's M1) and the
// only real backend we have (PersonaLlmBackend in hub settings) needs a
// user-supplied API key. So until then the Help sites use this deterministic,
// regex-seeded stand-in with their own topical replies.
//
// The chat package's own `MockBackend` only does exact-key matching, so it can't
// express the topical (regex) replies those surfaces need — hence this small
// shared factory instead of a per-surface hand-roll.
//
// NOT the footer: the footer runs bitbag proper (BitbagDock, with his own
// scripted voice) — see FooterChatInner. This file stays under footer/ only
// because that is the package subpath the Help sites already import it from.

/** bitbag is the family's assistant identity. Single source so the Help
 *  assistant introduces itself with the same name as bitbag proper. */
export const BITBAG_PERSONA = { name: 'bitbag' }

/** One topical reply: the first `match` to test true against the input wins. */
export type SeededReply = { match: RegExp; reply: string }

export type SeededBackendOptions = {
  /** Topical replies, tried in order. */
  seeded: SeededReply[]
  /** Replies used when nothing matches; one is picked deterministically. */
  fallbacks: string[]
  /** "Thinking" delay before answering, ms (so the indicator reads as real). */
  delayMs?: number
}

// Deterministic pick so the same question yields a stable reply (no Math.random,
// which would also break SSR/hydration determinism). `| 0` keeps `h` a signed
// 32-bit int; `Math.abs` on a JS number returns a non-negative double, so the
// index is always in range.
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

class SeededBackend implements ChatBackend {
  constructor(private readonly opts: SeededBackendOptions) {}

  async sendMessage(text: string, _history: ChatMessage[]): Promise<ChatResponse> {
    await new Promise((r) => setTimeout(r, this.opts.delayMs ?? 450))
    for (const { match, reply } of this.opts.seeded) {
      if (match.test(text)) return reply
    }
    const { fallbacks } = this.opts
    return fallbacks[Math.abs(hash(text)) % fallbacks.length] ?? fallbacks[0]!
  }
}

/** Build a deterministic, regex-seeded canned backend. Shared by the Help sites
 *  so the assistant answers consistently across their surfaces. */
export function createSeededBackend(opts: SeededBackendOptions): ChatBackend {
  return new SeededBackend(opts)
}
