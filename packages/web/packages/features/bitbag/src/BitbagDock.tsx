'use client'

import { useCallback, useRef, useState } from 'react'
import type { ChatBackend, GazeVector } from '@agenticdevelopertoolkit/chat'
import type { ThemeKey } from '@agenticdevelopertoolkit/themes'
import { BitbagChat } from './BitbagChat'
import { Bitbag, type BitbagExpression } from './avatar'
import { DEFAULT_THEME } from './voice'

export interface BitbagDockProps {
  /** The toolkit theme that skins his chat. Defaults to the adh house style. */
  theme?: ThemeKey
  /**
   * The chat backend driving his conversation. Defaults to bitbag's built-in
   * scripted mock; pass a real `ChatBackend` to wire him to a live service.
   */
  backend?: ChatBackend
  /** Pixel width of bitbag himself. Default 132 — he rides above his own chat. */
  size?: number
  /** Extra classes on the dock column — the host's positioning wrapper. */
  className?: string
}

/**
 * bitbag as a FIXTURE: his face riding just above his chat, in a column that
 * hugs whatever edge the host parks it on. Idle he folds down to a single entry
 * line and dozes at half size; reach for him and he wakes and grows upward.
 *
 * The sibling of `BitbagStage`, and the difference between them is only how he
 * occupies the page. The stage is for a site where bitbag IS the page and being
 * summoned is the joke; the dock is for the corner of a page about something
 * else, where he arrives already connected because a fixture that won't answer
 * until it has finished performing just reads as broken. Both drive the same
 * `BitbagChat` (see `BitbagVariant`), so his voice and reflexes can't fork.
 *
 * DELIBERATELY UNPOSITIONED: the column is a plain flex stack, so the host
 * decides where he parks (`position: fixed` on a marketing page, absolute
 * inside a footer bar) without fighting a position baked in here. What the dock
 * does own is that the column ignores the pointer while its children take their
 * own clicks — so it never eats a scroll or tap meant for the page behind it.
 */
export function BitbagDock({
  theme = DEFAULT_THEME,
  backend,
  size = 132,
  className,
}: BitbagDockProps) {
  // The wiring between his chat and his face: the chat reports how the
  // conversation is going and the avatar reacts. His expression follows the
  // chat's mood hints, his eyes follow the caret, and his idle chatter is muted
  // while he's working so the status line holds the thinking spinner, not his
  // asides.
  const [chatHint, setChatHint] = useState<BitbagExpression | null>(null)
  const [gaze, setGaze] = useState<GazeVector | null>(null)
  const [utterance, setUtterance] = useState<{ text: string; id: number } | null>(null)
  const [mute, setMute] = useState(false)
  // The avatar element the chat measures gaze against — his eyes track the caret
  // relative to this frame's horizontal centre.
  const bitbagRef = useRef<HTMLDivElement>(null)
  const utterId = useRef(0)

  const onHint = useCallback((hint: BitbagExpression | null) => setChatHint(hint), [])
  const onGaze = useCallback((g: GazeVector | null) => setGaze(g), [])
  const onMute = useCallback((m: boolean) => setMute(m), [])
  const onSpeak = useCallback((text: string) => {
    utterId.current += 1
    setUtterance({ text, id: utterId.current })
  }, [])

  const rootClass = ['bb-dock', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div ref={bitbagRef} className="bb-dock__avatar" style={{ width: size }}>
        <Bitbag expression={chatHint ?? undefined} gaze={gaze} onSpeak={onSpeak} mute={mute} />
      </div>
      <BitbagChat
        className="bb-dock__chat"
        variant="dock"
        theme={theme}
        backend={backend}
        anchorRef={bitbagRef}
        onExpressionHint={onHint}
        onGazeHint={onGaze}
        utterance={utterance}
        onMute={onMute}
      />
    </div>
  )
}
