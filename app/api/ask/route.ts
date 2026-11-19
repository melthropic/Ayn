// Ask Ayn's answers, served from the same origin as the dashboard.
//
// Takes the question plus a snapshot of the numbers on screen and answers from
// Groq's fastest production model. The system prompt matches the optional
// Python backend in backend/main.py (ASK_SYSTEM) so both services behave the
// same, and answers stay short and speakable.
import { buildSnapshot } from '@/lib/ayn/ask'
import { groqChat, type ChatTurn } from '@/lib/ayn/server-groq'

export const dynamic = 'force-dynamic'
// Generous but bounded: Groq usually answers in under a few seconds.
export const maxDuration = 30

const ASK_SYSTEM = `You are Ayn, the voice assistant for a seawater reverse-osmosis desalination plant dashboard. ` +
  `You receive the live dashboard data as JSON and answer the operator's question from that data only.\n` +
  `Rules:\n` +
  `- Quote the real numbers with units. The cleaning limit is data.cleaning_limit_pct percent pressure drop above the clean baseline.\n` +
  `- Time to clean comes from hours_to_clean. If reaches_limit_within_72h is true, give hours_to_limit_p50 and the likely_window_h range, ` +
  `and say it is an estimate. If it is false, the train is not expected to reach the limit within the 72 hour forecast window: say so, ` +
  `give its current pressure drop and points_below_limit, and mention possible_as_early_as_h if it is set. ` +
  `Never say that no estimate exists just because the train is healthy.\n` +
  `- clean_first_order lists train IDs from most to least urgent. Use it for questions about which train to clean first.\n` +
  `- The data is simulated. If asked, say so.\n` +
  `- There are no per-pipe sensors. If asked about a specific pipe, say there is no reading for that pipe, explain what that line does ` +
  `in a reverse-osmosis plant, and give the nearest real numbers (train pressure drop, flux, recovery, intake risk).\n` +
  `- If a number is not in the data, say you do not have it. Never invent values.\n` +
  `- The question may come from speech recognition and contain mishearings. Read it using the dashboard vocabulary: ` +
  `'strain A3' means 'train A3', 'cleaning women' or 'cleaning lemon' means 'cleaning limit', and 'a three' or 'bee two' are train IDs.\n` +
  `- Reply in the same language the question was asked in.\n` +
  `- Use a warm, friendly, natural tone, like a helpful colleague, and keep it professional.\n` +
  `- The answer will be read aloud: two to four short sentences, no markdown, no lists, no symbols. ` +
  `Write percent, cubic metres per hour, degrees Celsius, and pressure drop in words.\n` +
  `Dashboard data:\n`

interface AskBody {
  question?: unknown
  data?: unknown
  hour?: unknown
  history?: unknown
  lang?: unknown
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AskBody | null
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (!question) {
    return Response.json({ error: 'No question was sent.' }, { status: 400 })
  }

  // The dashboard sends its own snapshot (the same payload the Python backend
  // takes); the hour lets the route rebuild it when it is missing.
  const hour = typeof body?.hour === 'number' && Number.isFinite(body.hour) ? body.hour : 0
  const data =
    body?.data && typeof body.data === 'object' ? body.data : buildSnapshot(hour)
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter(
      (turn): turn is { role: 'user' | 'assistant'; content: string } =>
        typeof turn === 'object' &&
        turn !== null &&
        ((turn as { role?: unknown }).role === 'user' || (turn as { role?: unknown }).role === 'assistant') &&
        typeof (turn as { content?: unknown }).content === 'string',
    )
    .slice(-6)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, 1500),
    }))

  const messages: ChatTurn[] = [
    { role: 'system', content: ASK_SYSTEM + JSON.stringify(data) },
    ...history,
    { role: 'user', content: question },
  ]

  try {
    const answer = await groqChat(messages)
    return Response.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The model call failed.'
    return Response.json({ error: message }, { status: 503 })
  }
}
