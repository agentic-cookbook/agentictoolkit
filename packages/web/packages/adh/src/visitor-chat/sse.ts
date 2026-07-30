import type { ChatStreamEvent } from '../persona-chat/chat-types'

// SSE wire → toolkit ChatStreamEvent mapping for bitbag's visitor-chat backend.
//
// The wire format is the one the adh chat SSE route emits
// (backend/src/adh/src/routes/chat.ts): `stream.writeSSE({ event: type, data:
// JSON.stringify(rest) })` for each event `runChatTurn` yields (its ChatStreamEvent
// union in src/llm/service.ts), preceded by a `{ event: 'open', data: '' }`
// heartbeat. The visitor turn route (POST /public/visitor-chat/conversations/:id/
// turns) reuses that SAME vocabulary — see visitor-auth.md. Concretely, per block:
//
//   event: open                 data: (empty)                                  ← heartbeat
//   event: token                data: {"text":"…"}
//   event: tool_call_started    data: {"name":"…","arguments":"…"}
//   event: tool_call_completed  data: {"name":"…","ok":true,"result":"…"}
//   event: status               data: {"phase":"retrying","attempt":1}         ← out-of-band
//   event: award                data: {"badges":[…],"xpGained":…,"leveledUpTo":…} ← out-of-band
//   event: done                 data: {}
//   event: error                data: {"message":"…"}
//
// (This parsing mirrors the authenticated PersonaChatBackend in
// this package's ./persona-chat — deliberately kept local to the site so the
// visitor path can diverge from the auth path without coupling.)

/** Pull a typed payload out of an SSE `data:` string, tolerating bad/empty JSON. */
export function parseData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

/** Split one `event:`/`data:` SSE block into its raw event name + joined payload. */
export function parseSseBlock(block: string): { event: string; data: string } {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
    // `:` comment lines and `id:`/`retry:` are ignored.
  }
  return { event, data: dataLines.join('\n') }
}

/**
 * Map one parsed SSE block to the chat package's {@link ChatStreamEvent}. The
 * transcript events (token / tool_call_started / tool_call_completed / done /
 * error) map straight across; the `open` heartbeat and the out-of-band `status`
 * (retry) + `award` (gamification) events have no toolkit equivalent and are
 * dropped (return null), as is any unknown event.
 */
export function toStreamEvent(event: string, data: string): ChatStreamEvent | null {
  switch (event) {
    case 'token':
      return { type: 'token', text: parseData<{ text: string }>(data)?.text ?? '' }
    case 'tool_call_started': {
      const d = parseData<{ name: string; arguments: string }>(data)
      return d ? { type: 'tool_call_started', name: d.name, arguments: d.arguments } : null
    }
    case 'tool_call_completed': {
      const d = parseData<{ name: string; ok: boolean; result: string }>(data)
      return d ? { type: 'tool_call_completed', name: d.name, ok: d.ok, result: d.result } : null
    }
    case 'done':
      return { type: 'done' }
    case 'error':
      return {
        type: 'error',
        message: parseData<{ message: string }>(data)?.message ?? 'Chat failed.',
      }
    default:
      return null
  }
}

/**
 * Read an SSE response body, yielding each `{ event, data }` block as it arrives.
 * Blocks are separated by a blank line (`\n\n`); a non-empty trailing block left in
 * the buffer at stream end is flushed too (harmless if it carries no event).
 */
export async function* readSseBlocks(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  // SSE treats LF, CR, and CRLF all as line terminators; the adh route emits LF, but normalize on
  // the way in so a CRLF-rewriting intermediary can't hide the blank-line block boundary (the
  // '\n\n' split below would otherwise never match on '\r\n\r\n').
  const push = (text: string): void => {
    buffer += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      push(decoder.decode(value, { stream: true }))
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        yield parseSseBlock(buffer.slice(0, sep))
        buffer = buffer.slice(sep + 2)
      }
    }
    push(decoder.decode()) // flush a multibyte char split across the final chunk boundary
    const tail = buffer.trim()
    if (tail) yield parseSseBlock(tail)
  } finally {
    reader.releaseLock()
  }
}
