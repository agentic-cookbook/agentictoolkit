// Components
export { InlineChat, InlineChatView } from './modes/InlineChat'
export type { InlineChatSizing } from './modes/InlineChat'
export { ThreePaneChat, ThreePaneChatView } from './modes/ThreePaneChat'
export { MobileChat, MobileChatView } from './modes/MobileChat'
export { PersonaChat } from './modes/PersonaChat'
export { Transcript } from './components/Transcript'
export { ContentOverlay } from './components/ContentOverlay'
export type { ContentOverlayProps } from './components/ContentOverlay'

// Backends
export { MockBackend } from './backends/MockBackend'
export { FetchBackend } from './backends/FetchBackend'
export type { ChatBackend } from './backends/types'

// Types
export type {
  ChatParticipant,
  ChatMessage,
  ChatResponse,
  ChatStreamEvent,
  ToolCallInfo,
  ContentItem,
  LinkContent,
  ImageContent,
  PopoverData,
  ChatMode,
} from './types'

// Hooks (for advanced usage)
export { useChatSession } from './hooks/useChatSession'
export type { ChatSession } from './hooks/useChatSession'
