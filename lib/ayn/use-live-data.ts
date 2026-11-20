'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeLiveReadings, removeLiveReading, type LiveReading } from './live-store'
import { liveConfigured, supabaseBrowser, writeScenarioHour } from './supabase'

export interface LiveState {
  /** The Supabase env vars are present, so live mode is available. */
  enabled: boolean
  /** The realtime socket is subscribed. */
  connected: boolean
  /** The shared forecast hour, or null until the first message. */
  hour: number | null
  updatedAt: string | null
  error: string | null
  /** Bumps whenever a row arrives, so the dashboard recomputes. */
  version: number
}

export interface LiveControls extends LiveState {
  /** Publish this hour to every other device (throttled). */
  writeHour: (hour: number) => void
}

const INITIAL: LiveState = {
  enabled: false,
  connected: false,
  hour: null,
  updatedAt: null,
  error: null,
  version: 0,
}

/** Writes closer together than this are coalesced. */
const WRITE_INTERVAL_MS = 250
/** A row matching our own write inside this window is our echo, not a remote move. */
const ECHO_WINDOW_MS = 3000

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toReading(row: Record<string, unknown>): LiveReading | null {
  const trainId = typeof row.train_id === 'string' ? row.train_id : null
  const hour = num(row.hour)
  const pressureDrop = num(row.pressure_drop)
  if (!trainId || hour === null || pressureDrop === null) return null
  return {
    trainId,
    hour,
    pressureDrop,
    feedPressure: num(row.feed_pressure),
    permeateFlow: num(row.permeate_flow),
    saltRejection: num(row.salt_rejection),
    energyUse: num(row.energy_use),
    sdi: num(row.sdi),
    daysSinceClean: num(row.days_since_clean),
  }
}

/**
 * Subscribes to the `scenario` and `train_readings` tables.
 *
 * The scenario row is the shared clock: any device can move it (the laptop
 * slider) and every other device follows (the phone). Readings land in the live
 * store, which model.ts reads, so the whole UI updates without passing anything
 * down.
 */
export function useLiveData(): LiveControls {
  const [state, setState] = useState<LiveState>(() => ({ ...INITIAL, enabled: liveConfigured() }))
  // The last hour that came from Supabase, so echoes of our own write are
  // ignored instead of pulling the local slider back.
  const remoteHour = useRef<number | null>(null)
  const latest = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrite = useRef(0)
  // Hours this device sent recently (hour -> time sent), so their echoes do
  // not drag the local clock back while it is playing ahead.
  const ownWrites = useRef(new Map<number, number>())

  const writeHour = useCallback((value: number) => {
    if (!liveConfigured()) return
    // `scenario.hour` is an integer column; playback produces fractions.
    const hour = Math.round(value)
    if (hour === remoteHour.current) return
    remoteHour.current = hour
    latest.current = hour
    if (timer.current !== null) return
    const delay = Math.max(0, WRITE_INTERVAL_MS - (Date.now() - lastWrite.current))
    timer.current = setTimeout(() => {
      timer.current = null
      lastWrite.current = Date.now()
      const next = latest.current
      if (next === null) return
      ownWrites.current.set(next, Date.now())
      void writeScenarioHour(next)
    }, delay)
  }, [])

  useEffect(() => {
    if (!liveConfigured()) return
    const supabase = supabaseBrowser()
    if (!supabase) return
    let cancelled = false

    const channel = supabase
      .channel('ayn-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scenario' }, (payload) => {
        const row = payload.new as { hour?: number; updated_at?: string }
        if (typeof row?.hour !== 'number') return
        remoteHour.current = row.hour
        const sentAt = ownWrites.current.get(row.hour)
        ownWrites.current.delete(row.hour)
        if (sentAt !== undefined && Date.now() - sentAt < ECHO_WINDOW_MS) {
          setState((s) => ({ ...s, updatedAt: row.updated_at ?? s.updatedAt, connected: true }))
          return
        }
        setState((s) => ({
          ...s,
          hour: row.hour as number,
          updatedAt: row.updated_at ?? s.updatedAt,
          connected: true,
          version: s.version + 1,
        }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'train_readings' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { train_id?: string; hour?: number }
          if (old?.train_id && typeof old.hour === 'number') {
            removeLiveReading(old.train_id, old.hour)
            setState((s) => ({ ...s, version: s.version + 1 }))
          }
          return
        }
        const reading = toReading(payload.new as Record<string, unknown>)
        if (!reading) return
        mergeLiveReadings([reading])
        setState((s) => ({ ...s, connected: true, version: s.version + 1 }))
      })
      .subscribe((status) => {
        if (cancelled) return
        setState((s) => ({
          ...s,
          connected: status === 'SUBSCRIBED',
          error:
            status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
              ? 'Supabase realtime could not connect.'
              : status === 'SUBSCRIBED'
                ? null
                : s.error,
        }))
      })

    // Subscribe first, then backfill: nothing that arrives in between is lost.
    void (async () => {
      const [{ data: scenario, error: scenarioError }, { data: rows, error: rowsError }] =
        await Promise.all([
          supabase.from('scenario').select('hour, updated_at').eq('id', 1).maybeSingle(),
          supabase.from('train_readings').select('*').order('hour', { ascending: false }).limit(2000),
        ])
      if (cancelled) return
      if (rows?.length) {
        mergeLiveReadings(
          rows
            .map((row) => toReading(row as Record<string, unknown>))
            .filter((r): r is LiveReading => r !== null),
        )
      }
      if (typeof scenario?.hour === 'number') remoteHour.current = scenario.hour
      setState((s) => ({
        ...s,
        hour: typeof scenario?.hour === 'number' ? scenario.hour : s.hour,
        updatedAt: scenario?.updated_at ?? s.updatedAt,
        error: scenarioError?.message ?? rowsError?.message ?? s.error,
        version: s.version + 1,
      }))
    })()

    return () => {
      cancelled = true
      if (timer.current !== null) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [])

  return { ...state, writeHour }
}
