'use client'

import { useLayoutEffect, useRef } from 'react'

// FLIP animation: when the order of keyed children changes, slide each row
// from its previous position to its new one.
export function useFlipList<T extends HTMLElement>(orderKey: string, disabled: boolean) {
  const containerRef = useRef<T>(null)
  const positions = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-key]'))
    const next = new Map<string, number>()

    for (const row of rows) {
      const key = row.dataset.flipKey!
      const top = row.getBoundingClientRect().top
      next.set(key, top)
      const prev = positions.current.get(key)
      if (disabled || prev === undefined) continue
      const delta = prev - top
      if (Math.abs(delta) < 1) continue
      row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration: 420,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      })
    }
    positions.current = next
  }, [orderKey, disabled])

  return containerRef
}
