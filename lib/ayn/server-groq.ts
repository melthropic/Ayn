// Server-side Groq client for the Next.js API routes.
//
// Runs only inside app/api/* route handlers — GROQ_API_KEY stays on the
// server and never reaches the browser. Endpoints (OpenAI-compatible):
//
//   POST https://api.groq.com/openai/v1/chat/completions    -> Ask Ayn answers
//   POST https://api.groq.com/openai/v1/audio/transcriptions -> Mic transcription
//
// Models default to Groq's current production picks (checked Nov 2026):
//   chat: openai/gpt-oss-120b  (~500 tokens/sec — the Llama models were
//        retired from free/developer plans in Aug 2026)
//   stt:  whisper-large-v3-turbo (216x realtime; switch to whisper-large-v3
//        for maximum accuracy). Override both with env vars below.

const GROQ_BASE = 'https://api.groq.com/openai/v1'

/** Filled in .env.local (dev) or the Vercel project settings (deployed). */
export function groqKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim()
  return key ? key : null
}

export function chatModel(): string {
  return process.env.GROQ_CHAT_MODEL?.trim() || 'openai/gpt-oss-120b'
}

export function sttModel(): string {
  return process.env.GROQ_STT_MODEL?.trim() || 'whisper-large-v3'
}

export class GroqError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroqError'
  }
}

const KEY_MISSING =
  'GROQ_API_KEY is not set. Add it to the project environment variables (Vercel: Settings → Environment Variables) and redeploy — or to .env.local when running locally.'

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** One chat completion. Fast models return in a couple of seconds. */
export async function groqChat(messages: ChatTurn[], maxTokens = 500, model = chatModel()): Promise<string> {
  const key = groqKey()
  if (!key) throw new GroqError(KEY_MISSING)
  // gpt-oss models reason before answering, and reasoning shares the answer's
  // token budget: at the default effort it can crowd out or eat into the reply,
  // which is why answers came back as thinking-out-loud text. Keep reasoning
  // brief and never ship it (include_reasoning is a gpt-oss switch; other
  // model families get neither parameter).
  const gptOss = model.includes('gpt-oss')
  const reasoning = gptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}
  let res: Response
  try {
    res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        ...reasoning,
      }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new GroqError('Could not reach Groq. Check the network and try again.')
  }
  if (!res.ok) throw new GroqError(await errorText(res))
  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null
  const answer = cleanAnswer(data?.choices?.[0]?.message?.content ?? '')
  if (!answer) throw new GroqError('Groq returned an empty answer.')
  return answer
}

// Reasoning can still slip into content itself (the model sometimes writes
// "let me check the numbers…" in the answer channel when its budget runs
// short). Strip the fenced blocks and drop leading thinking-out-loud lines so
// only the spoken answer remains.
function cleanAnswer(text: string): string {
  let out = text
    .replace(/ណ[\s\S]*?and/g, '')
    .replace(/^\s*(?:analysis|reasoning|thinking)\s*[:|]\s*/i, '')
    .trim()
  // A reply that opens mid-reasoning ("Okay, so the pressure drop is…") is
  // rare but possible; the system prompt's spoken-answer style usually keeps
  // the rest readable, so leave it alone rather than guess where the answer
  // starts.
  return out
}

/** Whisper transcription for one recording. webm/opus from the browser works. */
export async function groqTranscribe(
  audio: Blob,
  filename: string,
  opts: { language?: string; prompt?: string } = {},
): Promise<string> {
  const key = groqKey()
  if (!key) throw new GroqError(KEY_MISSING)
  const form = new FormData()
  form.append('file', audio, filename)
  form.append('model', sttModel())
  form.append('response_format', 'json')
  form.append('temperature', '0')
  if (opts.language && opts.language !== 'auto') form.append('language', opts.language)
  if (opts.prompt) form.append('prompt', opts.prompt)
  let res: Response
  try {
    res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
    })
  } catch {
    throw new GroqError('Could not reach Groq with the recording. Check the network and try again.')
  }
  if (!res.ok) throw new GroqError(await errorText(res))
  const data = (await res.json().catch(() => null)) as { text?: string } | null
  return (data?.text ?? '').trim()
}

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? `Groq answered HTTP ${res.status}.`
}

// Whisper mishearings ("urfi health" for "overall health", "foetus" for
// "fleet") read as nonsense to the answering model, which then refuses the
// question. A fast second pass fixes only the words that are clearly wrong —
// something no word-list can do, since mishearings differ every time.
const CORRECTOR_MODEL = process.env.GROQ_CORRECT_MODEL?.trim() || 'openai/gpt-oss-20b'

const CORRECTION_SYSTEM = `You fix speech-recognition mishearings for a voice assistant on a seawater reverse-osmosis desalination dashboard. The transcript often mangles the dashboard's vocabulary. Dashboard words: Train A1, A2, A3, A4, A5, B1, B2, B3, B4, C1, C2, C3 (spoken as "A one", "A three", "bee two"); Plant A, Plant B, Plant C; bloom, chlorophyll, red tide, intake, pretreatment, flotation; cleaning limit, pressure drop, permeate, brine, flux, recovery, salt passage, silt density index, SDI, feed pressure, membrane, vessel, energy recovery, clean in place, MIGD, fleet health, overall health.
Correct only the words that are clearly mishearings so the question fits this dashboard. Change as little as possible: keep the sentence structure, language and every word that already makes sense. Never invent topics, numbers or new questions. If the transcript is already sensible, return it unchanged. If it is unintelligible, return the most likely intended dashboard question.
Reply with the corrected question only: no quotes, no explanation.`

export async function correctTranscript(raw: string): Promise<string> {
  const text = raw.trim()
  if (!text) return text
  try {
    const fixed = await groqChat(
      [
        { role: 'system', content: CORRECTION_SYSTEM },
        { role: 'user', content: text },
      ],
      150,
      CORRECTOR_MODEL,
    )
    // The corrector occasionally wraps its answer in quotes.
    return fixed.replace(/^["'\u201c]+|["'\u201d]+$/g, '').trim() || text
  } catch {
    // Correction is best-effort: an unavailable corrector must never lose a
    // working transcription.
    return text
  }
}
