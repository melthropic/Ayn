// One-time Telegram setup. Open /api/notify/setup in a signed-in browser after
// deploying with TELEGRAM_BOT_TOKEN set. It:
//   1. lists the chats the bot has seen (add the bot to the crew group and
//      send it any message first), so you can copy TELEGRAM_CHAT_ID;
//   2. points the bot's webhook at this deployment's /api/telegram, which is
//      what makes the Acknowledge button work.
// Run it again whenever the deployment URL changes.
import { telegram, telegramChatId, telegramToken, webhookSecret } from '@/lib/ayn/telegram'

export const dynamic = 'force-dynamic'

interface TgChat {
  id: number
  type: string
  title?: string
  first_name?: string
  username?: string
}

interface TgUpdate {
  message?: { chat: TgChat }
  my_chat_member?: { chat: TgChat }
  callback_query?: { message?: { chat: TgChat } }
}

export async function GET(request: Request) {
  if (!telegramToken()) {
    return Response.json(
      { ok: false, error: 'TELEGRAM_BOT_TOKEN is not set. Add it in Vercel, redeploy, then open this page again.' },
      { status: 503 },
    )
  }
  try {
    const bot = await telegram<{ username: string }>('getMe')

    // getUpdates only works while no webhook is set, so clear it first.
    await telegram('deleteWebhook', { drop_pending_updates: false })
    const updates = await telegram<TgUpdate[]>('getUpdates', { timeout: 0, limit: 100 })
    const chats = new Map<number, { id: number; type: string; name: string }>()
    for (const u of updates) {
      const chat = u.message?.chat ?? u.my_chat_member?.chat ?? u.callback_query?.message?.chat
      if (chat)
        chats.set(chat.id, { id: chat.id, type: chat.type, name: chat.title ?? chat.first_name ?? chat.username ?? '' })
    }

    const forwardedHost = request.headers.get('x-forwarded-host')
    const origin = forwardedHost ? `https://${forwardedHost}` : new URL(request.url).origin
    const webhook = `${origin}/api/telegram`
    await telegram('setWebhook', {
      url: webhook,
      secret_token: await webhookSecret(),
      allowed_updates: ['callback_query', 'message'],
    })

    return Response.json({
      ok: true,
      bot: `@${bot.username}`,
      webhook,
      chatIdConfigured: telegramChatId(),
      chatsSeen: [...chats.values()],
      next: telegramChatId()
        ? 'Done. Press Notify crew on the dashboard to test.'
        : 'Copy the id of your crew group from chatsSeen into TELEGRAM_CHAT_ID, redeploy, and open this page once more. No chats listed? Add the bot to the group, send it a message, and reload. You can also send /chatid in the group.',
    })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
