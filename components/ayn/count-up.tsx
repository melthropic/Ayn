'use client'

import { useEffect, useRef, useState } from 'react'
import { useTweenedNumber } from '@/hooks/use-tweened-number'

/**
 * A whole number that counts up from `from` and eases to new values. With
 * `onView`, the count waits until the number scrolls into view.
 */
export function CountUp({
  value,
  from = 0,
  duration,
  suffix = '',
  onView = false,
}: {
  value: number
  from?: number
  duration?: number
  suffix?: string
  onView?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(!onView)

  useEffect(() => {
    if (!onView) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [onView])

  const shown = useTweenedNumber(visible ? value : from, { from, duration })
  return (
    <span ref={ref}>
      {Math.round(shown)}
      {suffix}
    </span>
  )
}
