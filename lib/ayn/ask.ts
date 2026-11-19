// Client for the Ayn assistant. The Next.js app ships the AI layer itself as
// API routes backed by Groq (fast answers + Whisper large-v3 transcription):
//
//   POST /api/ask         question + the numbers on screen -> { answer }
//   POST /api/transcribe  raw audio (webm/opus)            -> { text }
//   GET  /api/health      is the model configured
//
// The optional FastAPI backend in backend/main.py serves the same three paths
// (with a local faster-whisper instead of Groq); point this client at it by
// setting NEXT_PUBLIC_AYN_API=http://localhost:8000 before `pnpm dev`.
import {
  CLEANING_LIMIT,
  HORIZON_HOURS,
  PLANTS,
  TRAINS,
  plantRisk,
  trainForecast,
  trainMetrics,
  trainStateAt,
  type Plant,
} from './model'
import { trainElementRisks } from './scene-bridge'

export type AskErrorKind = 'unreachable' | 'model' | 'speech' | 'empty'

export class AskError extends Error {
  readonly kind: AskErrorKind

  constructor(message: string, kind: AskErrorKind) {
    super(message)
    this.name = 'AskError'
    this.kind = kind
  }
}

export interface AskTurn {
  role: 'user' | 'assistant'
  content: string
}

const DEFAULT_BASE = ''   // same origin: the Next.js API routes

export function askBase(): string {
  const configured = process.env.NEXT_PUBLIC_AYN_API?.trim()
  const base = (configured || DEFAULT_BASE).replace(/\/+$/, '')
  // A phone opening the dashboard at http://<lan-ip>:3000 has its own
  // localhost:8000, so a loopback override must follow the page's host instead.
  if (base && typeof window !== 'undefined' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)) {
    return base.replace(/\/\/(localhost|127\.0\.0\.1)/i, `//${window.location.hostname}`)
  }
  return base
}

export interface AskHealth {
  ok: boolean
  ai: boolean
  stt: boolean
  model: string | null
  /** Why no model answered, as reported by the backend (for example Ollama down). */
  note: string | null
}

const DOWN: AskHealth = { ok: false, ai: false, stt: false, model: null, note: null }

export async function askHealth(): Promise<AskHealth> {
  // The Next.js routes live under /api; the optional Python backend serves
  // /health at its root. Probing the wrong one made the panel report the
  // assistant as offline and sent the Mic to the browser's speech engine.
  const url = askBase() ? `${askBase()}/health` : '/api/health'
  try {
    // The backend probes its model provider before answering, so allow a slow
    // cold probe rather than reporting a running backend as unreachable.
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return DOWN
    const body = (await res.json()) as Partial<AskHealth>
    return {
      ok: true,
      ai: Boolean(body.ai),
      stt: Boolean(body.stt),
      model: body.model ?? null,
      note: body.note ?? null,
    }
  } catch {
    return DOWN
  }
}

function bloomArrival(plant: Plant, from: number, threshold: number): number | '>72' {
  for (let h = Math.ceil(from); h <= HORIZON_HOURS; h++) {
    if (plantRisk(plant, h) >= threshold) return Math.max(0, Math.round(h - from))
  }
  return '>72'
}

// Where the P10/P90 band of the pressure-drop forecast crosses the cleaning
// limit: an optimistic and a pessimistic hour for the same crossing.
function cleanWindow(trainId: string) {
  const points = trainForecast(trainId).filter((p) => p.hour >= 0)
  const earliest = points.find((p) => p.band[1] >= CLEANING_LIMIT)
  const latest = points.find((p) => p.band[0] >= CLEANING_LIMIT)
  return { from: earliest ? earliest.hour : null, to: latest ? latest.hour : null }
}

export interface AskSnapshot {
  [key: string]: unknown
}

/** The dashboard numbers the assistant answers from, at the viewed hour. */
export function buildSnapshot(hour: number): AskSnapshot {
  const viewed = Math.max(0, Math.min(HORIZON_HOURS, Math.round(hour)))

  const trains = TRAINS.map((spec) => {
    const plant = PLANTS.find((p) => p.id === spec.plant)!
    const state = trainStateAt(spec, hour)
    const metrics = trainMetrics(spec.id, hour)
    const risks = trainElementRisks(spec.id, hour)
    const window = cleanWindow(spec.id)
    const reaches = state.hoursToLimit > 0 && state.hoursToLimit <= HORIZON_HOURS
    return {
      id: spec.id,
      plant: plant.name,
      status: state.status,
      health: state.health,
      dp_pct_above_clean: Number(state.pressureDrop.toFixed(1)),
      hours_to_clean: {
        reaches_limit_within_72h: reaches,
        hours_to_limit_p50: reaches ? Math.round(state.hoursToLimit) : null,
        likely_window_h: reaches ? window : null,
        possible_as_early_as_h: reaches ? null : window.from,
        points_below_limit: Number((CLEANING_LIMIT - state.pressureDrop).toFixed(1)),
      },
      flux_m3h: Math.round(metrics.permeateFlow),
      salt_passage_pct: Number((100 - metrics.saltRejection).toFixed(2)),
      days_since_clean: Math.round(metrics.daysSinceClean),
      energy_kwh_m3: Number(metrics.energyUse.toFixed(2)),
      feed_sdi: Number(metrics.sdi.toFixed(1)),
      lead_fouling_risk_pct: Math.round(risks.lead * 100),
      tail_scaling_risk_pct: Math.round(risks.scale * 100),
    }
  })

  const order = [...trains]
    .sort((a, b) => {
      const key = (t: (typeof trains)[number]) =>
        t.hours_to_clean.reaches_limit_within_72h
          ? (t.hours_to_clean.hours_to_limit_p50 as number)
          : 1000 - t.dp_pct_above_clean
      return key(a) - key(b)
    })
    .map((t) => t.id)

  return {
    simulated: true,
    view_hours_ahead: viewed,
    cleaning_limit_pct: CLEANING_LIMIT,
    clean_first_order: order,
    trains,
    plants: PLANTS.map((plant) => ({
      plant: plant.name,
      intake_risk_pct: Math.round(plantRisk(plant, hour) * 100),
      bloom_watch_in_h: bloomArrival(plant, hour, 0.4),
      bloom_critical_in_h: bloomArrival(plant, hour, 0.7),
    })),
    notes:
      'Plant telemetry is simulated from pressure-drop curves and there is no feed-temperature series. The 3D view has no per-pipe sensors.',
  }
}

