// Ayn live demo simulator.
//
//   npm run live
//
// Every few seconds it advances the shared scenario clock and writes one
// `train_readings` row per train. Supabase Realtime pushes both to every open
// dashboard, so the map, trains, KPIs and alerts move together.
//
// Configuration comes from the environment or .env.local:
//   NEXT_PUBLIC_SUPABASE_URL        project URL
//   SUPABASE_SERVICE_ROLE_KEY       service role key (server-only, never public)
//   LIVE_TICK_MS                    4000   how often to advance
//   LIVE_STEP_HOURS                 1      hours to advance per tick
//
// The numbers come from the same model the dashboard uses, so a reading the
// script writes is exactly what the UI would have simulated anyway — and any
// row you edit by hand in the Supabase table editor wins immediately.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createClient } from '@supabase/supabase-js'

// The app's TypeScript imports omit file extensions; Node's resolver needs them.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.')) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})

const { TRAINS, HORIZON_HOURS, formatClock, trainMetrics, trainStateAt } = await import(
  '../lib/ayn/model.ts'
)

function loadEnv() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match || line.trim().startsWith('#')) continue
      if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // No .env.local: rely on the real environment (CI, shell exports).
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim()

if (!url || !key) {
  console.error(
    '\nMissing Supabase credentials.\n' +
      'Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local,\n' +
      'then run `npm run live` again.\n',
  )
  process.exit(1)
}

const tickMs = Math.max(500, Number(process.env.LIVE_TICK_MS) || 4000)
const step = Math.max(1, Math.round(Number(process.env.LIVE_STEP_HOURS) || 1))

const supabase = createClient(url, key, { auth: { persistSession: false } })

const round = (value, digits) => Number(value.toFixed(digits))

function readingsAt(hour, now) {
  return TRAINS.map((spec) => {
    const state = trainStateAt(spec, hour)
    const metrics = trainMetrics(spec.id, hour)
    return {
      train_id: spec.id,
      hour,
      pressure_drop: round(state.pressureDrop, 2),
      feed_pressure: round(metrics.feedPressure, 1),
      permeate_flow: round(metrics.permeateFlow, 1),
      salt_rejection: round(metrics.saltRejection, 2),
      energy_use: round(metrics.energyUse, 2),
      sdi: round(metrics.sdi, 1),
      days_since_clean: Math.round(metrics.daysSinceClean),
      updated_at: now,
    }
  })
}

async function currentHour() {
  const { data, error } = await supabase.from('scenario').select('hour').eq('id', 1).maybeSingle()
  if (error) throw error
  return typeof data?.hour === 'number' ? data.hour : 0
}

async function tick() {
  hour = hour >= HORIZON_HOURS ? 0 : Math.min(HORIZON_HOURS, hour + step)
  const now = new Date().toISOString()

  const { error: scenarioError } = await supabase
    .from('scenario')
    .upsert({ id: 1, hour, playing: true, updated_at: now }, { onConflict: 'id' })
  if (scenarioError) throw scenarioError

  const { error: readingsError } = await supabase
    .from('train_readings')
    .upsert(readingsAt(hour, now), { onConflict: 'train_id,hour' })
  if (readingsError) throw readingsError

  const clock = formatClock(hour)
  console.log(
    `[${new Date().toLocaleTimeString()}] hour ${String(hour).padStart(2, ' ')} · ${clock.offset} · ${clock.stamp} · ${TRAINS.length} readings`,
  )
}

let hour = await currentHour().catch(() => 0)

console.log(`Ayn live demo → ${url}`)
console.log(`advancing ${step} h every ${(tickMs / 1000).toFixed(1)}s from hour ${hour} (Ctrl+C to stop)`)

let running = false
const timer = setInterval(async () => {
  if (running) return
  running = true
  try {
    await tick()
  } catch (error) {
    console.error('tick failed:', error.message ?? error)
  } finally {
    running = false
  }
}, tickMs)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(timer)
    console.log('\nstopped')
    process.exit(0)
  })
}
