import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatBackend } from '../backends/types'
import type {
  ChatParticipant,
  ChatMessage,
  ChatResponse,
  ToolCallInfo,
} from '../types'

// crypto.randomUUID requires a secure context and iOS Safari 15.4+. Fall back
// to getRandomValues, then Math.random, so non-HTTPS dev hosts and older
// mobile browsers don't crash.
function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export interface UseChatSessionOptions {
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
}

export interface ChatSession {
  messages: ChatMessage[]
  isTyping: boolean
  sendMessage: (text: string) => void
  selectedIndex: number
  selectMessage: (index: number) => void
}

function createMessage(
  sender: ChatParticipant,
  text: string,
  isPersona: boolean,
  response?: Exclude<ChatResponse, string>,
): ChatMessage {
  return {
    id: uuid(),
    sender,
    text,
    content: response?.content,
    popover: response?.popover,
    timestamp: new Date(),
    isPersona,
  }
}

async function consumeStream(
  backend: ChatBackend,
  text: string,
  history: ChatMessage[],
  persona: ChatParticipant,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  setIsTyping: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  const placeholderId = uuid()
  let placeholderInserted = false

  const ensurePlaceholder = () => {
    if (placeholderInserted) return
    placeholderInserted = true
    setIsTyping(false)
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        sender: persona,
        text: '',
        timestamp: new Date(),
        isPersona: true,
        isStreaming: true,
      },
    ])
  }

  const updatePlaceholder = (mutator: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === placeholderId ? mutator(m) : m)),
    )
  }

  const completeToolCall = (
    toolCalls: ToolCallInfo[] | undefined,
    name: string,
    ok: boolean,
    result: string,
  ): ToolCallInfo[] => {
    const list = toolCalls ?? []
    // Update the most recent 'started' entry with this name.
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i]
      if (entry && entry.name === name && entry.status === 'started') {
        const next = [...list]
        next[i] = {
          ...entry,
          name: entry.name,
          status: ok ? 'completed' : 'failed',
          ok,
          result,
        }
        return next
      }
    }
    // No matching started — append synthetic completed entry.
    return [
      ...list,
      {
        name,
        arguments: '',
        status: ok ? 'completed' : 'failed',
        ok,
        result,
      },
    ]
  }

  try {
    const stream = backend.sendMessageStream!(text, history)
    for await (const event of stream) {
      ensurePlaceholder()
      switch (event.type) {
        case 'token':
          updatePlaceholder((m) => ({ ...m, text: m.text + event.text }))
          break
        case 'tool_call_started':
          updatePlaceholder((m) => ({
            ...m,
            toolCalls: [
              ...(m.toolCalls ?? []),
              {
                name: event.name,
                arguments: event.arguments,
                status: 'started',
              },
            ],
          }))
          break
        case 'tool_call_completed':
          updatePlaceholder((m) => ({
            ...m,
            toolCalls: completeToolCall(m.toolCalls, event.name, event.ok, event.result),
          }))
          break
        case 'content':
          updatePlaceholder((m) => ({ ...m, content: event.items }))
          break
        case 'popover':
          updatePlaceholder((m) => ({ ...m, popover: event.data }))
          break
        case 'error':
          updatePlaceholder((m) => ({
            ...m,
            text: m.text || event.message,
            isStreaming: false,
          }))
          return
        case 'done':
          updatePlaceholder((m) => ({ ...m, isStreaming: false }))
          return
      }
    }
    // Stream ended without 'done' — clear streaming flag anyway.
    if (placeholderInserted) {
      updatePlaceholder((m) => ({ ...m, isStreaming: false }))
    }
  } finally {
    setIsTyping(false)
  }
}

export function useChatSession(options: UseChatSessionOptions): ChatSession {
  const { backend, persona, user = { name: 'You', avatar: 'Y' } } = options

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (options.welcomeMessage) {
      return [createMessage(persona, options.welcomeMessage, true)]
    }
    return []
  })
  const [isTyping, setIsTyping] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return
    processingRef.current = true

    while (queueRef.current.length > 0) {
      const text = queueRef.current.shift()!
      setIsTyping(true)

      try {
        if (backend.sendMessageStream) {
          await consumeStream(backend, text, messagesRef.current, persona, setMessages, setIsTyping)
        } else {
          const response = await backend.sendMessage(text, messagesRef.current)
          setIsTyping(false)

          if (typeof response === 'string') {
            setMessages((prev) => [...prev, createMessage(persona, response, true)])
          } else {
            setMessages((prev) => [
              ...prev,
              createMessage(persona, response.text || '', true, response),
            ])
          }
        }
      } catch {
        setIsTyping(false)
        setMessages((prev) => [
          ...prev,
          createMessage(persona, "Sorry, something went wrong. Let's try again.", true),
        ])
      }
    }

    processingRef.current = false
  }, [backend, persona])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setMessages((prev) => [...prev, createMessage(user, trimmed, false)])
      queueRef.current.push(trimmed)
      processQueue()
    },
    [user, processQueue],
  )

  const selectMessage = useCallback(
    (index: number) => {
      if (index >= -1 && index < messages.length) {
        setSelectedIndex(index)
      }
    },
    [messages.length],
  )

  useEffect(() => {
    return () => {
      backend.destroy?.()
    }
  }, [backend])

  return useMemo(
    () => ({ messages, isTyping, sendMessage, selectedIndex, selectMessage }),
    [messages, isTyping, sendMessage, selectedIndex, selectMessage],
  )
}
