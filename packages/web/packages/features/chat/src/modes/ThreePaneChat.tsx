'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { ChatBackend } from '../backends/types'
import type { ChatParticipant, ChatMessage } from '../types'
import { useChatSession, type ChatSession } from '../hooks/useChatSession'
import { Transcript } from '../components/Transcript'
import { ChatInput } from '../components/ChatInput'
import { type TopicData } from './three-pane/DetailPane'
import { PanelStack } from './three-pane/PanelStack'
import { TopicsPane } from './three-pane/TopicsPane'
import { ConnectorSVG, type ConnectorPair } from './three-pane/ConnectorSVG'
import { ConnectorRegistryProvider } from './three-pane/connectors/ConnectorRegistry'
import { useThreePaneLayout } from './three-pane/useThreePaneLayout'

export interface ThreePaneChatViewProps {
  session: ChatSession
  className?: string
}

export function ThreePaneChatView({ session, className }: ThreePaneChatViewProps) {
  const { messages, isTyping, sendMessage, selectedIndex, selectMessage } = session

  const [topics, setTopics] = useState<TopicData[]>([])
  const [activeTopicIndex, setActiveTopicIndex] = useState(-1)
  const [visibleTopicIndexes, setVisibleTopicIndexes] = useState<number[]>([])

  const frameRef = useRef<HTMLDivElement>(null)
  const chatWidgetRef = useRef<HTMLDivElement>(null)
  const detailPaneRef = useRef<HTMLDivElement>(null)
  const topicsPaneRef = useRef<HTMLDivElement>(null)

  const { showTopics, recalcHeight } = useThreePaneLayout({
    frameRef,
    chatWidgetRef,
    detailPaneRef,
    topicsPaneRef,
    topicCount: topics.length,
  })

  // Derive topics from messages with popover data
  const buildTopicsFromMessages = useCallback(
    (msgs: ChatMessage[]) => {
      const newTopics: TopicData[] = []
      msgs.forEach((msg, i) => {
        if (msg.popover) {
          newTopics.push({
            title: msg.popover.title,
            description: msg.popover.description || '',
            links: msg.popover.links || [],
            images:
              msg.content
                ?.filter((c) => c.type === 'image')
                .map((c) => ({ src: (c as { src: string }).src, alt: (c as { alt?: string }).alt })) || [],
            messageIndex: i,
          })
        }
      })
      if (newTopics.length !== topics.length) {
        setTopics(newTopics)
        const last = newTopics[newTopics.length - 1]
        if (last) {
          setActiveTopicIndex(newTopics.length - 1)
          selectMessage(last.messageIndex)
        }
      }
    },
    [topics.length, selectMessage],
  )

  useEffect(() => {
    buildTopicsFromMessages(messages)
  }, [messages, buildTopicsFromMessages])

  // When a topic becomes active that isn't already in the stack, append it.
  useEffect(() => {
    if (activeTopicIndex < 0) return
    setVisibleTopicIndexes((prev) =>
      prev.includes(activeTopicIndex) ? prev : [...prev, activeTopicIndex],
    )
  }, [activeTopicIndex])

  const handleSelectTopic = useCallback(
    (topicIdx: number) => {
      const topic = topics[topicIdx]
      if (!topic) return
      setActiveTopicIndex(topicIdx)
      selectMessage(topic.messageIndex)
    },
    [topics, selectMessage],
  )

  const handleMessageClick = useCallback(
    (msgIdx: number) => {
      selectMessage(msgIdx)
      const topicIdx = topics.findIndex((t) => t.messageIndex === msgIdx)
      if (topicIdx >= 0) {
        setActiveTopicIndex(topicIdx)
      }
    },
    [topics, selectMessage],
  )

  const handleDetailArrowClick = useCallback(
    (msgIdx: number) => {
      handleMessageClick(msgIdx)
    },
    [handleMessageClick],
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (visibleTopicIndexes.length === 0) return
        e.preventDefault()
        const cur = visibleTopicIndexes.indexOf(activeTopicIndex)
        const dir = e.key === 'ArrowUp' ? -1 : +1
        const start = cur < 0 ? (dir > 0 ? -1 : visibleTopicIndexes.length) : cur
        const next = Math.max(0, Math.min(visibleTopicIndexes.length - 1, start + dir))
        const target = visibleTopicIndexes[next]
        if (target == null) return
        const targetTopic = topics[target]
        if (!targetTopic) return
        setActiveTopicIndex(target)
        selectMessage(targetTopic.messageIndex)
        return
      }
      const active = document.activeElement
      const inInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA'
      if (!inInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const input = chatWidgetRef.current?.querySelector('.pc-input') as HTMLInputElement
        input?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [visibleTopicIndexes, activeTopicIndex, topics, selectMessage])

  const connectorPairs = useMemo<ConnectorPair[]>(() => {
    const out: ConnectorPair[] = []
    for (const tIdx of visibleTopicIndexes) {
      const t = topics[tIdx]
      if (!t) continue
      const i = t.messageIndex
      out.push({ from: `msg-${i}-out`, to: `panel-${i}-in` })
      if (showTopics && tIdx === activeTopicIndex) {
        out.push({ from: `topic-${i}`, to: `msg-${i}-out` })
      }
    }
    return out
  }, [visibleTopicIndexes, topics, showTopics, activeTopicIndex])

  return (
    <ConnectorRegistryProvider>
      <div
        className={`pc-three-pane-frame ${className || ''}`}
        ref={frameRef}
      >
        <ConnectorSVG frameRef={frameRef} pairs={connectorPairs} />
        {showTopics && (
          <TopicsPane
            topics={topics}
            activeIndex={activeTopicIndex}
            onSelectTopic={handleSelectTopic}
            visible={showTopics}
          />
        )}
        <div className="pc-chat-pane" ref={chatWidgetRef}>
          <div className={`persona-chat ${className || ''}`}>
            <Transcript
              messages={messages}
              isTyping={isTyping}
              selectedIndex={selectedIndex}
              onMessageClick={handleMessageClick}
              showDetailArrows
              onDetailArrowClick={handleDetailArrowClick}
            />
            <ChatInput onSend={sendMessage} />
          </div>
        </div>
        <PanelStack
          ref={detailPaneRef}
          topics={topics}
          visibleTopicIndexes={visibleTopicIndexes}
          onImageLoad={recalcHeight}
        />
      </div>
    </ConnectorRegistryProvider>
  )
}

export interface ThreePaneChatProps {
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
  className?: string
}

export function ThreePaneChat(props: ThreePaneChatProps) {
  const session = useChatSession(props)
  return <ThreePaneChatView session={session} className={props.className} />
}
