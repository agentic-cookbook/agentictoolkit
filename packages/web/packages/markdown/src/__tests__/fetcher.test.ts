import { describe, it, expect, vi, afterEach } from 'vitest'
import { defaultMarkdownFetcher } from '../hooks/useMarkdownDocument'

// Helpers — build minimal Response-shaped mocks without a real DOM.
function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (_k: string) => null } as unknown as Headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function makeErrorResponse(
  status: number,
  contentType: string | null,
  body: string,
): Response {
  return {
    ok: false,
    status,
    headers: { get: (k: string) => (k === 'content-type' ? contentType : null) } as unknown as Headers,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('defaultMarkdownFetcher', () => {
  it('resolves to the JSON body on an ok response', async () => {
    const doc = { id: 'abc', title: 'Test doc', content: '# Hello' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(doc)))

    const signal = new AbortController().signal
    const result = await defaultMarkdownFetcher('abc', signal)

    expect(result).toEqual(doc)
  })

  // body-read-once path: the fetcher reads the body as text and then parses
  // problem+json from that string — no double-read on the Response stream.
  it('rejects with a "title — detail" message for problem+json errors', async () => {
    const body = JSON.stringify({ title: 'Bad', detail: 'nope' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeErrorResponse(422, 'application/problem+json', body),
      ),
    )

    const signal = new AbortController().signal
    await expect(defaultMarkdownFetcher('x', signal)).rejects.toThrow('Bad — nope')
  })

  it('rejects with "Document not found" for a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeErrorResponse(404, null, '')),
    )

    const signal = new AbortController().signal
    await expect(defaultMarkdownFetcher('missing', signal)).rejects.toThrow(
      'Document not found',
    )
  })
})
