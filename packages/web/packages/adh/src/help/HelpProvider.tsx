'use client'

import dynamic from 'next/dynamic'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { findTopicPath, type HelpTopicId } from './topics'

// Lazy: the window pulls in the markdown renderer (shiki) and the API browser — plus, through
// MarkdownTopic, the whole 240K pre-rendered help corpus. Split into a chunk loaded on first open
// so no page pays that weight until someone actually opens Help. Imported by PACKAGE PATH (not
// './HelpWindow') so tsup keeps it an un-inlined preserved import (matching its `external` entry +
// own tsup entry); the consumer's bundler then resolves + code-splits it. Rendered
// only while `isOpen` (below), which is false during SSR, so it never server-renders.
const HelpWindow = dynamic(() =>
  import('@agentic-toolkit/adh/help/HelpWindow').then((m) => m.HelpWindow),
)

export interface HelpContextValue {
  isOpen: boolean
  /** Open the modal. Pass a topic id to deep-link straight to it (e.g. `open('errors')`). */
  open: (topicId?: HelpTopicId) => void
  close: () => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

/**
 * Mounts the single Help modal for a site and exposes {@link useHelp} to open it from anywhere.
 * Placed once in the shared {@link AppShell}, so every site gets Help with no per-app wiring, and
 * any feature (an error toast, an empty state) can deep-link a topic via `useHelp().open(id)`.
 *
 * Owns both the open state and the selection `path` so a deep-link and manual navigation share one
 * source of truth; the window itself is presentational.
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [path, setPath] = useState<string[]>([])

  const open = useCallback((topicId?: HelpTopicId) => {
    if (topicId) {
      const nodes = findTopicPath(topicId)
      // Unknown id → open at the root rather than throw; the tree still shows every topic.
      setPath(nodes ? nodes.map((n) => n.id) : [])
    }
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<HelpContextValue>(() => ({ isOpen, open, close }), [isOpen, open, close])

  return (
    <HelpContext.Provider value={value}>
      {children}
      {isOpen && <HelpWindow open onClose={close} path={path} onPathChange={setPath} />}
    </HelpContext.Provider>
  )
}

/**
 * Open/close the Help modal from anywhere under a {@link HelpProvider}.
 *
 * Returns a safe no-op outside a provider so a stray Help trigger never crashes its host (a header
 * button is worse dead than fatal) — the button just won't open the absent window.
 */
export function useHelp(): HelpContextValue {
  return useContext(HelpContext) ?? NOOP
}

const NOOP: HelpContextValue = { isOpen: false, open: () => {}, close: () => {} }
