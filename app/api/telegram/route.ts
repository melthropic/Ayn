// Telegram webhook. Telegram calls this when someone taps Acknowledge under an
// alert (and for messages to the bot). It is public in proxy.ts, so it checks
// the secret-token header Telegram sends with every call instead.
//
// On Acknowledge: the notification row is stamped with who and when (every
// dashboard updates over realtime), the button is replaced by an
// "Acknowledged by …" line, and the tapper sees a short confirmation.
// Sending /chatid to the bot replies with the chat's id, for TELEGRAM_CHAT_ID.
import { ackLine } from '@/lib/ayn/notify'
import { supabaseAdmin } from '@/lib/ayn/supabase-admin'
import { ACK_PREFIX, telegram, webhookSecret } from '@/lib/ayn/telegram'

export const dynamic = 'force-dynamic'

interface TgUser {
  first_name?: string
  last_name?: string
  username?: string
}

interface TgMessage {
  message_id: number
  chat: { id: number; title?: string }
  text?: string
  entities?: unknown[]
}

interface TgUpdate {
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage }
  message?: TgMessage & { from?: TgUser }
}

const displayName = (u: TgUser) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : 'the crew')

export async function POST(request: Request) {
  const secret = await webhookSecret()
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('Forbidden', { status: 403 })
  }
  const update = (await request.json().catch(() => null)) as TgUpdate | null

  try {
    const query = update?.callback_query
    if (query?.data?.startsWith(ACK_PREFIX)) {
      await acknowledge(query.id, query.data.slice(ACK_PREFIX.length), query.from, query.message)
    } else if (update?.message?.text && /^\/chatid(@\w+)?\b/.test(update.message.text)) {
      await telegram('sendMessage', {
        chat_id: update.message.chat.id,
        text: `This chat's id is ${update.message.chat.id}. Set it as TELEGRAM_CHAT_ID.`,
      })
    }
  } catch (err) {
    // Answer 200 regardless: Telegram retries failed webhooks, which would
    // repeat the edit. The error is still in the function logs.
    console.error('[ayn] telegram webhook', err)
  }
  return Response.json({ ok: true })
}

async function acknowledge(queryId: string, id: string, from: TgUser, message?: TgMessage) {
  const name = displayName(from)
  const now = new Date()
  let ackedBy = name
  let ackedAt = now
  let first = true

  const db = supabaseAdmin()
  if (db) {
    const { data } = await db
      .from('notifications')
      .update({ acknowledged_at: now.toISOString(), acknowledged_by: name })
      .eq('id', id)
      .is('acknowledged_at', null)
      .select('id')
    if (!data?.length) {
      // Already acknowledged (or unknown): report who got there first.
      const { data: row } = await db
        .from('notifications')
        .select('acknowledged_at, acknowledged_by')
        .eq('id', id)
        .maybeSingle()
      if (row?.acknowledged_at) {
        first = false
        ackedBy = row.acknowledged_by ?? 'the crew'
        ackedAt = new Date(row.acknowledged_at)
      }
    }
  }

  const line = ackLine(ackedBy, ackedAt)
  await telegram('answerCallbackQuery', {
    callback_query_id: queryId,
    text: first ? 'Acknowledged. The control room can see it.' : line,
  })
  if (first && message?.text) {
    // Keep the original formatting (entities) and swap the button for the line.
    await telegram('editMessageText', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: `${message.text}\n\n${line}`,
      entities: message.entities ?? [],
      link_preview_options: { is_disabled: true },
    })
  }
}
