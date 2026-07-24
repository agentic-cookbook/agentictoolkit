'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  ViewportComposer,
  ViewportShell,
  ViewportSpacer,
} from '@agentic-developer-toolkit/viewport'
import type { GazeVector } from '@agentic-developer-toolkit/chat'
import type { ThemeKey } from '@agentic-developer-toolkit/themes'
import { BitbagChat } from './BitbagChat'
import { Bitbag, type BitbagExpression } from './avatar'
import { DEFAULT_THEME } from './voice'

export interface BitbagStageProps {
  /** The toolkit theme that skins his chat. Defaults to the adh house style. */
  theme?: ThemeKey
  /** Pixel width of bitbag himself. Default 160. */
  size?: number
  /** Forces an expression, outranking the chat's hints. For debug menus. */
  expressionOverride?: BitbagExpression | null
  /** Rendered top-left over the avatar canvas — a site's own logo or nav. */
  logo?: ReactNode
  /** Extra classes on the chat's viewport shell. */
  className?: string
}

/**
 * The whole bitbag experience: he sits centred in the viewport with his chat
 * below, wired together — his expression follows the conversation, his eyes
 * follow your caret, and his chatter is muted while he's working. Mount this and
 * you have bitbag.
 */
export function BitbagStage({
  theme = DEFAULT_THEME,
  size = 160,
  expressionOverride = null,
  logo,
  className = 'relative z-10 max-w-2xl mx-auto px-4',
}: BitbagStageProps) {
  const [chatHint, setChatHint] = useState<BitbagExpression | null>(null)
  const [gaze, setGaze] = useState<GazeVector | null>(null)
  const [utterance, setUtterance] = useState<{ text: string; id: number } | null>(null)
  const [mute, setMute] = useState(false)
  // Anchors the chat's max height: it grows up only until it reaches bitbag's
  // bottom, so it never overlaps him.
  const bitbagRef = useRef<HTMLDivElement>(null)
  const utterId = useRef(0)

  const onHint = useCallback((hint: BitbagExpression | null) => setChatHint(hint), [])
  const onGaze = useCallback((g: GazeVector | null) => setGaze(g), [])
  const onMute = useCallback((m: boolean) => setMute(m), [])
  const onSpeak = useCallback((text: string) => {
    utterId.current += 1
    setUtterance({ text, id: utterId.current })
  }, [])

  // bitbag is present from the first frame — no hidden-then-reveal entrance.
  const expression = expressionOverride ?? chatHint ?? undefined

  return (
    <>
      {logo}

      <div className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div ref={bitbagRef} style={{ width: size }}>
          <Bitbag expression={expression} gaze={gaze} onSpeak={onSpeak} mute={mute} />
        </div>
      </div>

      <ViewportShell className={className}>
        <ViewportSpacer />
        <ViewportComposer className="pb-6">
          <BitbagChat
            theme={theme}
            onExpressionHint={onHint}
            onGazeHint={onGaze}
            utterance={utterance}
            onMute={onMute}
            anchorRef={bitbagRef}
          />
        </ViewportComposer>
      </ViewportShell>
    </>
  )
}
