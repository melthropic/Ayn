'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  CLEANING_LIMIT,
  PLANTS,
  formatHours,
  trainForecast,
  trainMetrics,
  type TrainState,
} from '@/lib/ayn/model'
import { ForecastChart } from './forecast-chart'
import { StatusDot } from './status-dot'

interface Props {
  train: TrainState | null
  hour: number
  onClose: () => void
}

function advice(t: TrainState) {
  if (t.status === 'critical')
    return `${t.id} is at the ${CLEANING_LIMIT}% cleaning limit. Schedule a clean in place cycle now and move its load to the healthiest train at the same plant.`
  if (t.status === 'watch')
    return `${t.id} is fouling faster than normal as bloom water reaches the intake. Prepare chemicals and a crew so the clean can start within ${formatHours(t.hoursToLimit)}.`
  return `${t.id} is running within normal range. No cleaning is needed in the next 72 hours.`
}

export function TrainDrawer({ train, hour, onClose }: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const open = train !== null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="gap-0 overflow-y-auto border-border bg-card shadow-none data-[side=bottom]:max-h-[88dvh] data-[side=bottom]:rounded-t-xl data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {train && <DrawerBody train={train} hour={hour} />}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ train, hour }: { train: TrainState; hour: number }) {
  const plant = PLANTS.find((p) => p.id === train.plant)!
  const m = trainMetrics(train.id, hour)
  const metrics = [
    { label: 'Pressure drop above clean baseline', value: `${m.pressureDrop.toFixed(1)}%`, note: `Limit ${CLEANING_LIMIT}%` },
    { label: 'Health score', value: `${m.health}`, note: 'Out of 100' },
    { label: 'Feed pressure', value: `${m.feedPressure.toFixed(1)} bar` },
    { label: 'Permeate flow', value: `${Math.round(m.permeateFlow)} m³/h` },
    { label: 'Salt rejection', value: `${m.saltRejection.toFixed(2)}%` },
    { label: 'Energy use', value: `${m.energyUse.toFixed(2)} kWh/m³` },
    { label: 'Feed silt density index', value: m.sdi.toFixed(1), note: m.sdi > 4 ? 'Above 4, high' : 'Normal' },
    { label: 'Days since last clean', value: `${m.daysSinceClean}` },
  ]

  return (
    <>
      <SheetHeader className="gap-1 border-b border-border px-6 pt-6 pb-5">
        <SheetTitle className="text-2xl font-semibold">{`Train ${train.id}`}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{`${plant.name}, ${plant.location}`}</span>
          <StatusDot status={train.status} className="text-foreground" />
          <span>{`${formatHours(train.hoursToLimit)} to limit`}</span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-6 py-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {metrics.map((x) => (
            <div key={x.label} className="flex flex-col gap-1 bg-card p-3.5">
              <dt className="text-xs text-muted-foreground text-pretty">{x.label}</dt>
              <dd className="text-lg font-semibold">{x.value}</dd>
              {x.note && <dd className="text-xs text-muted-foreground">{x.note}</dd>}
            </div>
          ))}
        </dl>

        <section aria-labelledby="forecast-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="forecast-heading" className="font-semibold">
              Pressure drop forecast
            </h3>
            <ul className="flex gap-4 text-xs text-muted-foreground" aria-label="Chart legend">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-2 border-primary" />
                Median
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-4 rounded-sm bg-primary/20" />
                P10 to P90
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-2 border-dashed border-critical" />
                Limit
              </li>
            </ul>
          </div>
          <ForecastChart data={trainForecast(train.id)} hour={hour} />
        </section>

        <section aria-labelledby="advice-heading" className="rounded-lg bg-muted p-4">
          <h3 id="advice-heading" className="text-sm text-muted-foreground">
            Recommendation
          </h3>
          <p className="mt-1 text-pretty">{advice(train)}</p>
        </section>
      </div>
    </>
  )
}
