'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  InlineChatView,
  useBlockCursor,
  useCaretGaze,
  useChatSession,
  useConnectRitual,
  useInputFocusReclaim,
  usePersonaMood,
  useRotatingPhrase,
  useTransientEcho,
  type GazeVector,
} from '@agenticdevelopertoolkit/chat'
import { ThemeStyle, type ThemeKey } from '@agenticdevelopertoolkit/themes'
import { BitbagBackend } from './backend'
import type { BitbagExpression } from './avatar'
import {
  CONNECTED,
  CONNECTING,
  DISABLED_PLACEHOLDER,
  GREETING,
  IDLE_WORDS,
  NEGOTIATION,
  PLACEHOLDERS,
  SUMMON_SEQUENCE,
  TERMINAL_THEME,
  THINKING_GLYPH,
  THINKING_GLYPH_DONE,
  THINKING_WORDS,
  WELCOME,
} from './voice'

const PERSONA = { name: 'bitbag' }

/** While a reply is in flight he cycles engaged moods so he reads as pondering. */
const FLIGHT_MOODS: readonly BitbagExpression[] = ['thinking', 'inquisitive', 'excited']
/** While the user composes he rotates through curious / interested. */
const TYPING_MOODS: readonly BitbagExpression[] = ['inquisitive', 'excited']
/** The satisfied beat when a reply lands, then back to his reflexes. */
const ANSWER_BEAT = { mood: 'smug' as const, ms: 2200 }
/** He holds his random utterances for this long after first connecting. */
const QUIET_START_MS = 30000

// The chat's visual skin comes entirely from the toolkit theme applied here,
// scoped to this wrapper so switching it never touches the rest of the page.
const THEME_SCOPE = 'pc-theme-scope'

export interface BitbagChatProps {
  /** The toolkit theme that skins the chat. */
  theme: ThemeKey
  /** Reports a deliberate expression hint up to the driver; null hands control back to his reflexes. */
  onExpressionHint?: (hint: BitbagExpression | null) => void
  /** Reports where bitbag should look; null hands his gaze back to his reflexes. */
  onGazeHint?: (gaze: GazeVector | null) => void
  /** bitbag's latest utterance, echoed transiently in the idle status line. */
  utterance?: { text: string; id: number } | null
  /** Reports when bitbag should be muted, so the status holds the spinner, not his chatter. */
  onMute?: (mute: boolean) => void
  /** Caps the chat's height at this element's bottom (plus a gap) so it never rises over him. */
  anchorRef?: RefObject<HTMLElement | null>
}

export function BitbagChat({
  theme,
  onExpressionHint,
  onGazeHint,
  utterance,
  onMute,
  anchorRef,
}: BitbagChatProps) {
  const backend = useMemo(() => new BitbagBackend(), [])
  const wrapperRef = useRef<HTMLDivElement>(null)
  // No welcome message — the connect ritual types it in instead.
  const session = useChatSession({ backend, persona: PERSONA })

  const { inputDisabled, connected, statusLine } = useConnectRitual({
    say: session.say,
    welcome: WELCOME,
    greeting: GREETING,
    waitLines: SUMMON_SEQUENCE,
    stallLines: NEGOTIATION,
    connectingLine: CONNECTING,
    connectedLine: CONNECTED,
  })

  // He's "responding" both while awaiting the reply AND while it streams out.
  const streaming = session.messages.some((m) => m.isStreaming)
  const responding = session.isTyping || streaming

  // Detect the user composing.
  const [userTyping, setUserTyping] = useState(false)
  useEffect(() => {
    const input = wrapperRef.current?.querySelector<HTMLInputElement>('.pc-input')
    if (!input) return
    const onInput = () => setUserTyping(input.value.trim().length > 0)
    const onBlur = () => setUserTyping(false)
    input.addEventListener('input', onInput)
    input.addEventListener('blur', onBlur)
    return () => {
      input.removeEventListener('input', onInput)
      input.removeEventListener('blur', onBlur)
    }
  }, [])
  // Once a reply is in flight the message has been sent — drop "typing".
  useEffect(() => {
    if (session.isTyping) setUserTyping(false)
  }, [session.isTyping])

  useInputFocusReclaim(wrapperRef, !inputDisabled)

  const sentCount = session.messages.reduce((n, m) => n + (m.isPersona ? 0 : 1), 0)
  const placeholder = useRotatingPhrase(PLACEHOLDERS, sentCount)
  const { echo, idleIndex } = useTransientEcho(utterance)
  const idleWord = useRotatingPhrase(IDLE_WORDS, idleIndex)

  const { mood, beat } = usePersonaMood<BitbagExpression>({
    responding,
    composing: userTyping,
    flightMoods: FLIGHT_MOODS,
    typingMoods: TYPING_MOODS,
    answerBeat: ANSWER_BEAT,
  })
  useEffect(() => {
    onExpressionHint?.(mood)
  }, [mood, onExpressionHint])

  // Hold his random utterances until well after he connects.
  const [quietStart, setQuietStart] = useState(true)
  useEffect(() => {
    if (!connected) return
    const id = setTimeout(() => setQuietStart(false), QUIET_START_MS)
    return () => clearTimeout(id)
  }, [connected])
  useEffect(() => {
    onMute?.(responding || beat || inputDisabled || quietStart)
  }, [responding, beat, inputDisabled, quietStart, onMute])

  useCaretGaze(wrapperRef, anchorRef, (g) => onGazeHint?.(g))
  const caretBox = useBlockCursor(wrapperRef, theme === TERMINAL_THEME, sentCount)

  return (
    <div ref={wrapperRef} className={THEME_SCOPE}>
      <ThemeStyle theme={theme} scope={`.${THEME_SCOPE}`} />
      <InlineChatView
        session={session}
        placeholder={inputDisabled ? DISABLED_PLACEHOLDER : placeholder}
        thinkingLabels={THINKING_WORDS}
        thinkingFrames={THINKING_GLYPH}
        thinkingDoneGlyph={THINKING_GLYPH_DONE}
        thinkingColorful
        statusWhileStreaming={!inputDisabled}
        idlePhrase={inputDisabled ? undefined : `waiting to ${idleWord}`}
        statusUtterance={inputDisabled ? statusLine : echo}
        inputDisabled={inputDisabled}
        fadeOlder
        sizing={{
          active: {
            mode: 'content-hugging',
            maxHeight: anchorRef
              ? { kind: 'element-offset', ref: anchorRef, gapPx: 24 }
              : { kind: 'viewport-offset', topOffsetPx: 80 },
          },
        }}
      />
      {/* Block cursor. left/top/width/height are viewport coords from
          caretMetrics — position:fixed (set in the theme CSS) resolves them
          against the viewport. */}
      {caretBox && (
        <span
          className="pc-input-caret"
          aria-hidden="true"
          style={{
            left: caretBox.x,
            top: caretBox.top,
            width: caretBox.width,
            height: caretBox.height,
          }}
        />
      )}
    </div>
  )
}
