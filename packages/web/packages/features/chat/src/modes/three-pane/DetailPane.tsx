'use client'

import { forwardRef } from 'react'
import { ConnectorAnchor } from './connectors/ConnectorAnchor'

export interface TopicData {
  title: string
  description: string
  links: Array<{ label: string; url: string }>
  images: Array<{ src: string; alt?: string }>
  messageIndex: number
}

interface DetailPaneProps {
  topic: TopicData | null
  visible: boolean
  onImageLoad?: () => void
}

export const DetailPane = forwardRef<HTMLDivElement, DetailPaneProps>(
  function DetailPane({ topic, visible, onImageLoad }, ref) {
    return (
      <div
        ref={ref}
        className={`pc-detail-pane ${visible ? 'pc-pane-visible' : 'pc-pane-hidden'}`}
      >
        <div className="pc-panel-header">Details</div>
        <div className="pc-detail-content">
          {topic && (
            <>
              <div className="pc-detail-title">
                <ConnectorAnchor
                  id={`panel-${topic.messageIndex}-in`}
                  className="pc-connector-anchor-in"
                />
                {topic.title}
              </div>
              {topic.description && (
                <div className="pc-detail-desc">{topic.description}</div>
              )}
              {topic.images.length > 0 && (
                <div className="pc-detail-images">
                  {topic.images.map((img, i) => (
                    <img
                      key={i}
                      className="pc-detail-image"
                      src={img.src}
                      alt={img.alt || ''}
                      onLoad={onImageLoad}
                    />
                  ))}
                </div>
              )}
              {topic.links.length > 0 && (
                <>
                  <div className="pc-detail-links-label">Links</div>
                  <div className="pc-detail-links">
                    {topic.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label || link.url}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
)
