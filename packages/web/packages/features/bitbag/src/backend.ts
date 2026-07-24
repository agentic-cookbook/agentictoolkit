import {
  ShuffleBag,
  streamTokens,
  type ChatBackend,
  type ChatMessage,
  type ChatResponse,
  type ChatStreamEvent,
} from '@agentic-developer-toolkit/chat'
import { FALLBACKS, INTRO, SEEDED } from './voice'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface BitbagBackendOptions {
  /** Floor of the faked "thinking" window. Default 2000ms. */
  thinkMinMs?: number
  /** Random extra thinking time on top of the floor. Default 3000ms. */
  thinkJitterMs?: number
  /** Floor delay between streamed tokens. Default 45ms. */
  tokenMinMs?: number
  /** Random extra delay between streamed tokens. Default 55ms. */
  tokenJitterMs?: number
}

/**
 * bitbag's mock backend: a scripted intro, then seeded pattern replies, then a
 * shuffle bag of fallbacks so a session never repeats itself. Replies carry no
 * "// " prefix — that's a per-theme flourish (green-matrix adds it via CSS;
 * old-school-terminal omits it). Keep the content prefix-free.
 */
export class BitbagBackend implements ChatBackend {
  readonly #opts: Required<BitbagBackendOptions>
  #intro: string[] = [...INTRO]
  readonly #bag = new ShuffleBag(FALLBACKS)

  constructor(opts: BitbagBackendOptions = {}) {
    this.#opts = {
      thinkMinMs: opts.thinkMinMs ?? 2000,
      thinkJitterMs: opts.thinkJitterMs ?? 3000,
      tokenMinMs: opts.tokenMinMs ?? 45,
      tokenJitterMs: opts.tokenJitterMs ?? 55,
    }
  }

  // Pick the reply text: drain the scripted intro, then seeded, then fallbacks.
  #reply(text: string): string {
    const intro = this.#intro.shift()
    if (intro !== undefined) return intro
    for (const { match, reply } of SEEDED) {
      if (match.test(text)) return reply
    }
    return this.#bag.next()
  }

  #think(): Promise<void> {
    return delay(this.#opts.thinkMinMs + Math.random() * this.#opts.thinkJitterMs)
  }

  /** Non-streaming path — kept for non-streaming consumers. */
  async sendMessage(text: string, _history: ChatMessage[]): Promise<ChatResponse> {
    await this.#think()
    return this.#reply(text)
  }

  /**
   * Streaming path: think for a beat, then let the words come out one at a time
   * so bitbag reads as actually talking (and the status keeps animating through
   * the reveal).
   */
  async *sendMessageStream(
    text: string,
    _history: ChatMessage[],
  ): AsyncIterable<ChatStreamEvent> {
    await this.#think()
    yield* streamTokens(this.#reply(text), {
      minMs: this.#opts.tokenMinMs,
      jitterMs: this.#opts.tokenJitterMs,
    })
  }
}