export async function askAyn(
  question: string,
  hour: number,
  history: AskTurn[] = [],
): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${askBase()}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        data: buildSnapshot(hour),
        history: history.slice(-6),
        lang: 'en',
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    throw new AskError(
      askBase()
        ? `Ayn could not reach the assistant backend at ${askBase()}. Start it (uvicorn main:app --port 8000) and ask again.`
        : 'Ayn could not reach its own assistant API. Check the deployment and the server logs.',
      'unreachable',
    )
  }

  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { error?: string } | null)?.error
    if (res.status === 502 || res.status === 503) {
      throw new AskError(detail ?? 'The model call failed. Check that the API key is set and read the server logs.', 'model')
    }
    throw new AskError(detail ?? `The assistant answered with HTTP ${res.status}.`, 'model')
  }

  const body = (await res.json().catch(() => null)) as { answer?: string } | null
  const answer = (body?.answer ?? '').trim()
  if (!answer) throw new AskError('The backend returned an empty answer.', 'empty')
  return answer
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${askBase()}/api/transcribe?lang=en`, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audio,
      signal: AbortSignal.timeout(180_000),
    })
  } catch {
    throw new AskError(
      askBase()
        ? `Ayn could not reach the speech service at ${askBase()}.`
        : 'Ayn could not reach its own speech service. Check the deployment and the server logs.',
      'unreachable',
    )
  }

  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { error?: string } | null)?.error
    if (res.status === 502 || res.status === 503) {
      throw new AskError(detail ?? 'Speech-to-text failed. Check the API key and read the server logs.', 'speech')
    }
    throw new AskError(detail ?? `Speech-to-text answered with HTTP ${res.status}.`, 'speech')
  }

  const body = (await res.json().catch(() => null)) as { text?: string } | null
  return normalizeTranscript(body?.text ?? '')
}

// Browser speech recognition mishears the dashboard's vocabulary; the backend
// runs Whisper with a vocabulary prompt, and this cleans up the common misses
// either way.
const LETTERS: Record<string, 'A' | 'B' | 'C'> = {
  a: 'A',
  ay: 'A',
  eh: 'A',
  b: 'B',
  be: 'B',
  bee: 'B',
  c: 'C',
  see: 'C',
  sea: 'C',
}
const NUMBERS: Record<string, number> = {
  '1': 1,
  one: 1,
  '2': 2,
  two: 2,
  to: 2,
  too: 2,
  '3': 3,
  three: 3,
  '4': 4,
  four: 4,
  for: 4,
  '5': 5,
  five: 5,
}
const MAX_TRAIN: Record<'A' | 'B' | 'C', number> = { A: 5, B: 4, C: 3 }

export function normalizeTranscript(input: string): string {
  let text = input
    .replace(/\bstrains\b/gi, 'trains')
    .replace(/\bstrain\b/gi, 'train')
    .replace(/\bcleaning\s+(women|woman|lemon|lemming|limb|limits? it)\b/gi, 'cleaning limit')
    .replace(/\bperm(?:ee|ea|ie|i)t\b/gi, 'permeate')
    .replace(/\b(?:brain|brian)\b/gi, 'brine')
    .replace(/\b(?:delta|del ta)\s*p\b/gi, 'pressure drop')

  text = text.replace(
    /\btrains?\s+(a|ay|eh|b|be|bee|c|see|sea)[\s\-.…]*(one|two|too|to|three|four|for|five|\d)\b/gi,
    (match, letter: string, number: string) => {
      const id = LETTERS[letter.toLowerCase()]
      const n = NUMBERS[number.toLowerCase()]
      return id && n && n <= MAX_TRAIN[id] ? `train ${id}${n}` : match
    },
  )

  return text.replace(
    /\b([ABC][\s\-.]?|[abc])([1-5])\b/g,
    (match, letter: string, number: string) => {
      const id = letter.trim().replace(/[\-.]/g, '').toUpperCase() as 'A' | 'B' | 'C'
      return Number(number) <= MAX_TRAIN[id] ? `${id}${number}` : match
    },
  )
}
