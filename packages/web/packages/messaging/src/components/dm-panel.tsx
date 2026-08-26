'use client'

// The DM workspace panel (messaging P5): a master/detail composing the DmList
// (master) with the DmThread (detail). Mirrors the hub's master/detail idiom — a
// fixed-width list aside with a right border, a flex-1 detail pane — but self-
// contained in the shared package (the hub's MasterDetailLayout isn't importable
// here). Responsive: two panes side-by-side on md+, collapsing to a single pane on
// narrow (the list, or the selected thread with a Back affordance). This is the
// component c6 mounts as a hub workspace feature.
//
// DmPanel owns the single useDmConversations fetch and threads the selected
// conversation's live presence into the thread header; DmList + DmThread are the
// views.

import { useCallback, useMemo } from 'react'
import { useDualModeSelection } from '@agenticdevelopertoolkit/ui/hooks/useDualModeSelection'

import { useDmConversations } from '../hooks/use-dms'
import { DmList } from './dm-list'
import { DmThread } from './dm-thread'
import { cx } from './util'

export function DmPanel({
  className,
  urlSelection,
}: {
  className?: string
  /**
   * Opt-in URL-driven selection: when provided, the open conversation lives in the
   * URL (deep-linkable — the standalone /<slug>/messaging route passes this); when
   * omitted, selection is internal state (the embedded ecosystem-topic use), so the
   * panel is byte-for-byte unchanged there.
   */
  urlSelection?: { openChatId: string | null; onSelect: (chatId: string | null) => void }
}) {
  const { chats, loading, error, hasMore, loadMore, loadingMore } = useDmConversations()
  // Dual-mode selection: the open conversation lives in the URL (URL-driven, deep-linkable) when
  // `urlSelection` is passed, else internal state (the embedded ecosystem-topic use).
  const { selectedId: selectedChatId, select } = useDualModeSelection(
    urlSelection && { selectedId: urlSelection.openChatId, onSelect: urlSelection.onSelect },
  )

  // The selected conversation (for the thread header's name + live presence).
  const selected = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId],
  )

  // The conversation to actually SHOW. While conversations are still loading, keep the
  // raw id so a deep-link's thread pane renders its own loading state; once loaded, an
  // id that matches nothing (deleted/unknown — e.g. a stale deep link) resolves to
  // null so we FAIL SAFE to the list instead of an empty thread with the list hidden
  // on mobile.
  const effectiveChatId = selected ? selected.chatId : loading ? selectedChatId : null

  const onSelect = useCallback((chatId: string) => select(chatId), [select])
  const onBack = useCallback(() => select(null), [select])

  return (
    <div className={cx('flex min-h-0 flex-1', className)}>
      {/* Master — the conversation list. Hidden on narrow once a thread is open. */}
      <aside
        className={cx(
          'min-h-0 w-full flex-col border-apt-border md:flex md:w-80 md:border-r',
          effectiveChatId ? 'hidden' : 'flex',
        )}
      >
        <DmList
          chats={chats}
          loading={loading}
          error={error}
          selectedChatId={effectiveChatId}
          onSelect={onSelect}
          hasMore={hasMore}
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          className="flex-1"
        />
      </aside>

      {/* Detail — the open thread. Hidden on narrow until a thread is selected. */}
      <div
        className={cx(
          'min-h-0 min-w-0 flex-1 flex-col md:flex',
          effectiveChatId ? 'flex' : 'hidden',
        )}
      >
        <DmThread
          chatId={effectiveChatId}
          otherUserId={selected?.otherUserId}
          online={selected?.online ?? false}
          lastSeenAt={selected?.lastSeenAt ?? null}
          onBack={onBack}
          className="flex-1"
        />
      </div>
    </div>
  )
}
