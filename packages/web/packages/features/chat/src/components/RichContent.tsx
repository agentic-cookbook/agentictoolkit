'use client'

import { useState } from 'react'
import type { ContentItem } from '../types'

interface RichContentProps {
  items: ContentItem[]
}

function GatedImage({ src, alt }: { src: string; alt?: string }) {
  const [ready, setReady] = useState(false)
  const reveal = () => setReady(true)
  return (
    <img
      className="pc-content-image"
      src={src}
      alt={alt || ''}
      style={ready ? undefined : { display: 'none' }}
      onLoad={reveal}
      onError={reveal}
    />
  )
}

export function RichContent({ items }: RichContentProps) {
  return (
    <div className="pc-content">
      {items.map((item, i) => {
        if (item.type === 'link') {
          return (
            <a
              key={i}
              className="pc-content-link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.label || item.url}
            </a>
          )
        }
        if (item.type === 'image') {
          return <GatedImage key={i} src={item.src} alt={item.alt} />
        }
        return null
      })}
    </div>
  )
}
