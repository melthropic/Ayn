// Reports whether Ask Ayn is ready. Mirrors the shape the Python backend in
// backend/main.py answers with, so the UI needs no special casing:
//   { ok, ai, stt, model, note }
//
// With Groq both AI answers and speech-to-text hinge on GROQ_API_KEY, so ai
// and stt come back together. ok stays true while the route itself answers —
// only a broken deployment turns it false.
import { chatModel, sttModel } from '@/lib/ayn/server-groq'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasKey = Boolean(process.env.GROQ_API_KEY?.trim())
  if (!hasKey) {
    return Response.json({
      ok: true,
      ai: false,
      stt: false,
      model: null,
      note: 'GROQ_API_KEY is not set. Add it to the project environment variables (Vercel: Settings → Environment Variables) and redeploy — or to .env.local when running locally.',
    })
  }
  return Response.json({
    ok: true,
    ai: true,
    stt: true,
    model: `${chatModel()} · ${sttModel()}`,
    note: null,
  })
}
