'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CrewNotification, NotificationKind } from './notify'
import { supabaseBrowser } from './supabase'

/** How far back the dashboard looks for alerts it should still show. */
const RECENT_MS = 30 * 60 * 1000

export interface NotifyConfig {
  /** Telegram is configured, so the button can send. */
  telegram: boolean
  /** Alerts are recorded in Supabase, so acknowledgements come back live. */
  tracking: boolean
}

/** A send this device started that the server has not confirmed yet, or that failed. */
export interface PendingSend {
  trainId: string
  kind: NotificationKind
  state: 'sending' | 'sent' | 'failed'
  at: number
  error?: string
}

export function useCrewNotify() {
  const [config, setConfig] = useState<NotifyConfig | null>(null)
  const [rows, setRows] = useState<CrewNotification[]>([])
  const [pending, setPending] = useState<Record<string, PendingSend>>({})
  // Alerts sent before the last Reset are hidden, so a new run starts clean.
  const [since, setSince] = useState(() => Date.now() - RECENT_MS)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    fetch('/api/notify')
      .then((r) => (r.ok ? r.json() : null))
      .then((c: NotifyConfig | null) => mounted.current && setConfig(c ?? { telegram: false, tracking: false }))
      .catch(() => mounted.current && setConfig({ telegram: false, tracking: false }))
    return () => {
      mounted.current = false
    }
  }, [])

  // Recorded alerts: load the recent ones, then follow inserts and updates
  // (an acknowledgement is an update) over realtime. Only once the server
  // says alerts are recorded, so a project without the table stays quiet.
  const tracking = Boolean(config?.telegram && config.tracking)
  useEffect(() => {
    if (!tracking) return
    const supabase = supabaseBrowser()
    if (!supabase) return
    let cancelled = false
    const upsert = (row: CrewNotification) =>
      setRows((list) =>
        [row, ...list.filter((r) => r.id !== row.id)].sort((a, b) => b.sent_at.localeCompare(a.sent_at)),
      )

    const channel = supabase
      .channel('ayn-crew')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string }
          setRows((list) => list.filter((r) => r.id !== old.id))
          return
        }
        upsert(payload.new as CrewNotification)
      })
      .subscribe()

    void supabase
      .from('notifications')
      .select('id, kind, train_id, plant_id, hour, message, sent_at, delivered, acknowledged_at, acknowledged_by')
      .gte('sent_at', new Date(Date.now() - RECENT_MS).toISOString())
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setRows((list) => mergeRows(list, data as CrewNotification[]))
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [tracking])

  const send = useCallback(async (trainId: string, hour: number, kind: NotificationKind, runId?: string) => {
    setPending((p) => ({ ...p, [trainId]: { trainId, kind, state: 'sending', at: Date.now() } }))
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainId, hour, kind, runId }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string; skipped?: boolean } | null
      if (!res.ok) throw new Error(body?.error ?? 'The alert was not sent.')
      if (mounted.current) setPending((p) => ({ ...p, [trainId]: { trainId, kind, state: 'sent', at: Date.now() } }))
    } catch (err) {
      if (!mounted.current) return
      const error = err instanceof Error ? err.message : 'The alert was not sent.'
      setPending((p) => ({ ...p, [trainId]: { trainId, kind, state: 'failed', at: Date.now(), error } }))
    }
  }, [])

  const reset = useCallback(() => {
    setSince(Date.now())
    setPending({})
  }, [])

  /** The latest recorded alert for a train since the last reset, if any. */
  const latestFor = useCallback(
    (trainId: string) => rows.find((r) => r.train_id === trainId && Date.parse(r.sent_at) >= since) ?? null,
    [rows, since],
  )

  return { config, send, reset, latestFor, pending }
}

function mergeRows(list: CrewNotification[], incoming: CrewNotification[]) {
  const byId = new Map(list.map((r) => [r.id, r]))
  for (const r of incoming) if (!byId.has(r.id)) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => b.sent_at.localeCompare(a.sent_at))
}
