'use client'

import { forwardRef } from 'react'
import { DetailPane, type TopicData } from './DetailPane'

export interface PanelStackProps {
  topics: TopicData[]
  visibleTopicIndexes: number[]
  onImageLoad: () => void
}

export const PanelStack = forwardRef<HTMLDivElement, PanelStackProps>(
  function PanelStack({ topics, visibleTopicIndexes, onImageLoad }, ref) {
    return (
      <div className="pc-panel-stack" ref={ref}>
        {visibleTopicIndexes.map((idx) => {
          const t = topics[idx]
          if (!t) return null
          return (
            <DetailPane
              key={t.messageIndex}
              topic={t}
              visible
              onImageLoad={onImageLoad}
            />
          )
        })}
      </div>
    )
  },
)
