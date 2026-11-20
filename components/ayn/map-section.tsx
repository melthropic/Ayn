'use client'

import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { HORIZON_HOURS, formatClock } from '@/lib/ayn/model'
import { cn } from '@/lib/utils'
import { BloomMap } from './bloom-map'

interface Props {
  hour: number
  playing: boolean
  loading: boolean
  onToggle: () => void
  onReset: () => void
  onHourChange: (h: number) => void
  /** Present when Supabase live mode is configured. */
  live?: {
    connected: boolean
  }
}

export function MapSection({
  hour,
  playing,
  loading,
  onToggle,
  onReset,
  onHourChange,
  live,
}: Props) {
  const clock = formatClock(hour)
  const atEnd = hour >= HORIZON_HOURS

  return (
    <section aria-labelledby="map-heading" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 id="map-heading" className="text-lg font-semibold">
            Bloom forecast
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Chlorophyll drift toward seawater intakes over the next 72 hours
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Map legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-bloom" />
            Algal bloom
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t border-dashed border-bloom" />
            Forecast track
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-muted-foreground" />
            Intake risk ring
          </li>
        </ul>
      </div>

      <div className="aspect-[16/10] border-y border-border sm:aspect-[1000/460]">
        {loading ? (
          <Skeleton className="size-full rounded-none" />
        ) : (
          <div className="ayn-fade size-full">
            <BloomMap hour={hour} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:flex-nowrap sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            size="icon-lg"
            className="rounded-full"
            onClick={onToggle}
            disabled={loading}
            aria-label={playing ? 'Pause bloom scenario' : atEnd ? 'Replay bloom scenario' : 'Play bloom scenario'}
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onReset}
            disabled={loading || (hour === 0 && !playing)}
            aria-label="Reset to now"
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="order-last flex w-full flex-col gap-2 sm:order-none sm:flex-1">
          <Slider
            value={[hour]}
            min={0}
            max={HORIZON_HOURS}
            step={1}
            disabled={loading}
            onValueChange={(v) => onHourChange(Array.isArray(v) ? v[0] : v)}
            getAriaLabel={() => 'Forecast time, hours from now'}
            getAriaValueText={(_, v) => (v === 0 ? 'Now' : `${v} hours from now`)}
          />
          <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
            <span>Now</span>
            <span>+24 h</span>
            <span>+48 h</span>
            <span>+72 h</span>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-3 sm:ms-0">
          {live && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                live.connected ? 'border-healthy/40 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <span aria-hidden className="relative flex size-1.5">
                {live.connected && (
                  <span className="absolute inline-flex size-full animate-pulse rounded-full bg-healthy opacity-60" />
                )}
                <span
                  className={cn('relative inline-flex size-1.5 rounded-full', live.connected ? 'bg-healthy' : 'bg-watch')}
                />
              </span>
              {live.connected ? 'Live' : 'Connecting'}
            </span>
          )}
          <p className="min-w-40 text-end" aria-live="off">
            <span className="block text-lg font-semibold leading-tight">{clock.offset}</span>
            <span className="block text-sm text-muted-foreground">{clock.stamp}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
