import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ConnectorRegistryProvider } from './connectors/ConnectorRegistry'
import { PanelStack } from './PanelStack'
import type { TopicData } from './DetailPane'

const topic = (i: number): TopicData => ({
  title: `t${i}`,
  description: '',
  links: [],
  images: [],
  messageIndex: i,
})

describe('PanelStack', () => {
  it('renders one panel per visible topic, in given order', () => {
    const topics = [topic(0), topic(1), topic(2)]
    const { container } = render(
      <ConnectorRegistryProvider>
        <PanelStack
          topics={topics}
          visibleTopicIndexes={[0, 2]}
          onImageLoad={() => {}}
        />
      </ConnectorRegistryProvider>,
    )
    const titles = Array.from(container.querySelectorAll('.pc-detail-title')).map(
      (el) => el.textContent,
    )
    expect(titles).toEqual(['t0', 't2'])
  })
})
