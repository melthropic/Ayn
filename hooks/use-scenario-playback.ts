'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { HORIZON_HOURS } from '@/lib/ayn/model'

const PLAYBACK_SECONDS = 14
const REDUCED_STEP_HOURS = 6

export function useScenarioPlayback(reducedMotion: boolean) {
  const [hour, setHourState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const hourRef = useRef(0)

  const setHour = useCallback((h: number) => {
    const next = Math.min(HORIZON_HOURS, Math.max(0, h))
    hourRef.current = next
    setHourState(next)
    if (next > 0) setHasRun(true)
  }, [])

  useEffect(() => {
    if (!playing) return
    if (hourRef.current >= HORIZON_HOURS) setHour(0)

    if (reducedMotion) {
      const id = window.setInterval(() => {
        const next = hourRef.current + REDUCED_STEP_HOURS
        setHour(next)
        if (next >= HORIZON_HOURS) setPlaying(false)
      }, 900)
      return () => window.clearInterval(id)
    }

    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = hourRef.current + (dt * HORIZON_HOURS) / PLAYBACK_SECONDS
      setHour(next)
      if (next >= HORIZON_HOURS) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, reducedMotion, setHour])

  const toggle = useCallback(() => setPlaying((p) => !p), [])

  return { hour, setHour, playing, setPlaying, toggle, hasRun }
}
