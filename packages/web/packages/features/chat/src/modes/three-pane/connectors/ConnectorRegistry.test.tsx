import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import {
  ConnectorRegistryProvider,
  useConnectorRegistry,
} from './ConnectorRegistry'
import { ConnectorAnchor } from './ConnectorAnchor'

type Snapshot = ReturnType<ReturnType<typeof useConnectorRegistry>['snapshot']>

function Probe({ onReady }: { onReady: (snap: Snapshot) => void }) {
  const reg = useConnectorRegistry()
  useEffect(() => {
    onReady(reg.snapshot())
  }, [reg, onReady])
  return null
}

describe('ConnectorRegistry', () => {
  it('registers and unregisters anchors by id', () => {
    let snap: Snapshot | null = null
    const { unmount } = render(
      <ConnectorRegistryProvider>
        <ConnectorAnchor id="msg-0-out" />
        <ConnectorAnchor id="panel-0-in" />
        <Probe onReady={(s) => (snap = s)} />
      </ConnectorRegistryProvider>,
    )
    expect(snap).toBeTruthy()
    expect(snap!.has('msg-0-out')).toBe(true)
    expect(snap!.has('panel-0-in')).toBe(true)
    unmount()
  })
})
