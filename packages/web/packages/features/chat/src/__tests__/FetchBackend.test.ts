import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FetchBackend } from '../backends/FetchBackend'

describe('FetchBackend', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  it('sends POST with message and history', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Hello back!' }),
    })
    globalThis.fetch = mockFetch

    const backend = new FetchBackend({ url: '/api/chat' })
    const result = await backend.sendMessage('hi', [])

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hi', history: [] }),
      }),
    )
    expect(result).toBe('Hello back!')
  })

  it('sends custom headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'ok' }),
    })

    const backend = new FetchBackend({
      url: '/api/chat',
      headers: { Authorization: 'Bearer token123' },
    })
    await backend.sendMessage('hi', [])

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        },
      }),
    )
  })

  it('uses custom response mapper', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { answer: 'Mapped!' } }),
    })

    const backend = new FetchBackend({
      url: '/api/chat',
      mapResponse: (data) => (data as { data: { answer: string } }).data.answer,
    })

    const result = await backend.sendMessage('hi', [])
    expect(result).toBe('Mapped!')
  })

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    const backend = new FetchBackend({ url: '/api/chat' })
    await expect(backend.sendMessage('hi', [])).rejects.toThrow('Chat backend error: 500')
  })

  it('aborts in-flight request on destroy', async () => {
    let capturedSignal: AbortSignal | undefined
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      capturedSignal = opts?.signal
      return new Promise(() => {}) // never resolves
    })

    const backend = new FetchBackend({ url: '/api/chat' })
    backend.sendMessage('hi', []) // fire and forget
    backend.destroy()

    expect(capturedSignal?.aborted).toBe(true)
  })
})
