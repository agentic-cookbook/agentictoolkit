import type { ChatBackend } from './types'
import type { ChatMessage, ChatResponse } from '../types'

export interface FetchBackendOptions {
  url: string
  headers?: Record<string, string>
  mapResponse?: (data: unknown) => ChatResponse
}

export class FetchBackend implements ChatBackend {
  private url: string
  private headers: Record<string, string>
  private mapResponse: (data: unknown) => ChatResponse
  private controller: AbortController | null = null

  constructor(options: FetchBackendOptions) {
    this.url = options.url
    this.headers = { 'Content-Type': 'application/json', ...options.headers }
    this.mapResponse = options.mapResponse ?? ((data) => (data as { reply: string }).reply)
  }

  async sendMessage(text: string, history: ChatMessage[]): Promise<ChatResponse> {
    this.controller = new AbortController()

    const response = await fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message: text, history }),
      signal: this.controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Chat backend error: ${response.status}`)
    }

    const data: unknown = await response.json()
    return this.mapResponse(data)
  }

  destroy(): void {
    this.controller?.abort()
  }
}
