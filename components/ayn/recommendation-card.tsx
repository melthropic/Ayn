import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CLEANING_LIMIT, formatHours, type PlantId, type Status, type TrainState } from '@/lib/ayn/model'
import { CrewNotify, type CrewProps } from './crew-notify'
import { statusBg } from './status-dot'

interface Props {
  level: Status
  topTrain: TrainState
  /** Name of the plant the bloom risk refers to (drives the watch headline). */
  riskPlant: string
  timeToCritical: number | null
  loading: boolean
  onOpenTrain: (id: string) => void
  /** Notify crew controls for the top train, when Telegram is set up. */
  crew?: CrewProps
}

const PLANT_NAME: Record<PlantId, string> = { A: 'Plant A', B: 'Plant B', C: 'Plant C' }

const TONE: Record<Status, { word: string; surface: string }> = {
  healthy: { word: 'No action', surface: 'bg-healthy/10' },
  watch: { word: 'Prepare', surface: 'bg-watch/10' },
  critical: { word: 'Act now', surface: 'bg-critical/10' },
}

function copyFor(level: Status, t: TrainState, riskPlant: string, ttc: number | null) {
  if (level === 'critical')
    return {
      headline:
        t.hoursToLimit <= 0
          ? `Clean ${t.id} now — it is at the ${CLEANING_LIMIT}% limit`
          : `Clean ${t.id} within ${formatHours(t.hoursToLimit)}`,
      actions: [
        `Take ${t.id} offline and start the clean in place cycle.`,
        `Raise coagulant dose at the ${PLANT_NAME[t.plant]} intake and shorten filter backwash intervals.`,
      ],
    }
  if (level === 'watch')
    return {
      headline: ttc ? `Bloom reaches ${riskPlant} in about ${Math.round(ttc)} h` : `Bloom is approaching ${riskPlant}`,
      actions: [
        `Book a cleaning crew for ${t.id} and stage chemicals.`,
        `Increase sampling of feed silt density at the ${PLANT_NAME[t.plant]} intake to every 2 hours.`,
      ],
    }
  return {
    headline: 'All intakes are within normal range',
    actions: ['Keep routine monitoring.', `Next planned clean is ${t.id}.`],
  }
}

export function RecommendationCard({ level, topTrain, riskPlant, timeToCritical, loading, onOpenTrain, crew }: Props) {
  const tone = TONE[level]
  const copy = copyFor(level, topTrain, riskPlant, timeToCritical)

  return (
    <section
      aria-labelledby="rec-heading"
      aria-live="polite"
      className={cn('rounded-xl border border-border p-5 transition-colors duration-500', tone.surface)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="rec-heading" className="text-sm text-muted-foreground">
          Recommendation
        </h2>
        <span
          key={level}
          className="ayn-pop inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-sm font-medium"
        >
          <span aria-hidden className="relative flex size-2">
            {level === 'critical' && (
              <span className={cn('ayn-pulse absolute inline-flex size-full rounded-full', statusBg[level])} />
            )}
            <span className={cn('relative inline-flex size-2 rounded-full', statusBg[level])} />
          </span>
          {tone.word}
        </span>
      </div>
      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : (
        <div key={level} className="ayn-swap">
          <p className="mt-3 text-xl font-semibold text-balance">{copy.headline}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            {copy.actions.map((a) => (
              <li key={a} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                <span className="text-pretty">{a}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {crew && <CrewNotify {...crew} />}
            <Button variant="outline" size="sm" className="bg-card" onClick={() => onOpenTrain(topTrain.id)}>
              {`Open train ${topTrain.id}`}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
