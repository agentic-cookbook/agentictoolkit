'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useConnectorRegistry, useRegistrySnapshot } from './connectors/ConnectorRegistry'

export interface ConnectorPair {
  from: string
  to: string
}

export interface ConnectorSVGProps {
  frameRef: RefObject<HTMLDivElement | null>
  pairs: ConnectorPair[]
}

interface Geom {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

export function ConnectorSVG({ frameRef, pairs }: ConnectorSVGProps) {
  const reg = useConnectorRegistry()
  const snap = useRegistrySnapshot()
  const [geoms, setGeoms] = useState<Geom[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const compute = () => {
      const fb = frame.getBoundingClientRect()
      const out: Geom[] = []
      for (const p of pairs) {
        const a = snap.get(p.from)
        const b = snap.get(p.to)
        if (!a || !b) continue
        const ar = a.getBoundingClientRect()
        const br = b.getBoundingClientRect()
        const color = getComputedStyle(a).color
        out.push({
          x1: ar.left + ar.width / 2 - fb.left,
          y1: ar.top + ar.height / 2 - fb.top,
          x2: br.left + br.width / 2 - fb.left,
          y2: br.top + br.height / 2 - fb.top,
          color,
        })
      }
      setGeoms(out)
    }

    const schedule = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        compute()
      })
    }

    const ro = new ResizeObserver(schedule)
    ro.observe(frame)
    for (const id of snap.ids()) {
      const el = snap.get(id)
      if (el) ro.observe(el)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)

    compute()

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [pairs, snap, frameRef, reg])

  return (
    <svg className="pc-connector-svg" aria-hidden="true">
      {geoms.map((g, i) => (
        <g key={i}>
          <line
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            stroke={g.color}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <circle cx={g.x1} cy={g.y1} r={3} fill={g.color} fillOpacity={0.4} />
          <circle cx={g.x2} cy={g.y2} r={3} fill={g.color} fillOpacity={0.4} />
        </g>
      ))}
    </svg>
  )
}
