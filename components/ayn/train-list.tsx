'use client'

import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useFlipList } from '@/hooks/use-flip-list'
import { cn } from '@/lib/utils'
import { CLEANING_LIMIT, PLANTS, formatHours, type TrainState } from '@/lib/ayn/model'
import { StatusDot, statusBg } from './status-dot'

interface Props {
  trains: TrainState[]
  loading: boolean
  onSelect: (id: string) => void
}

const COLS = 'md:grid-cols-[2rem_minmax(7rem,1fr)_minmax(7rem,1.2fr)_7rem_5.5rem_6rem_1rem]'

export function HealthBar({ value, status }: { value: number; status: TrainState['status'] }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn('h-full rounded-full transition-[width,background-color] duration-500', statusBg[status])}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export function TrainList({ trains, loading, onSelect }: Props) {
  const order = trains.map((t) => t.id).join(',')
  const listRef = useFlipList<HTMLOListElement>(order)

  return (
    <section aria-labelledby="trains-heading" className="rounded-xl border border-border bg-card">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <h2 id="trains-heading" className="text-lg font-semibold">
          Trains to clean first
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          {`Ranked by hours until pressure drop reaches the ${CLEANING_LIMIT}% cleaning limit`}
        </p>
      </div>

      <div
        className={cn(
          'hidden gap-4 border-y border-border px-6 py-2.5 text-sm text-muted-foreground md:grid',
          COLS,
        )}
        aria-hidden
      >
        <span>Rank</span>
        <span>Train</span>
        <span>Health</span>
        <span>Pressure drop</span>
        <span>To limit</span>
        <span>Status</span>
        <span />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ol ref={listRef} className="ayn-fade divide-y divide-border border-t border-border md:border-t-0">
          {trains.map((t, i) => {
            const plant = PLANTS.find((p) => p.id === t.plant)!
            return (
              <li key={t.id} data-flip-key={t.id} className="relative bg-card">
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-label={`Train ${t.id}, ${plant.name}. Health ${t.health}. Pressure drop ${t.pressureDrop.toFixed(1)} percent of ${CLEANING_LIMIT}. ${formatHours(t.hoursToLimit)} to limit. Open details`}
                  className={cn(
                    'grid w-full grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 text-start transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-offset-[-2px] sm:px-6 md:grid',
                    COLS,
                  )}
                >
                  <span className="text-sm text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.id}</span>
                    <span className="block truncate text-sm text-muted-foreground">{plant.name}</span>
                  </span>
                  <span className="col-start-2 row-start-2 flex items-center gap-3 md:col-start-auto md:row-start-auto">
                    <HealthBar value={t.health} status={t.status} />
                    <span className="w-7 shrink-0 text-end text-sm">{t.health}</span>
                  </span>
                  <span className="hidden text-sm md:block">
                    {t.pressureDrop.toFixed(1)}%<span className="text-muted-foreground">{` of ${CLEANING_LIMIT}%`}</span>
                  </span>
                  <span className="hidden text-sm md:block">{formatHours(t.hoursToLimit)}</span>
                  <span className="col-start-3 row-start-1 flex flex-col items-end gap-0.5 md:col-start-auto md:row-start-auto md:items-start">
                    <StatusDot status={t.status} pulse={t.status === 'critical'} />
                    <span className="text-xs text-muted-foreground md:hidden">
                      {`${formatHours(t.hoursToLimit)} to limit`}
                    </span>
                  </span>
                  <ChevronRight className="hidden size-4 text-muted-foreground md:block rtl:rotate-180" aria-hidden />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
