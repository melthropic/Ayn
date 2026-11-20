'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { riskStatus, type Status, type fleetSummary } from '@/lib/ayn/model'
import { CountUp } from './count-up'
import { StatusDot } from './status-dot'

type Summary = ReturnType<typeof fleetSummary>

interface Kpi {
  label: string
  value: string
  /** When set, the value is drawn as a number that counts and eases between hours. */
  count?: number
  suffix?: string
  unit?: string
  status: Status
  note: string
}

function buildKpis(s: Summary): Kpi[] {
  const topStatus = riskStatus(s.topRisk.risk)
  const ttc = s.timeToCritical
  return [
    {
      label: 'Fleet health',
      value: `${s.fleetHealth}`,
      count: s.fleetHealth,
      unit: '/ 100',
      status: s.fleetStatus,
      note: 'Average across 12 trains',
    },
    {
      label: 'Highest intake risk',
      value: `${Math.round(s.topRisk.risk * 100)}%`,
      count: Math.round(s.topRisk.risk * 100),
      suffix: '%',
      status: topStatus,
      note: `${s.topRisk.plant.name}, ${s.topRisk.plant.location}`,
    },
    {
      label: 'Output at risk',
      value: `${s.outputAtRisk}`,
      count: s.outputAtRisk,
      unit: `of ${s.totalOutput} MIGD`,
      status: s.outputAtRisk === 0 ? 'healthy' : 'critical',
      note:
        s.trainsAtRisk === 0
          ? 'No train at its cleaning limit'
          : `${s.trainsAtRisk} ${s.trainsAtRisk === 1 ? 'train' : 'trains'} at the cleaning limit`,
    },
    {
      label: 'Time to critical risk',
      value: ttc === null ? 'Over 72' : ttc === 0 ? 'Now' : `${Math.round(ttc)}`,
      count: ttc === null || ttc === 0 ? undefined : Math.round(ttc),
      unit: ttc === 0 ? undefined : 'h',
      status: ttc === null ? 'healthy' : ttc <= 12 ? 'critical' : 'watch',
      note: ttc === 0 ? `${s.topRisk.plant.name} intake is critical` : `At ${s.topRisk.plant.name} intake`,
    },
  ]
}

export function KpiStrip({ summary, loading }: { summary: Summary; loading: boolean }) {
  const kpis = buildKpis(summary)
  return (
    <section aria-label="Key indicators" className="overflow-hidden rounded-xl border border-border bg-border">
      <dl className="grid grid-cols-2 gap-px lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-2 bg-card px-5 py-5">
            <dt className="text-sm text-muted-foreground">{k.label}</dt>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-36" />
              </>
            ) : (
              <>
                <dd className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">
                    {k.count === undefined ? k.value : <CountUp value={k.count} suffix={k.suffix} />}
                  </span>
                  {k.unit && <span className="text-sm text-muted-foreground">{k.unit}</span>}
                </dd>
                <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <StatusDot status={k.status} className="text-foreground" />
                  <span>{k.note}</span>
                </dd>
              </>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
