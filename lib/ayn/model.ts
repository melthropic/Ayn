// Mock scenario model. Every function here is a stand-in for real forecasting
// services (bloom drift, intake risk, membrane fouling) and can be swapped out.
//
// When Supabase live mode is on, train readings pushed to the `train_readings`
// table win over the simulated curve for the hours they cover; every other hour
// keeps forecasting. See lib/ayn/live-store.ts.

import { liveReadingFor } from './live-store'

export type Status = 'healthy' | 'watch' | 'critical'
export type PlantId = 'A' | 'B' | 'C'

export interface Plant {
  id: PlantId
  name: string
  location: string
  x: number
  y: number
  baseRisk: number
}

export interface TrainSpec {
  id: string
  plant: PlantId
  dp0: number
  baseRate: number
  bloomSensitivity: number
  capacityMigd: number
  daysSinceClean: number
}

export interface TrainState {
  id: string
  plant: PlantId
  pressureDrop: number
  ratePerHour: number
  hoursToLimit: number
  health: number
  status: Status
  capacityMigd: number
}

export interface TrainMetrics {
  pressureDrop: number
  health: number
  feedPressure: number
  permeateFlow: number
  saltRejection: number
  energyUse: number
  sdi: number
  daysSinceClean: number
}

export interface ForecastPoint {
  hour: number
  median: number
  band: [number, number]
}

export const HORIZON_HOURS = 72
export const CLEANING_LIMIT = 15

export const PLANTS: Plant[] = [
  { id: 'A', name: 'Plant A', location: 'Dubai coast', x: 560, y: 246, baseRisk: 0.04 },
  { id: 'B', name: 'Plant B', location: 'Abu Dhabi coast', x: 318, y: 344, baseRisk: 0.04 },
  { id: 'C', name: 'Plant C', location: 'Gulf of Oman', x: 852, y: 292, baseRisk: 0.06 },
]

export const TRAINS: TrainSpec[] = [
  { id: 'A1', plant: 'A', dp0: 6.2, baseRate: 0.03, bloomSensitivity: 0.12, capacityMigd: 9, daysSinceClean: 41 },
  { id: 'A2', plant: 'A', dp0: 7.8, baseRate: 0.035, bloomSensitivity: 0.1, capacityMigd: 9, daysSinceClean: 58 },
  { id: 'A3', plant: 'A', dp0: 9.4, baseRate: 0.04, bloomSensitivity: 0.14, capacityMigd: 9, daysSinceClean: 77 },
  { id: 'A4', plant: 'A', dp0: 5.1, baseRate: 0.025, bloomSensitivity: 0.09, capacityMigd: 9, daysSinceClean: 23 },
  { id: 'A5', plant: 'A', dp0: 4.3, baseRate: 0.02, bloomSensitivity: 0.08, capacityMigd: 9, daysSinceClean: 12 },
  { id: 'B1', plant: 'B', dp0: 8.1, baseRate: 0.05, bloomSensitivity: 0.03, capacityMigd: 12, daysSinceClean: 64 },
  { id: 'B2', plant: 'B', dp0: 6.0, baseRate: 0.04, bloomSensitivity: 0.03, capacityMigd: 12, daysSinceClean: 35 },
  { id: 'B3', plant: 'B', dp0: 10.2, baseRate: 0.045, bloomSensitivity: 0.03, capacityMigd: 12, daysSinceClean: 89 },
  { id: 'B4', plant: 'B', dp0: 5.5, baseRate: 0.03, bloomSensitivity: 0.03, capacityMigd: 12, daysSinceClean: 19 },
  { id: 'C1', plant: 'C', dp0: 7.0, baseRate: 0.04, bloomSensitivity: 0.02, capacityMigd: 6, daysSinceClean: 47 },
  { id: 'C2', plant: 'C', dp0: 4.8, baseRate: 0.03, bloomSensitivity: 0.02, capacityMigd: 6, daysSinceClean: 16 },
  { id: 'C3', plant: 'C', dp0: 3.9, baseRate: 0.025, bloomSensitivity: 0.02, capacityMigd: 6, daysSinceClean: 9 },
]

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)

const BLOOM_START = { x: 352, y: 104 }
const BLOOM_END = { x: 534, y: 208 }

