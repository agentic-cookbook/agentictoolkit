'use client'

import type { TopicData } from './DetailPane'
import { ConnectorAnchor } from './connectors/ConnectorAnchor'

interface TopicsPaneProps {
  topics: TopicData[]
  activeIndex: number
  onSelectTopic: (index: number) => void
  visible: boolean
}

export function TopicsPane({
  topics,
  activeIndex,
  onSelectTopic,
  visible,
}: TopicsPaneProps) {
  return (
    <div
      className={`pc-topics-pane ${visible ? 'pc-pane-visible' : 'pc-pane-hidden'}`}
    >
      <div className="pc-panel-header">Topics</div>
      <ul className="pc-topic-list">
        {topics.map((topic, i) => (
          <li key={i}>
            <button
              className={`pc-topic-item ${i === activeIndex ? 'active' : ''}`}
              onClick={() => onSelectTopic(i)}
            >
              {topic.title}
              <ConnectorAnchor
                id={`topic-${topic.messageIndex}`}
                className="pc-connector-anchor-out"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
