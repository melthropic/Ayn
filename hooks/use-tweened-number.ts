'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Eases a displayed number toward `target`. A new target mid-tween starts
 * from wherever the number currently is, so fast changes (scenario playback)
 * stay smooth. Starts from `from` on mount.
 */
export function useTweenedNumber(target: number, { from = target, duration = 600 } = {}) {
  const [value, setValue] = useState(from)
  const current = useRef(from)

  useEffect(() => {
    const start = current.current
    if (start === target) return
    const t0 = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = start + (target - start) * eased
      current.current = v
      setValue(v)
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