export function bloomAt(hour: number) {
  const p = ease(clamp(hour / HORIZON_HOURS))
  return {
    x: lerp(BLOOM_START.x, BLOOM_END.x, p) + Math.sin(hour / 9) * 6,
    y: lerp(BLOOM_START.y, BLOOM_END.y, p) + Math.cos(hour / 11) * 4,
    radius: lerp(46, 70, p),
    intensity: lerp(0.65, 1, p),
    rotation: lerp(-18, 24, p),
  }
}

export function plantRisk(plant: Plant, hour: number) {
  const b = bloomAt(hour)
  const d = Math.hypot(plant.x - b.x, plant.y - b.y)
  return clamp(plant.baseRisk + 1 - (d - 24) / 250)
}

export function riskStatus(risk: number): Status {
  if (risk >= 0.7) return 'critical'
  if (risk >= 0.4) return 'watch'
  return 'healthy'
}

const plantById = (id: PlantId) => PLANTS.find((p) => p.id === id)!

// Simulated pressure drop at each whole hour, per train. The curve is fixed
// (it depends only on the spec and the bloom track), so it is built once;
// playback asks for every train at a new fractional hour on every frame.
const dpCurveCache = new Map<string, number[]>()

function dpCurve(spec: TrainSpec) {
  let curve = dpCurveCache.get(spec.id)
  if (curve) return curve
  const plant = plantById(spec.plant)
  curve = [spec.dp0]
  for (let h = 0; h < HORIZON_HOURS; h++) {
    curve.push(curve[h] + spec.baseRate + spec.bloomSensitivity * plantRisk(plant, h))
  }
  dpCurveCache.set(spec.id, curve)
  return curve
}

function pressureDropAt(spec: TrainSpec, hour: number) {
  // A live reading for this hour (from Supabase) replaces the simulated curve.
  const live = liveReadingFor(spec.id, hour)
  if (live) return live.pressureDrop
  if (hour <= 0) return spec.dp0
  // Whole hours from the cached curve, then the partial hour at the rate of
  // the hour it falls in (the same 1 h Euler steps as before).
  const curve = dpCurve(spec)
  const whole = Math.min(Math.floor(hour), HORIZON_HOURS)
  const partial = hour - whole
  if (partial <= 0) return curve[whole]
  const plant = plantById(spec.plant)
  return curve[whole] + (spec.baseRate + spec.bloomSensitivity * plantRisk(plant, whole)) * partial
}

function healthFromDp(dp: number) {
  return Math.round(clamp(100 - dp * 4.6, 0, 100))
}

// Status reflects where the train is now, not a forecast: Critical means the
// pressure drop is at or past the cleaning limit, Watch means it is still
// below the limit but reaches it inside the forecast window.
function trainStatus(hoursToLimit: number): Status {
  if (hoursToLimit <= 0) return 'critical'
  if (hoursToLimit <= HORIZON_HOURS) return 'watch'
  return 'healthy'
}

export function trainStateAt(spec: TrainSpec, hour: number): TrainState {
  const plant = plantById(spec.plant)
  const dp = pressureDropAt(spec, hour)
  const rate = spec.baseRate + spec.bloomSensitivity * plantRisk(plant, hour)
  const hoursToLimit = dp >= CLEANING_LIMIT ? 0 : (CLEANING_LIMIT - dp) / rate
  return {
    id: spec.id,
    plant: spec.plant,
    pressureDrop: dp,
    ratePerHour: rate,
    hoursToLimit,
    health: healthFromDp(dp),
    status: trainStatus(hoursToLimit),
    capacityMigd: spec.capacityMigd,
  }
}

export function rankedTrains(hour: number) {
  return TRAINS.map((t) => trainStateAt(t, hour)).sort((a, b) => a.hoursToLimit - b.hoursToLimit)
}

export function trainMetrics(id: string, hour: number): TrainMetrics {
  const spec = TRAINS.find((t) => t.id === id)!
  const state = trainStateAt(spec, hour)
  const risk = plantRisk(plantById(spec.plant), hour)
  const dp = state.pressureDrop
  const live = liveReadingFor(id, hour)
  return {
    pressureDrop: dp,
    health: state.health,
    feedPressure: live?.feedPressure ?? 61.5 + dp * 0.42,
    permeateFlow: live?.permeateFlow ?? (spec.capacityMigd * 189.4) / 24 - dp * 2.1,
    saltRejection: live?.saltRejection ?? 99.72 - dp * 0.018,
    energyUse: live?.energyUse ?? 3.05 + dp * 0.035,
    sdi: live?.sdi ?? 2.4 + risk * 2.6,
    daysSinceClean: live?.daysSinceClean ?? spec.daysSinceClean + Math.floor(hour / 24),
  }
}

