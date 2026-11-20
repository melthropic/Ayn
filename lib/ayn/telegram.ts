// Telegram Bot API, server side only.
//
//   TELEGRAM_BOT_TOKEN   from @BotFather
//   TELEGRAM_CHAT_ID     the crew group (or a person) the bot posts to
//
// The webhook that receives "Acknowledge" taps checks Telegram's secret-token
// header. The secret is derived from the bot token, so there is nothing extra
// to configure.

const API_BASE = process.env.TELEGRAM_API_BASE?.trim() || 'https://api.telegram.org'

export function telegramToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

export function telegramChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID?.trim() || null
}

export function telegramConfigured(): boolean {
  return Boolean(telegramToken() && telegramChatId())
}

/** The value Telegram sends back in X-Telegram-Bot-Api-Secret-Token. */
export async function webhookSecret(): Promise<string | null> {
  const token = telegramToken()
  if (!token) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ayn-webhook:${token}`))
  // Telegram allows A-Z, a-z, 0-9, _ and -, up to 256 characters.
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export async function telegram<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = telegramToken()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set.')
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => null)) as TelegramResponse<T> | null
  if (!data?.ok) throw new Error(`Telegram ${method} failed: ${data?.description ?? res.status}`)
  return data.result as T
}

export const ACK_PREFIX = 'ack:'

/** Post an alert with an Acknowledge button. Returns Telegram's message id. */
export async function sendAlert(html: string, ackId: string): Promise<{ chatId: string; messageId: number }> {
  const chatId = telegramChatId()
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not set.')
  const message = await telegram<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: 'Acknowledge', callback_data: `${ACK_PREFIX}${ackId}` }]] },
  })
  return { chatId, messageId: message.message_id }
}
