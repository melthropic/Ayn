'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PLANTS, type PlantId, type TrainState } from '@/lib/ayn/model'
import { Plant3D } from './plant-3d'
import { StatusDot, statusBg } from './status-dot'

interface Props {
  trains: TrainState[]
  hour: number
  onSelect: (id: string) => void
}

export function PlantView({ trains, hour, onSelect }: Props) {
  const [plantId, setPlantId] = useState<PlantId>('A')
  const plant = PLANTS.find((p) => p.id === plantId)!
  const plantTrains = trains.filter((t) => t.plant === plantId).sort((a, b) => a.id.localeCompare(b.id))

  return (
    <section aria-labelledby="plant-heading" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div>
          <h2 id="plant-heading" className="text-lg font-semibold">
            Plant view
          </h2>
          <p className="text-sm text-muted-foreground">{`${plant.name}, ${plant.location}`}</p>
        </div>
        <Tabs value={plantId} onValueChange={(v) => setPlantId(v as PlantId)}>
          <TabsList aria-label="Choose plant">
            {PLANTS.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="px-3">
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-5 sm:px-6">
        <Plant3D plantId={plantId} hour={hour} onSelect={onSelect} />
        <p className="mt-2 text-xs text-muted-foreground text-pretty">
          Click a vessel to open its readings. Intake screens, flotation and filters follow the bloom risk at this
          intake; membrane elements inside the vessels carry lead-end organic fouling and tail-end scaling.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5" aria-label={`Trains at ${plant.name}`}>
        {plantTrains.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`Train ${t.id}, health ${t.health}. Open details`}
              className="relative flex w-full flex-col gap-1 overflow-hidden rounded-lg border border-border bg-background px-3 pt-2.5 pb-3.5 text-start transition-colors hover:bg-accent"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t.id}</span>
                <span className="text-sm text-muted-foreground">{t.health}</span>
              </span>
              <StatusDot status={t.status} className="text-xs" />
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                <span
                  className={cn('block h-full transition-[width,background-color] duration-500', statusBg[t.status])}
                  style={{ width: `${t.health}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-5 text-sm text-muted-foreground sm:px-6" aria-label="Colour legend">
        <li>
          <StatusDot status="healthy" label="Healthy, over 72 h to limit" />
        </li>
        <li>
          <StatusDot status="watch" label="Watch, reaches the limit within 72 h" />
        </li>
        <li>
          <StatusDot status="critical" label="Critical, at the cleaning limit now" />
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-bloom" />
          Algal bloom
        </li>
      </ul>
    </section>
  )
}
