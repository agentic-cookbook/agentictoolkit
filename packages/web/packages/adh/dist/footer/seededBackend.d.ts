import type { ChatBackend } from '../persona-chat/chat-types';
/** bitbag is the family's assistant identity. Single source so the Help
 *  assistant introduces itself with the same name as bitbag proper. */
export declare const BITBAG_PERSONA: {
    name: string;
};
/** One topical reply: the first `match` to test true against the input wins. */
export type SeededReply = {
    match: RegExp;
    reply: string;
};
export type SeededBackendOptions = {
    /** Topical replies, tried in order. */
    seeded: SeededReply[];
    /** Replies used when nothing matches; one is picked deterministically. */
    fallbacks: string[];
    /** "Thinking" delay before answering, ms (so the indicator reads as real). */
    delayMs?: number;
};
/** Build a deterministic, regex-seeded canned backend. Shared by the Help sites
 *  so the assistant answers consistently across their surfaces. */
export declare function createSeededBackend(opts: SeededBackendOptions): ChatBackend;
//# sourceMappingURL=seededBackend.d.ts.map