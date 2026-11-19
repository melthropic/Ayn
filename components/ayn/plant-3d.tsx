'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PlantId } from '@/lib/ayn/model'

interface SceneHandle {
  update: () => void
  setPlant: (id: PlantId) => void
  setView: (preset: 'overview' | 'vessels' | 'intake' | 'pump') => void
  dispose: () => void
}

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'vessels', label: 'Vessel row' },
  { id: 'intake', label: 'Intake' },
] as const

interface Props {
  plantId: PlantId
  hour: number
  onSelect: (id: string) => void
}

const PLANT_LABEL: Record<PlantId, string> = {
  A: 'Plant A, Dubai coast',
  B: 'Plant B, Abu Dhabi coast',
  C: 'Plant C, Gulf of Oman',
}

export function Plant3D({ plantId, hour, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<SceneHandle | null>(null)
  // The scene keeps a reference to this object, so it is mutated in place: the
  // bridge reads `hour` from it whenever it recolours the plant.
  const dataRef = useRef({ hour, plantId })
  const builtPlantRef = useRef<PlantId | null>(null)
  const selectRef = useRef(onSelect)
  const [hasSize, setHasSize] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    dataRef.current.hour = hour
    dataRef.current.plantId = plantId
  }, [hour, plantId])

  // The Plant view is rendered twice (desktop column and mobile column) and CSS
  // hides one of them. Only the visible copy builds a scene: a 0x0 canvas would
  // otherwise pay for a full plant, shadow map and animation loop.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => setHasSize(host.clientWidth > 1 && host.clientHeight > 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !hasSize) return
    let cancelled = false

    import('./plant-scene')
      .then(({ mountPlantScene }) => {
        if (cancelled) return
        const handle = mountPlantScene({
          container: host,
          data: dataRef.current,
          onOpenTrain: (id: string) => selectRef.current(id),
        }) as SceneHandle
        handleRef.current = handle
        builtPlantRef.current = dataRef.current.plantId
        setStatus('ready')
      })
      .catch((err: unknown) => {
        console.error('Ayn 3D plant view could not load', err)
        if (!cancelled) setStatus('failed')
      })

    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
      builtPlantRef.current = null
    }
  }, [hasSize])

  useEffect(() => {
    if (status !== 'ready') return
    const handle = handleRef.current
    if (!handle) return
    if (builtPlantRef.current !== plantId) {
      builtPlantRef.current = plantId
      handle.setPlant(plantId)
    }
    handle.update()
  }, [status, hour, plantId])

  return (
    <div className="relative">
      <div
        ref={hostRef}
        className="plant3d relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-stage sm:aspect-[16/8]"
        role="img"
        aria-label={`3D reverse osmosis plant view, ${PLANT_LABEL[plantId]}`}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-stage/80 text-sm text-[#8fb0b0]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading 3D plant view
        </div>
      )}
      {status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-stage/90 px-6 text-center text-sm text-[#8fb0b0]">
          The 3D view could not start (WebGL is unavailable in this browser). The rest of the dashboard keeps working.
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => handleRef.current?.setView(v.id)}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {v.label}
          </button>
        ))}
        <span className="ms-auto text-xs text-muted-foreground">Drag to rotate, scroll to zoom</span>
      </div>
    </div>
  )
}
