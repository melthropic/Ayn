// Notify crew: posts a cleaning alert to the crew's Telegram group and records
// it in Supabase, so every dashboard shows it was sent and, once someone taps
// Acknowledge in Telegram, who acknowledged it.
//
//   GET  /api/notify   { telegram, tracking }: what is configured
//   POST /api/notify   { trainId, hour, kind: 'auto' | 'manual', runId? }
//
// 'auto' alerts carry the playback run id, so a train that goes critical is
// announced once per run however many devices are watching.
//
// Behind the demo password (proxy.ts), like the rest of /api.
import { crewMessage, isTrainId, type NotificationKind } from '@/lib/ayn/notify'
import { supabaseAdmin } from '@/lib/ayn/supabase-admin'
import { sendAlert, telegramConfigured } from '@/lib/ayn/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function GET() {
  return Response.json({ telegram: telegramConfigured(), tracking: supabaseAdmin() !== null })
}

interface NotifyBody {
  trainId?: unknown
  hour?: unknown
  kind?: unknown
  runId?: unknown
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as NotifyBody | null
  const trainId = body?.trainId
  if (!isTrainId(trainId)) return Response.json({ error: 'Unknown train.' }, { status: 400 })
  const hour = typeof body?.hour === 'number' && Number.isFinite(body.hour) ? body.hour : 0
  const kind: NotificationKind = body?.kind === 'auto' ? 'auto' : 'manual'
  const runId = typeof body?.runId === 'string' && /^[a-z0-9-]{1,40}$/i.test(body.runId) ? body.runId : null
  if (kind === 'auto' && !runId) return Response.json({ error: 'Automatic alerts need a run id.' }, { status: 400 })

  if (!telegramConfigured()) {
    return Response.json(
      { error: 'Telegram is not set up. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, then redeploy.' },
      { status: 503 },
    )
  }

  const message = crewMessage(trainId, hour, kind)
  const db = supabaseAdmin()

  // Record first, so the Acknowledge button can carry the row id.
  let id: string = crypto.randomUUID()
  if (db) {
    const { data, error } = await db
      .from('notifications')
      .insert({
        kind,
        train_id: trainId,
        plant_id: message.plantId,
        hour: message.hour,
        message: message.plain,
        dedupe_key: kind === 'auto' ? `auto:${runId}:${trainId}` : null,
      })
      .select('id')
      .single()
    if (error) {
      // Another device already announced this train in this run.
      if (error.code === '23505') return Response.json({ skipped: true })
      return Response.json({ error: `Could not record the alert: ${error.message}` }, { status: 500 })
    }
    id = data.id as string
  }

  try {
    const sent = await sendAlert(message.html, id)
    if (db) {
      await db
        .from('notifications')
        .update({ delivered: true, telegram_chat_id: sent.chatId, telegram_message_id: sent.messageId })
        .eq('id', id)
    }
    return Response.json({ id, delivered: true })
  } catch (err) {
    // Drop the record so a retry is not blocked by the dedupe key.
    if (db) await db.from('notifications').delete().eq('id', id)
    const text = err instanceof Error ? err.message : 'Telegram did not accept the message.'
    return Response.json({ error: text }, { status: 502 })
  }
}
