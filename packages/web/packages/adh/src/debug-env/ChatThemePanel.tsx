'use client'

import { Paintbrush, SwatchBook } from 'lucide-react'
import type { TopicLevel, TopicDetailItem } from '@agentic-toolkit/ui/blocks'
import type { DebugConsoleChatTheme } from './DebugConsoleProvider'

const DEFAULT_ID = '__default'

/** Map the active key (`null` = app default) to the rail's sentinel id. */
function toId(key: string | null): string {
  return key ?? DEFAULT_ID
}
function fromId(id: string): string | null {
  return id === DEFAULT_ID ? null : id
}

/** Build the chat-themes rail level. Selecting a row applies that theme immediately. */
export function buildChatThemeLevel(chat: DebugConsoleChatTheme): TopicLevel {
  // Row icons: the built-in default is the swatch book the app ships with; every named theme is
  // a brush of its own (no placeholder circles).
  const items: TopicDetailItem[] = [
    { id: DEFAULT_ID, label: 'App default', icon: <SwatchBook /> },
    ...chat.themes.map((t) => ({ id: t.key, label: t.label, icon: <Paintbrush /> })),
  ]
  return {
    id: 'chat',
    title: 'Chat theme',
    items,
    selectedId: toId(chat.current),
    // Package-owned unselection: HTD calls onClear on a re-click; treat that as
    // "revert to app default" so the leaf always previews the active theme.
    onSelect: (id) => chat.onChange(fromId(id)),
    onClear: () => chat.onChange(null),
    emptyLabel: 'No chat themes.',
  }
}

/** Leaf detail: a live preview of the active chat theme on a sample chat surface. */
export function ChatThemePreview({ chat }: { chat: DebugConsoleChatTheme }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <p className="font-mono text-xs text-apt-text-dim">
        {chat.current ? `Previewing: ${chat.current}` : 'App default'}
      </p>
      <div className="rounded-md border border-apt-border p-3">{chat.renderPreview(chat.current)}</div>
    </div>
  )
}
