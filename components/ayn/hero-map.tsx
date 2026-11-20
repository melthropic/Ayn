'use client'

import { useEffect, useState } from 'react'
import { HORIZON_HOURS, PLANTS, STATUS_LABEL, formatClock, plantRisk, riskStatus } from '@/lib/ayn/model'
import { cn } from '@/lib/utils'
import { BloomMap } from './bloom-map'
import { statusBg } from './status-dot'

const LOOP_SECONDS = 20
const HOLD_SECONDS = 1.5

/**
 * The bloom forecast on a loop: 72 hours of drift in about 20 seconds, a short
 * hold at the end, then the bloom fades out and starts again from now.
 */
export function HeroMap() {
  // Seconds into the current loop.
  const [t, setT] = useState(0)

  useEffect(() => {
    const period = LOOP_SECONDS + HOLD_SECONDS
    const t0 = performance.now()
    let frame = 0
    const tick = (now: number) => {
      setT(((now - t0) / 1000) % period)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Fade the bloom in over the first 3 h and out over the hold, so the restart
  // does not look like a jump.
  const hour = Math.min(HORIZON_HOURS, (t / LOOP_SECONDS) * HORIZON_HOURS)
  const fade = t > LOOP_SECONDS ? Math.max(0, 1 - (t - LOOP_SECONDS) / HOLD_SECONDS) : Math.min(1, hour / 3)
  const clock = formatClock(hour)
  const top = PLANTS.map((p) => ({ plant: p, risk: plantRisk(p, hour) })).reduce((a, b) => (b.risk > a.risk ? b : a))
  const status = riskStatus(top.risk)

  return (
    <figure className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
      <div className="aspect-[1000/460]">
        <BloomMap hour={hour} bloomFade={fade} />
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <span className="flex items-baseline gap-2">
          <span className="w-14 font-semibold tabular-nums">{clock.offset}</span>
          <span className="text-muted-foreground">Forecast replay</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span aria-hidden className={cn('size-2 rounded-full transition-colors duration-500', statusBg[status])} />
          <span className="text-foreground">{top.plant.name}</span>
          <span className="tabular-nums">{`${STATUS_LABEL[status]}, ${Math.round(top.risk * 100)}% risk`}</span>
        </span>
      </figcaption>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-border" aria-hidden>
        <div className="h-full bg-bloom" style={{ width: `${(hour / HORIZON_HOURS) * 100}%` }} />
      </div>
    </figure>
  )
}
