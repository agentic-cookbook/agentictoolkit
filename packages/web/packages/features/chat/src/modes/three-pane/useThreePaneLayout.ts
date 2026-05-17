import { useCallback, useEffect, useRef, type RefObject } from 'react'

interface UseThreePaneLayoutOptions {
  frameRef: RefObject<HTMLElement | null>
  chatWidgetRef: RefObject<HTMLElement | null>
  detailPaneRef: RefObject<HTMLElement | null>
  topicsPaneRef: RefObject<HTMLElement | null>
  topicCount: number
  onResize?: () => void
}

export function useThreePaneLayout({
  frameRef,
  chatWidgetRef,
  detailPaneRef,
  topicsPaneRef,
  topicCount,
  onResize,
}: UseThreePaneLayoutOptions) {
  const showDetail = topicCount > 0
  const showTopics = topicCount > 1

  const recalcHeight = useCallback(() => {
    const frame = frameRef.current
    const chatWidget = chatWidgetRef.current
    if (!frame || !chatWidget) return

    const transcript = chatWidget.querySelector('.pc-transcript') as HTMLElement
    const inputArea = chatWidget.querySelector('.pc-input-area') as HTMLElement
    if (!transcript || !inputArea) return

    const chatNatural = transcript.scrollHeight + inputArea.offsetHeight + 2

    let detailNatural = 0
    const detailPane = detailPaneRef.current
    if (detailPane && showDetail) {
      detailNatural = detailPane.scrollHeight
    }

    let topicsNatural = 0
    const topicsPane = topicsPaneRef.current
    if (topicsPane && showTopics) {
      topicsNatural = topicsPane.scrollHeight
    }

    const maxHeight = window.innerHeight * 0.85
    const height = Math.max(
      chatNatural,
      Math.min(Math.max(detailNatural, topicsNatural), maxHeight),
    )

    frame.style.height = height + 'px'
    if (detailPane) detailPane.style.maxHeight = height + 'px'
    if (topicsPane) topicsPane.style.maxHeight = height + 'px'

    onResize?.()
  }, [frameRef, chatWidgetRef, detailPaneRef, topicsPaneRef, showDetail, showTopics, onResize])

  // ResizeObserver on all panes
  const observerRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const observer = new ResizeObserver(() => recalcHeight())
    observerRef.current = observer

    if (chatWidgetRef.current) observer.observe(chatWidgetRef.current)
    if (detailPaneRef.current) observer.observe(detailPaneRef.current)
    if (topicsPaneRef.current) observer.observe(topicsPaneRef.current)

    window.addEventListener('resize', recalcHeight)
    recalcHeight()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalcHeight)
    }
  }, [chatWidgetRef, detailPaneRef, topicsPaneRef, recalcHeight])

  // Recalc when topic count changes
  useEffect(() => {
    recalcHeight()
  }, [topicCount, recalcHeight])

  return { showDetail, showTopics, recalcHeight }
}
