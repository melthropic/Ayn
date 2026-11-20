// Adapter between the dashboard model (`lib/ayn/model.ts`) and the ported
// Three.js plant scene (`components/ayn/plant-scene.js`).
//
// The scene was written for the original single-page dashboard, which published
// a `window.SWB` object holding per-plant chlorophyll and risk series, fouling
// readings (`stateAt`), element-by-element risk (`elemRisks`) and the colour ramp
// (`riskRGB`). This module recreates that shape from the new model so the scene
// keeps its original behaviour while every number follows the forecast hour:
//
//   intake risk      -> plantRisk(plant, hour)
//   train severity   -> trainStateAt(spec, hour).pressureDrop
//   element fouling  -> lead/tail split weighted by plant risk, the fraction of
//                       the 15% cleaning limit and days since the last clean
//
// The new model carries no temperature series, so the port fixes the feed
// temperature at the Gulf surface value the old snapshot used (29 °C); it is a
// constant offset in the element split, not a trend.
import {
  CLEANING_LIMIT,
  HORIZON_HOURS,
  PLANTS,
  TRAINS,
  plantRisk,
  trainMetrics,
  trainStateAt,
  type Plant,
  type PlantId,
  type TrainSpec,
} from './model'

export interface SceneData {
  hour: number
  plantId: PlantId
}

export type Rgb = [number, number, number]

export interface SceneTrain {
  id: string
  p: PlantId
  spec: TrainSpec
}

export interface ScenePlant {
  id: PlantId
  chl: number[]
  risk: number[]
  T0: number
}

export interface SceneState {
  dp: number
  T: number
  flux: number
  load: number
  dsc: number
  risk: number
  SP: number
}

export interface ElementRisks {
  elems: number[]
  lead: number
  scale: number
}

export interface SceneBridge {
  plants: ScenePlant[]
  trains: SceneTrain[]
  LIM: number
  t: () => number
  intakeRisk: (pid: PlantId) => number
  stateAt: (train: SceneTrain, hour: number) => SceneState
  elemRisks: (train: SceneTrain, hour: number) => ElementRisks
  cssv: (token: string) => string
  riskRGB: (risk: number) => Rgb
  open: (id: string) => void
}

const GULF_SST = 29

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

// Scene tokens. The 3D stage is always dark (it starts from `--stage` in both
// themes), so text and land resolve to the dark values. Risk colours follow the
// active theme so the scene matches the charts and status dots beside it.
const TOKENS: Record<string, string> = {
  '--ok': '--healthy',
  '--wa': '--watch',
  '--ac': '--critical',
  '--pn': '--stage',
  '--ln': '--border',
  '--tx': '#e6f1ee',
  '--mu': '#8fb0b0',
  '--land': '#123b45',
  '--bg': '#08222a',
}

// Theme colours only change when the theme class on <html> changes, so they
// are cached per class. During playback the scene recolours every frame, and
// a getComputedStyle per lookup added up.
let cssvTheme: string | null = null
const cssvCache = new Map<string, string>()

export function cssv(token: string): string {
  const mapped = TOKENS[token] ?? token
  if (!mapped.startsWith('--')) return mapped
  if (typeof window === 'undefined') return ''
  const theme = document.documentElement.className
  if (theme !== cssvTheme) {
    cssvTheme = theme
    cssvCache.clear()
  }
  let value = cssvCache.get(mapped)
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(mapped).trim()
    cssvCache.set(mapped, value)
  }
  return value
}

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return [1, 1, 1]
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const themeRgb = (token: string): Rgb => {
  const [r, g, b] = hexToRgb(cssv(token))
  return [r / 255, g / 255, b / 255]
}

/** Healthy -> watch -> critical ramp, same shape as the original `riskRGB`. */
export function riskRGB(risk: number): Rgb {
  const ok = themeRgb('--ok')
  const watch = themeRgb('--wa')
  const critical = themeRgb('--ac')
  const k = clamp(risk)
  const from = k < 0.5 ? ok : watch
  const to = k < 0.5 ? watch : critical
  const t = k < 0.5 ? k * 2 : (k - 0.5) * 2
  return [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t)]
}

// The scene reads a chlorophyll series and a 0..1 intake risk series per plant.
const seriesCache = new Map<PlantId, ScenePlant>()

function seriesFor(plant: Plant): ScenePlant {
  const cached = seriesCache.get(plant.id)
  if (cached) return cached
  const risk: number[] = []
  const chl: number[] = []
  for (let h = 0; h <= HORIZON_HOURS; h++) {
    const r = plantRisk(plant, h)
    risk.push(r)
    chl.push(0.6 + 5.4 * r) // mg/m3 equivalent, only used for particle density
  }
  const series: ScenePlant = { id: plant.id, risk, chl, T0: GULF_SST }
  seriesCache.set(plant.id, series)
  return series
}

function stateAt(train: SceneTrain, hour: number): SceneState {
  const plant = PLANTS.find((p) => p.id === train.spec.plant)!
  const state = trainStateAt(train.spec, hour)
  const metrics = trainMetrics(train.spec.id, hour)
  const risk = plantRisk(plant, hour)
  return {
    dp: state.pressureDrop,
    T: GULF_SST,
    flux: metrics.permeateFlow,
    load: 0.35 + 3.5 * risk,
    dsc: train.spec.daysSinceClean + Math.max(hour, 0) / 24,
    risk,
    SP: metrics.sdi,
  }
}

/**
 * Element-level fouling for one train: organic/biological fouling hits the lead
 * elements (they see the raw feed) while scaling concentrates on the tail
 * elements, where recovery and pressure drop are highest. Weighted by plant risk
 * at that intake, the fraction of the cleaning limit used and days since clean.
 */
export function trainElementRisks(trainId: string, hour: number): ElementRisks {
  const spec = TRAINS.find((t) => t.id === trainId)!
  const plant = PLANTS.find((p) => p.id === spec.plant)!
  const risk = plantRisk(plant, hour)
  const dpFrac = clamp(trainStateAt(spec, hour).pressureDrop / CLEANING_LIMIT)
  const ageFrac = clamp((spec.daysSinceClean + Math.max(hour, 0) / 24) / 90)

  const lead = clamp(0.6 * risk + 0.25 * dpFrac + 0.15 * ageFrac)
  const scale = clamp(0.2 * risk + 0.5 * dpFrac + 0.3 * ageFrac)

  const elems: number[] = []
  for (let k = 1; k <= 7; k++) {
    const wLead = Math.exp(-Math.pow((k - 1) / 2.2, 2))
    const wTail = Math.exp(-Math.pow((k - 7) / 2.2, 2))
    elems.push(clamp(wLead * lead + wTail * scale + 0.08 * ageFrac))
  }
  return { elems, lead, scale }
}

const elemRisks = (train: SceneTrain, hour: number): ElementRisks =>
  trainElementRisks(train.id, hour)

export function createSceneBridge(
  data: SceneData,
  onOpenTrain: (id: string) => void,
): SceneBridge {
  const trains: SceneTrain[] = TRAINS.map((spec) => ({ id: spec.id, p: spec.plant, spec }))
  const plants = PLANTS.map(seriesFor)
  return {
    plants,
    trains,
    LIM: CLEANING_LIMIT,
    t: () => data.hour,
    intakeRisk: (pid) => {
      const plant = PLANTS.find((p) => p.id === pid)
      return plant ? plantRisk(plant, data.hour) : 0
    },
    stateAt,
    elemRisks,
    cssv,
    riskRGB,
    open: (id) => onOpenTrain(id),
  }
}
