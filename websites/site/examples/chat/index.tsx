'use client'

import { useEffect, useRef, useState } from 'react'
import { ExamplePanel } from '../../src/ExamplePanel'
import {
  InlineChatView,
  ThreePaneChatView,
  MobileChatView,
  ContentOverlay,
  MockBackend,
  useChatSession,
  type InlineChatSizing,
} from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/base.css'
import '@agentic-toolkit/chat/css/modes/inline.css'
import '@agentic-toolkit/chat/css/modes/three-pane.css'
import '@agentic-toolkit/chat/css/modes/mobile.css'
import '@agentic-toolkit/chat/css/components/content-overlay.css'

import backgroundImage from './shih_tzu.webp'

export const meta = { id: 'chat', label: 'Chat' }

type Mode = 'inline' | 'three-pane' | 'mobile'
type SizingKind = 'fixed' | 'hug-css' | 'hug-viewport' | 'hug-element'
type Horizontal = 'left' | 'center' | 'right'
type Vertical = 'top' | 'center' | 'bottom'
type Padding = { top: number; right: number; bottom: number; left: number }
type SizeBounds = { minW: number; maxW: number; minH: number; maxH: number }

const SIDEBAR_WIDTH = 240
const DEFAULT_PADDING: Padding = { top: 16, right: 32, bottom: 16, left: 32 }
const DEFAULT_SIZE: SizeBounds = { minW: 240, maxW: 600, minH: 200, maxH: 800 }

const backend = new MockBackend()

const persona = { name: 'Claire', avatar: 'C' }
const welcome = "Hello! I'm Claire, your research assistant. How can I help you today?"

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: '0 0 0.5rem',
  color: 'var(--color-text-secondary, rgba(0,0,0,0.55))',
}

const subLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  opacity: 0.65,
  margin: '0.25rem 0 0.15rem',
}

const optionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  padding: '4px 4px',
  cursor: 'pointer',
}

const numberInputStyle: React.CSSProperties = {
  width: 64,
  padding: '2px 6px',
  background: 'transparent',
  border: '1px solid var(--color-border, rgba(0,0,0,0.2))',
  borderRadius: 3,
  color: 'inherit',
  fontSize: '0.85rem',
}

