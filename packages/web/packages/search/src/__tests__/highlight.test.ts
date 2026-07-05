import { describe, expect, it } from 'vitest'
import { splitHighlightSegments } from '../lib/highlight'

describe('splitHighlightSegments', () => {
  it('returns a single non-match segment for an empty query', () => {
    expect(splitHighlightSegments('Hello world', '')).toEqual([
      { text: 'Hello world', match: false },
    ])
  })

  it('returns [] for empty text', () => {
    expect(splitHighlightSegments('', 'x')).toEqual([])
  })

  it('marks a case-insensitive match', () => {
    expect(splitHighlightSegments('Agentic AGENTS', 'agent')).toEqual([
      { text: 'Agent', match: true },
      { text: 'ic ', match: false },
      { text: 'AGENT', match: true },
      { text: 'S', match: false },
    ])
  })

  it('marks each whitespace-separated term', () => {
    expect(splitHighlightSegments('alpha beta gamma', 'alpha gamma')).toEqual([
      { text: 'alpha', match: true },
      { text: ' beta ', match: false },
      { text: 'gamma', match: true },
    ])
  })

  it('treats regex-special characters in the query literally (escape-safe)', () => {
    // A naive RegExp would throw or over-match on `.*`; here it must match the literal.
    expect(splitHighlightSegments('a.*b and ab', '.*')).toEqual([
      { text: 'a', match: false },
      { text: '.*', match: true },
      { text: 'b and ab', match: false },
    ])
  })
})
