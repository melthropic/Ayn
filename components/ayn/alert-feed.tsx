import { BellOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ALERT_EVENTS } from '@/lib/ayn/model'
import { StatusDot } from './status-dot'

export function AlertFeed({ hour, hasRun, loading }: { hour: number; hasRun: boolean; loading: boolean }) {
  const alerts = hasRun ? ALERT_EVENTS.filter((a) => a.hour <= hour).reverse() : []

  return (
    <section aria-labelledby="alerts-heading" className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id="alerts-heading" className="text-lg font-semibold">
          Alerts
        </h2>
        {alerts.length > 0 && <span className="text-sm text-muted-foreground">{`${alerts.length} active`}</span>}
      </div>
      {loading ? (
        <div className="flex flex-col gap-3 px-5 pb-5">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 pt-4 pb-8 text-center">
          <BellOff className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground text-pretty">No alerts yet. Press play to run the bloom scenario.</p>
        </div>
      ) : (
        <ol className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto border-t border-border" aria-live="polite">
          {alerts.map((a) => (
            <li key={a.hour} className="flex flex-col gap-1 px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <StatusDot status={a.status} className="font-medium" />
                <span className="text-sm text-muted-foreground">{`+${a.hour} h`}</span>
              </div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground text-pretty">{a.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
