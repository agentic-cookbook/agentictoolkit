import type { ChatMessage, ChatResponse, ChatStreamEvent } from '../types'

export interface ChatBackend {
  sendMessage(text: string, history: ChatMessage[]): Promise<ChatResponse>
  /**
   * Optional streaming variant. When present, useChatSession prefers it over
   * sendMessage so the UI can show token-by-token updates and tool-call events.
   *
   * Implementations should yield events in order and end with a `done` or
   * `error` event. Honor the AbortSignal if provided.
   */
  sendMessageStream?(
    text: string,
    history: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>
  destroy?(): void
}
