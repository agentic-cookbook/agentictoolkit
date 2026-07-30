import { describe, expect, it } from 'vitest'
import { parseData, parseSseBlock, readSseBlocks, toStreamEvent } from '../visitor-chat/sse'

/** Build a ReadableStream that emits `chunks` (as UTF-8) in order, so we can prove the
 *  parser reassembles blocks split across arbitrary read boundaries. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]))
      else controller.close()
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>): Promise<{ event: string; data: string }[]> {
  const out: { event: string; data: string }[] = []
  for await (const block of readSseBlocks(body)) out.push(block)
  return out
}

describe('parseData', () => {
  it('parses valid JSON', () => {
    expect(parseData<{ text: string }>('{"text":"hi"}')).toEqual({ text: 'hi' })
  })
  it('returns null on empty/invalid JSON instead of throwing', () => {
    expect(parseData('')).toBeNull()
    expect(parseData('not json')).toBeNull()
  })
})

describe('parseSseBlock', () => {
  it('splits event + data and strips the single leading space after "data:"', () => {
    expect(parseSseBlock('event: token\ndata: {"text":"hello"}')).toEqual({
      event: 'token',
      data: '{"text":"hello"}',
    })
  })
  it('joins multiple data: lines with newlines', () => {
    expect(parseSseBlock('event: x\ndata: a\ndata: b')).toEqual({ event: 'x', data: 'a\nb' })
  })
  it('ignores comment / id / retry lines and defaults event to "message"', () => {
    expect(parseSseBlock(':keep-alive\nid: 7\nretry: 500\ndata: {}')).toEqual({
      event: 'message',
      data: '{}',
    })
  })
})

describe('toStreamEvent', () => {
  it('maps token, defaulting missing text to empty', () => {
    expect(toStreamEvent('token', '{"text":"hi"}')).toEqual({ type: 'token', text: 'hi' })
    expect(toStreamEvent('token', '{}')).toEqual({ type: 'token', text: '' })
  })
  it('maps tool_call_started / tool_call_completed', () => {
    expect(toStreamEvent('tool_call_started', '{"name":"search","arguments":"{}"}')).toEqual({
      type: 'tool_call_started',
      name: 'search',
      arguments: '{}',
    })
    expect(toStreamEvent('tool_call_completed', '{"name":"search","ok":true,"result":"r"}')).toEqual({
      type: 'tool_call_completed',
      name: 'search',
      ok: true,
      result: 'r',
    })
  })
  it('maps done and error (error falls back to a friendly message)', () => {
    expect(toStreamEvent('done', '{}')).toEqual({ type: 'done' })
    expect(toStreamEvent('error', '{"message":"boom"}')).toEqual({ type: 'error', message: 'boom' })
    expect(toStreamEvent('error', 'bad')).toEqual({ type: 'error', message: 'Chat failed.' })
  })
  it('drops the open heartbeat and out-of-band status/award/unknown events (null)', () => {
    expect(toStreamEvent('open', '')).toBeNull()
    expect(toStreamEvent('status', '{"phase":"retrying","attempt":1}')).toBeNull()
    expect(toStreamEvent('award', '{"badges":[]}')).toBeNull()
    expect(toStreamEvent('mystery', '{}')).toBeNull()
  })
})

describe('readSseBlocks', () => {
  it('yields each blank-line-separated block', async () => {
    const blocks = await collect(
      streamOf(['event: open\ndata: \n\nevent: token\ndata: {"text":"hi"}\n\nevent: done\ndata: {}\n\n']),
    )
    expect(blocks).toEqual([
      { event: 'open', data: '' },
      { event: 'token', data: '{"text":"hi"}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('reassembles a block split across read boundaries', async () => {
    const blocks = await collect(streamOf(['event: tok', 'en\ndata: {"text":"', 'hi"}\n\n']))
    expect(blocks).toEqual([{ event: 'token', data: '{"text":"hi"}' }])
  })

  it('flushes a non-empty trailing block with no terminating blank line', async () => {
    const blocks = await collect(streamOf(['event: done\ndata: {}']))
    expect(blocks).toEqual([{ event: 'done', data: '{}' }])
  })

  it('drives an end-to-end transcript through toStreamEvent', async () => {
    const wire =
      'event: open\ndata: \n\n' +
      'event: token\ndata: {"text":"Hel"}\n\n' +
      'event: token\ndata: {"text":"lo"}\n\n' +
      'event: status\ndata: {"phase":"retrying","attempt":1}\n\n' +
      'event: done\ndata: {}\n\n'
    const events = []
    for await (const { event, data } of readSseBlocks(streamOf([wire]))) {
      const evt = toStreamEvent(event, data)
      if (evt) events.push(evt)
    }
    expect(events).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo' },
      { type: 'done' },
    ])
  })
})