export default function ChatExample() {
  const [mode, setMode] = useState<Mode>('inline')
  const [sizingKind, setSizingKind] = useState<SizingKind>('fixed')
  const [showBackground, setShowBackground] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [horizontal, setHorizontal] = useState<Horizontal>('center')
  const [vertical, setVertical] = useState<Vertical>('bottom')
  const [padding, setPadding] = useState<Padding>(DEFAULT_PADDING)
  const [size, setSize] = useState<SizeBounds>(DEFAULT_SIZE)

  const headerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = backgroundImage.src
  }, [])

  const sizing: InlineChatSizing | undefined =
    sizingKind === 'fixed'
      ? undefined
      : sizingKind === 'hug-css'
        ? { mode: 'content-hugging', maxHeight: { kind: 'css', value: '400px' } }
        : sizingKind === 'hug-viewport'
          ? { mode: 'content-hugging', maxHeight: { kind: 'viewport-offset', topOffsetPx: 80 } }
          : { mode: 'content-hugging', maxHeight: { kind: 'element-offset', ref: headerRef, gapPx: 16 } }

  const session = useChatSession({
    backend,
    persona,
    user: { name: 'You', avatar: 'Y' },
    welcomeMessage: welcome,
  })

  const hRule =
    horizontal === 'left' ? `left: 0; right: auto;`
      : horizontal === 'right' ? `right: 0; left: auto;`
        : `left: 50%; right: auto;`
  const vRule =
    vertical === 'top' ? `top: 0; bottom: auto;`
      : vertical === 'bottom' ? `bottom: 0; top: auto;`
        : `top: 50%; bottom: auto;`
  const tx = horizontal === 'center' ? '-50%' : '0'
  const ty = vertical === 'center' ? '-50%' : '0'
  const transformRule = tx === '0' && ty === '0' ? 'transform: none;' : `transform: translate(${tx}, ${ty});`
  const sizeRule = `min-width: ${size.minW}px; max-width: ${size.maxW}px; min-height: ${size.minH}px; max-height: ${size.maxH}px;`
  const layoutOverrides = `
    .pc-inline,
    .pc-three-pane-frame { position: absolute !important; ${hRule} ${vRule} ${transformRule} ${sizeRule} }
  `

  const patternColor = 'var(--color-pattern, rgba(0,0,0,0.07))'
  const mainBackground = showBackground
    ? `radial-gradient(circle, ${patternColor} 1.5px, transparent 1.5px), url(${backgroundImage.src})`
    : `radial-gradient(circle, ${patternColor} 1.5px, transparent 1.5px)`
  const mainBackgroundSize = showBackground ? '24px 24px, cover' : '24px 24px'
  const mainBackgroundPosition = showBackground ? '0 0, center' : '0 0'
  const mainBackgroundRepeat = showBackground ? 'repeat, no-repeat' : 'repeat'

  return (
    <ExamplePanel>
      <style>{`
        .pc-mobile-overlay { position: absolute !important; left: ${SIDEBAR_WIDTH}px !important; top: 0; right: 0; bottom: 0; }
        .pc-content-overlay { position: absolute !important; left: ${SIDEBAR_WIDTH}px !important; top: 0; right: 0; bottom: 0; }
        ${layoutOverrides}
      `}</style>

      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          padding: '1.25rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          overflowY: 'auto',
          zIndex: 200,
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <section>
          <label style={optionRowStyle}>
            <input
              type="checkbox"
              checked={showBackground}
              onChange={(e) => setShowBackground(e.target.checked)}
            />
            background image
          </label>
          <label style={optionRowStyle}>
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            transparent chat
          </label>
        </section>

        <section>
          <h3 style={sectionHeaderStyle}>Mode</h3>
          <label style={optionRowStyle}>
            <input
              type="checkbox"
              checked={mode === 'three-pane'}
              onChange={(e) => setMode(e.target.checked ? 'three-pane' : 'inline')}
            />
            three pane
          </label>
          <label style={optionRowStyle}>
            <input
              type="checkbox"
              checked={mode === 'mobile'}
              onChange={(e) => setMode(e.target.checked ? 'mobile' : 'inline')}
            />
            mobile overlay
          </label>
          <label style={optionRowStyle}>
            <input
              type="checkbox"
              checked={overlayOpen}
              onChange={(e) => setOverlayOpen(e.target.checked)}
            />
            content overlay
          </label>
        </section>

        <section>
          <h3 style={sectionHeaderStyle}>Sizing behavior</h3>
          <label style={optionRowStyle}>
            <input type="radio" name="sizing" checked={sizingKind === 'fixed'} onChange={() => setSizingKind('fixed')} />
            fixed
          </label>
          <label style={optionRowStyle}>
            <input type="radio" name="sizing" checked={sizingKind === 'hug-css'} onChange={() => setSizingKind('hug-css')} />
            hug + 400px
          </label>
          <label style={optionRowStyle}>
            <input type="radio" name="sizing" checked={sizingKind === 'hug-viewport'} onChange={() => setSizingKind('hug-viewport')} />
            hug + viewport(80)
          </label>
          <label style={optionRowStyle}>
            <input type="radio" name="sizing" checked={sizingKind === 'hug-element'} onChange={() => setSizingKind('hug-element')} />
            hug + element(header)
          </label>
        </section>

        <section>
          <h3 style={sectionHeaderStyle}>Layout</h3>
          <div style={subLabelStyle}>horizontal</div>
          {(['left', 'center', 'right'] as Horizontal[]).map((h) => (
            <label key={h} style={optionRowStyle}>
              <input type="radio" name="horizontal" checked={horizontal === h} onChange={() => setHorizontal(h)} />
              {h}
            </label>
          ))}
          <div style={{ ...subLabelStyle, marginTop: '0.5rem' }}>vertical</div>
          {(['top', 'center', 'bottom'] as Vertical[]).map((v) => (
            <label key={v} style={optionRowStyle}>
              <input type="radio" name="vertical" checked={vertical === v} onChange={() => setVertical(v)} />
              {v}
            </label>
          ))}
        </section>

        <section>
          <h3 style={sectionHeaderStyle}>Size</h3>
          {([
            ['minW', 'min width'],
            ['maxW', 'max width'],
            ['minH', 'min height'],
            ['maxH', 'max height'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ ...optionRowStyle, justifyContent: 'space-between' }}>
              <span>{label}</span>
              <input
                type="number"
                value={size[key]}
                onChange={(e) => setSize({ ...size, [key]: Number(e.target.value) || 0 })}
                style={numberInputStyle}
              />
            </label>
          ))}
        </section>

        <section>
          <h3 style={sectionHeaderStyle}>Padding</h3>
          {(['top', 'right', 'bottom', 'left'] as (keyof Padding)[]).map((side) => (
            <label key={side} style={{ ...optionRowStyle, justifyContent: 'space-between' }}>
              <span>{side}</span>
              <input
                type="number"
                value={padding[side]}
                onChange={(e) => setPadding({ ...padding, [side]: Number(e.target.value) || 0 })}
                style={numberInputStyle}
              />
            </label>
          ))}
        </section>
      </nav>

      <main
        className="awt-example-content"
        style={{
          position: 'absolute',
          top: 0,
          left: SIDEBAR_WIDTH,
          right: 0,
          bottom: 0,
          backgroundImage: mainBackground,
          backgroundSize: mainBackgroundSize,
          backgroundPosition: mainBackgroundPosition,
          backgroundRepeat: mainBackgroundRepeat,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
        }}
      >
        <header
          ref={headerRef}
          style={{
            padding: '1.25rem 1.5rem',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          Sizing demo — anchor for the &quot;hug + element(header)&quot; mode. Pick a theme from the rail on the left to restyle every example at once.
        </header>

        <div
          style={{
            position: 'absolute',
            top: padding.top,
            right: padding.right,
            bottom: padding.bottom,
            left: padding.left,
            pointerEvents: 'none',
          }}
        >
          {mode === 'inline' && (
            <div className="pc-inline" style={{ pointerEvents: 'auto' }}>
              <InlineChatView
                session={session}
                sizing={sizing}
                className={transparent ? 'pc-transparent' : ''}
              />
            </div>
          )}

          {mode === 'three-pane' && (
            <div style={{ pointerEvents: 'auto', position: 'absolute', inset: 0 }}>
              <ThreePaneChatView
                session={session}
                className={transparent ? 'pc-transparent' : ''}
              />
            </div>
          )}
        </div>

        {mode === 'mobile' && (
          <MobileChatView session={session} open onClose={() => setMode('inline')} />
        )}

        <ContentOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)}>
          <div style={{ flex: 1, minHeight: 0 }} />
        </ContentOverlay>
      </main>
    </ExamplePanel>
  )
}
