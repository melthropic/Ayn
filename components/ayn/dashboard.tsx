'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-media-query'
import { useScenarioPlayback } from '@/hooks/use-scenario-playback'
import { fleetSummary, rankedTrains, riskStatus } from '@/lib/ayn/model'
import { cn } from '@/lib/utils'
import { useLiveData } from '@/lib/ayn/use-live-data'
import { AlertFeed } from './alert-feed'
import { AskPanel } from './ask-panel'
import { DataSources } from './data-sources'
import { KpiStrip } from './kpi-strip'
import { MapSection } from './map-section'
import { PageHeader } from './page-header'
import { PlantView } from './plant-view'
import { RecommendationCard } from './recommendation-card'
import { TrainDrawer } from './train-drawer'
import { TrainList } from './train-list'

/** Wraps a dashboard block so it rises into place, `delay` ms after load. */
function Rise({ delay, className, children }: { delay: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('ayn-rise', className)} style={{ '--ayn-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  )
}

export function Dashboard() {
  const reducedMotion = useReducedMotion()
  const { hour, setHour, playing, setPlaying, toggle, hasRun } = useScenarioPlayback(reducedMotion)
  const live = useLiveData()
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The shared clock: whatever Supabase says, unless this device is the one
  // moving it. Once someone touches the timeline, this device publishes.
  const driving = useRef(false)

  useEffect(() => {
    if (live.hour === null) return
    setHour(live.hour)
  }, [live.hour, setHour])

  useEffect(() => {
    if (!driving.current) return
    live.writeHour(hour)
  }, [hour, live.writeHour])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  const trains = rankedTrains(hour)
  const summary = fleetSummary(hour)
  const level = riskStatus(summary.topRisk.risk)
  const selected = trains.find((t) => t.id === selectedId) ?? null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <Rise delay={0}>
        <PageHeader live={{ enabled: live.enabled, connected: live.connected }} />
      </Rise>
      <main className="flex flex-col gap-6">
        <Rise delay={80}>
          <MapSection
            hour={hour}
            playing={playing}
            loading={loading}
            onToggle={() => {
              driving.current = true
              toggle()
            }}
            onReset={() => {
              driving.current = true
              setPlaying(false)
              setHour(0)
            }}
            onHourChange={(h) => {
              driving.current = true
              setPlaying(false)
              setHour(h)
            }}
            live={live.enabled ? { connected: live.connected } : undefined}
          />
        </Rise>
        <Rise delay={160}>
          <KpiStrip summary={summary} loading={loading} />
        </Rise>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Rise delay={240}>
              <TrainList trains={trains} loading={loading} reducedMotion={reducedMotion} onSelect={setSelectedId} />
            </Rise>
            <Rise delay={400} className="hidden lg:block">
              <PlantView trains={trains} hour={hour} onSelect={setSelectedId} />
            </Rise>
          </div>
          <div className="flex flex-col gap-6">
            <Rise delay={240}>
              <RecommendationCard
                level={level}
                topTrain={trains[0]}
                riskPlant={summary.topRisk.plant.name}
                timeToCritical={summary.timeToCritical}
                loading={loading}
                onOpenTrain={setSelectedId}
              />
            </Rise>
            <Rise delay={320}>
              <AskPanel hour={hour} />
            </Rise>
            <Rise delay={400}>
              <AlertFeed hour={hour} hasRun={hasRun} loading={loading} />
            </Rise>
            <Rise delay={480}>
              <DataSources />
            </Rise>
            <Rise delay={480} className="lg:hidden">
              <PlantView trains={trains} hour={hour} onSelect={setSelectedId} />
            </Rise>
          </div>
        </div>
      </main>
      <TrainDrawer train={selected} hour={hour} onClose={() => setSelectedId(null)} />
    </div>
  )
}
