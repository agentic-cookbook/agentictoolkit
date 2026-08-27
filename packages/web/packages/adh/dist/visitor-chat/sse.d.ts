import type { ChatStreamEvent } from '../persona-chat/chat-types';
/** Pull a typed payload out of an SSE `data:` string, tolerating bad/empty JSON. */
export declare function parseData<T>(data: string): T | null;
/** Split one `event:`/`data:` SSE block into its raw event name + joined payload. */
export declare function parseSseBlock(block: string): {
    event: string;
    data: string;
};
/**
 * Map one parsed SSE block to the chat package's {@link ChatStreamEvent}. The
 * transcript events (token / tool_call_started / tool_call_completed / done /
 * error) map straight across; the `open` heartbeat and the out-of-band `status`
 * (retry) + `award` (gamification) events have no toolkit equivalent and are
 * dropped (return null), as is any unknown event.
 */
export declare function toStreamEvent(event: string, data: string): ChatStreamEvent | null;
/**
 * Read an SSE response body, yielding each `{ event, data }` block as it arrives.
 * Blocks are separated by a blank line (`\n\n`); a non-empty trailing block left in
 * the buffer at stream end is flushed too (harmless if it carries no event).
 */
export declare function readSseBlocks(body: ReadableStream<Uint8Array>): AsyncGenerator<{
    event: string;
    data: string;
}>;
//# sourceMappingURL=sse.d.ts.map