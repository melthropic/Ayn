// Readings pushed from Supabase, keyed by train and forecast hour.
//
// The model functions in model.ts consult this store first, so every screen —
// trains, KPIs, drawer, alerts, Ask Ayn, the 3D bridge — shows the live numbers
// without any component knowing where they came from. An hour with no row falls
// back to the simulated forecast, which is what the timeline scrub shows.

export interface LiveReading {
  trainId: string
  hour: number
  pressureDrop: number
  feedPressure: number | null
  permeateFlow: number | null
  saltRejection: number | null
  energyUse: number | null
  sdi: number | null
  daysSinceClean: number | null
}

const readings = new Map<string, LiveReading>()

const key = (trainId: string, hour: number) => `${trainId}@${Math.round(hour)}`

export function putLiveReading(reading: LiveReading): void {
  readings.set(key(reading.trainId, reading.hour), reading)
}

export function mergeLiveReadings(list: LiveReading[]): void {
  for (const reading of list) putLiveReading(reading)
}

/** The live reading for this train at this hour, if Supabase has one. */
export function liveReadingFor(trainId: string, hour: number): LiveReading | undefined {
  return readings.get(key(trainId, hour))
}

/** A row was deleted (e.g. in the table editor): fall back to the model. */
export function removeLiveReading(trainId: string, hour: number): void {
  readings.delete(key(trainId, hour))
}

/** Test/dev helper: forget everything that was received. */
export function clearLiveReadings(): void {
  readings.clear()
}
