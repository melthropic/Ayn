// Speech-to-text for the Ask Ayn Mic, served from the same origin.
//
// The browser records webm/opus (see components/ayn/ask-panel.tsx) and posts
// the raw bytes here, exactly like the Python backend's /api/transcribe. The
// recording goes to Groq's Whisper large v3, biased with the dashboard's
// vocabulary prompt; a fast correction pass then fixes the remaining
// mishearings ("urfi health" -> "overall health") before the question is
// answered. lib/ayn/ask.ts cleans up the usual train-ID mishearings too.
import { correctTranscript, groqTranscribe } from '@/lib/ayn/server-groq'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Same idea as backend/main.py (STT_PROMPT), widened with the question
// phrasings operators actually use, so Whisper prefers them over invented
// words for "overall health", "fleet" and friends.
const STT_PROMPT =
  'Ayn dashboard for reverse osmosis desalination. Train A1, A2, A3, A4, A5, B1, B2, B3, B4, C1, C2, C3. ' +
  'Plant A, Plant B, Plant C. Overall health, fleet health, intake risk, bloom forecast, chlorophyll, red tide. ' +
  'Cleaning limit, pressure drop, permeate flow, brine, membrane vessel, feed pressure, ' +
  'salt passage, flux, recovery, silt density index, SDI, intake, pretreatment, flotation, energy recovery, clean in place. ' +
  'Give me information about. Give me a summary of. How is. What is the. When will. Which train.'

export async function POST(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang') ?? 'en'
  const audio = await request.blob()
  if (audio.size < 500) {
    return Response.json({ error: 'No audio received.' }, { status: 400 })
  }

  // MediaRecorder mimes look like "audio/webm;codecs=opus" — strip parameters
  // and pick an extension the API recognises.
  const mime = (audio.type || 'audio/webm').split(';')[0].trim()
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : mime.includes('mp4') ? 'm4a' : 'webm'
  try {
    const heard = await groqTranscribe(audio, `question.${ext}`, { language: lang, prompt: STT_PROMPT })
    const text = await correctTranscript(heard)
    return Response.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed.'
    return Response.json({ error: message }, { status: 503 })
  }
}
