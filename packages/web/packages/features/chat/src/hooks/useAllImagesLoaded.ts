import { useEffect, useState } from 'react'
import type { ContentItem } from '../types'

export function useAllImagesLoaded(content?: ContentItem[]): boolean {
  const imageSrcs = (content ?? [])
    .filter((c): c is { type: 'image'; src: string } => c.type === 'image')
    .map((c) => c.src)
  const key = imageSrcs.join('|')
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (imageSrcs.length === 0) {
      setLoaded({})
      return
    }
    setLoaded({})
    const cancelled = { current: false }
    imageSrcs.forEach((src) => {
      const img = new Image()
      const mark = () => {
        if (cancelled.current) return
        setLoaded((p) => ({ ...p, [src]: true }))
      }
      img.onload = mark
      img.onerror = mark
      img.src = src
    })
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return imageSrcs.every((s) => loaded[s])
}
