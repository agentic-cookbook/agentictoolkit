import type { ReactNode } from 'react'

export interface ContentOverlayProps {
  open: boolean
  onClose: () => void
  closeLabel?: string
  children: ReactNode
  className?: string
}

export function ContentOverlay({
  open,
  onClose,
  closeLabel = '← back',
  children,
  className,
}: ContentOverlayProps) {
  return (
    <div
      className={`pc-content-overlay${open ? ' open' : ''}${className ? ' ' + className : ''}`}
    >
      <div className="pc-content-overlay-header">
        <button className="pc-content-overlay-close" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div className="pc-content-overlay-body">{children}</div>
    </div>
  )
}