export function trainForecast(id: string): ForecastPoint[] {
  const spec = TRAINS.find((t) => t.id === id)!
  const points: ForecastPoint[] = []
  for (let h = -24; h <= HORIZON_HOURS; h += 3) {
    const median =
      h <= 0 ? spec.dp0 + (spec.baseRate * h) + Math.sin(h / 3) * 0.08 : pressureDropAt(spec, h)
    const spread = h <= 0 ? 0.15 : 0.15 + (h / HORIZON_HOURS) * (1.2 + spec.bloomSensitivity * 10)
    points.push({
      hour: h,
      median: Number(median.toFixed(2)),
      band: [Number((median - spread * 0.85).toFixed(2)), Number((median + spread).toFixed(2))],
    })
  }
  return points
}

export function hoursUntilCritical(plant: Plant, fromHour: number) {
  for (let h = fromHour; h <= HORIZON_HOURS; h += 0.5) {
    if (plantRisk(plant, h) >= 0.7) return h - fromHour
  }
  return null
}

export function fleetSummary(hour: number) {
  const trains = TRAINS.map((t) => trainStateAt(t, hour))
  const fleetHealth = Math.round(trains.reduce((s, t) => s + t.health, 0) / trains.length)
  const risks = PLANTS.map((p) => ({ plant: p, risk: plantRisk(p, hour) }))
  const top = risks.reduce((a, b) => (b.risk > a.risk ? b : a))
  const atRisk = trains.filter((t) => t.status === 'critical')
  const outputAtRisk = atRisk.reduce((s, t) => s + t.capacityMigd, 0)
  const totalOutput = trains.reduce((s, t) => s + t.capacityMigd, 0)
  const timeToCritical = hoursUntilCritical(top.plant, hour)
  return {
    fleetHealth,
    fleetStatus: (fleetHealth >= 50 ? 'healthy' : fleetHealth >= 38 ? 'watch' : 'critical') as Status,
    topRisk: top,
    risks,
    outputAtRisk,
    totalOutput,
    trainsAtRisk: atRisk.length,
    timeToCritical,
  }
}

export interface AlertEvent {
  hour: number
  status: Status
  title: string
  detail: string
}

export const ALERT_EVENTS: AlertEvent[] = [
  {
    hour: 2,
    status: 'watch',
    title: 'Bloom detected offshore',
    detail: 'Chlorophyll patch 38 km north west of Plant A, drifting south east with the current.',
  },
  {
    hour: 14,
    status: 'watch',
    title: 'Plant A intake risk is rising',
    detail: 'Forecast places the bloom edge within 25 km of the Plant A intake by tomorrow.',
  },
  {
    hour: 26,
    status: 'watch',
    title: 'Feed silt density rising at Plant A',
    detail: 'SDI forecast above 4.0 on trains A1 to A5. Consider raising coagulant dose.',
  },
  {
    hour: 48,
    status: 'critical',
    title: 'Plant A intake risk is critical',
    detail: 'Bloom expected at the intake within 12 hours. Prepare cleaning crews for A3.',
  },
  {
    hour: 50,
    status: 'critical',
    title: 'Train A3 nears the cleaning limit',
    detail: 'Pressure drop forecast to pass 15% above clean baseline within 24 hours.',
  },
  {
    hour: 62,
    status: 'watch',
    title: 'A2 is the next clean to schedule',
    detail: 'A2 reaches the cleaning limit first after A3. Schedule it directly after A3 to keep Plant A output above 30 MIGD.',
  },
]

export const STATUS_LABEL: Record<Status, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
}

export function formatHours(h: number) {
  if (h <= 0) return 'Now'
  if (h > HORIZON_HOURS) return `Over ${HORIZON_HOURS} h`
  return `${Math.round(h)} h`
}

const SCENARIO_START_UTC = Date.UTC(2026, 10, 18, 2, 0)

export function formatClock(hour: number) {
  const h = Math.round(hour)
  const date = new Date(SCENARIO_START_UTC + h * 3_600_000)
  const stamp = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(date)
  return { offset: h === 0 ? 'Now' : `+${h} h`, stamp: `${stamp} GST` }
}
