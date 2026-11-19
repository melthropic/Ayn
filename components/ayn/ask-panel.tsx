'use client'

import { AlertCircle, Loader2, Mic, Square, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSpeech } from '@/hooks/use-speech'
import {
  AskError,
  askAyn,
  askBase,
  askHealth,
  normalizeTranscript,
  transcribeAudio,
  type AskHealth,
  type AskTurn,
} from '@/lib/ayn/ask'
import { formatHours, rankedTrains } from '@/lib/ayn/model'
import { cn } from '@/lib/utils'

type MicState = 'idle' | 'listening' | 'transcribing'

interface Exchange {
  id: number
  question: string
  answer?: string
  error?: string
}

interface SpeechResultAlternative {
  transcript: string
}

interface SpeechResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechResultAlternative
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function speechRecognition(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const host = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition
}

const [seedFirst, seedSecond] = rankedTrains(0)
const SEED: Exchange = {
  id: 0,
  question: 'Which train should we clean first?',
  answer: `Clean ${seedFirst.id} first. It reaches the 15% limit in ${formatHours(seedFirst.hoursToLimit)}. ${seedSecond.id} is next at ${formatHours(seedSecond.hoursToLimit)}.`,
}
const MIC_LABEL: Record<MicState, string> = { idle: 'Mic', listening: 'Listening', transcribing: 'Transcribing' }

/** What the panel says about the backend, from its last health check. */
function healthStatus(h: AskHealth): { tone: 'hint' | 'error'; text: string } {
  if (!h.ok) {
    return {
      tone: 'error',
      text: askBase()
        ? `Assistant backend not reachable at ${askBase()}. Start it from backend/ (uvicorn main:app --port 8000); Ayn keeps checking.`
        : 'The assistant API on this deployment is not answering. Ayn keeps checking.',
    }
  }
  if (!h.ai) {
    return {
      tone: 'error',
      text: `Backend is running but no model answered${h.note ? `: ${h.note}` : ''}. Press Check again once it is fixed.`,
    }
  }
  return {
    tone: 'hint',
    text: h.stt
      ? `Ready on ${h.model ?? 'the assistant'}. Ask by text or press Mic.`
      : h.note
        ? `Answers ready on ${h.model ?? 'the assistant'}; the Mic needs speech set up (${h.note}).`
        : 'Ready. Mic uses the browser speech recognition until speech-to-text is configured.',
  }
}

/** Strip symbols the speech synthesiser would read out loud. */
function forSpeech(text: string) {
  return text
    .replace(/[*#_`]/g, '')
    .replace(/%/g, ' percent')
    .replace(/mg\/m³/g, ' milligrams per cubic metre')
    .replace(/m³\/h/g, ' cubic metres per hour')
    .replace(/°C/g, ' degrees Celsius')
    .replace(/ΔP/g, ' pressure drop')
}

export function AskPanel({ hour }: { hour: number }) {
  const [text, setText] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([SEED])
  const [mic, setMic] = useState<MicState>('idle')
  const [health, setHealth] = useState<AskHealth | null>(null)
  const [checking, setChecking] = useState(true)
  const [status, setStatus] = useState<{ tone: 'hint' | 'error'; text: string }>({
    tone: 'hint',
    text: 'Try "When will the bloom reach Plant A?" or "How is B2 doing?"',
  })
  const [speakAnswers, setSpeakAnswers] = useState(false)
  const [voice, setVoice] = useState('default')
  const { voices, speaking, speak, prime, stop: stopSpeaking } = useSpeech()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const healthRef = useRef<AskHealth | null>(null)
  const checkRun = useRef(0)
  const nextId = useRef(1)
  const thinking = exchanges.some((e) => !e.answer && !e.error)

  /** Re-read the backend's state. The server is usually started after the page,
      so a single check on mount used to leave "not reachable" on screen. */
  const checkHealth = useCallback(async () => {
    const run = ++checkRun.current
    setChecking(true)
    const result = await askHealth()
    if (run !== checkRun.current) return
    const previous = healthRef.current
    healthRef.current = result
    setHealth(result)
    setChecking(false)
    // Only rewrite the status when the backend state changes, so a re-check
    // never replaces an answer or a question's error.
    if (previous && previous.ok === result.ok && previous.ai === result.ai) return
    setStatus(healthStatus(result))
  }, [])

  useEffect(() => {
    void checkHealth()
    // Poll while the backend is missing, and check again whenever the tab is
    // brought back to the front.
    const timer = window.setInterval(() => {
      const h = healthRef.current
      if (!h || !h.ok || !h.ai) void checkHealth()
    }, 10_000)
    const recheck = () => void checkHealth()
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
      checkRun.current++
    }
  }, [checkHealth])

  useEffect(
    () => () => {
      recorderRef.current?.stop()
      recognitionRef.current?.stop()
      stopSpeaking()
    },
    [stopSpeaking],
  )

  async function submit(question: string) {
    const q = question.trim()
    if (!q) {
      setStatus({ tone: 'error', text: 'Type a question or use the mic first.' })
      return
    }
    const id = nextId.current++
    // Oldest first, so the backend sees the conversation in order.
    const history: AskTurn[] = exchanges
      .filter((e) => e.answer)
      .flatMap((e) => [
        { role: 'user' as const, content: e.question },
        { role: 'assistant' as const, content: e.answer as string },
      ])
      .reverse()
    setExchanges((prev) => [{ id, question: q }, ...prev])
    setText('')
    setStatus({ tone: 'hint', text: 'Ayn is checking the numbers on screen.' })
    try {
      const answer = await askAyn(q, hour, history)
      setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)))
      setStatus({ tone: 'hint', text: 'Answer ready. Ask a follow up any time.' })
      if (speakAnswers) speak(forSpeech(answer), voice)
    } catch (err) {
      const message = err instanceof AskError ? err.message : 'Something went wrong. Try again.'
      setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, error: message } : e)))
      setStatus({ tone: 'error', text: message })
      // A failed call usually means the backend changed under us: re-read it so
      // the banner stops saying "Ready" (or starts saying it again).
      void checkHealth()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Unlock speech inside this tap: phones refuse to speak later otherwise.
    if (speakAnswers) prime()
    if (!thinking) submit(text)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
  }

  /** Record locally, then let the backend's Whisper model transcribe it. */
  async function startRecording() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setMic('idle')
      setStatus({
        tone: 'error',
        text:
          name === 'NotAllowedError'
            ? 'Microphone blocked. Allow it in the address bar, then press Mic again.'
            : name === 'NotFoundError'
              ? 'No microphone found. Check the input device in your sound settings.'
              : 'Could not start the microphone.',
      })
      return
    }

    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    context.createMediaStreamSource(stream).connect(analyser)
    const buffer = new Uint8Array(analyser.fftSize)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }

    const startedAt = Date.now()
    let spoke = false
    let quietMs = 0
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(buffer)
      let energy = 0
      for (const v of buffer) {
        const x = (v - 128) / 128
        energy += x * x
      }
      if (Math.sqrt(energy / buffer.length) > 0.03) {
        if (!spoke) setStatus({ tone: 'hint', text: 'Hearing you…' })
        spoke = true
        quietMs = 0
      } else if (spoke) {
        quietMs += 100
      }
      if (
        (spoke && quietMs >= 1300) ||
        Date.now() - startedAt > 15_000 ||
        (!spoke && Date.now() - startedAt > 8000)
      ) {
        recorder.stop()
      }
    }, 100)

    recorder.onstop = () => {
      window.clearInterval(timer)
      stream.getTracks().forEach((track) => track.stop())
      void context.close()
      recorderRef.current = null
      if (!spoke) {
        setMic('idle')
        setStatus({ tone: 'error', text: 'I did not hear anything. Check the microphone and try again.' })
        return
      }
      setMic('transcribing')
      setStatus({ tone: 'hint', text: 'Transcribing what you said.' })
      transcribeAudio(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        .then((heard) => {
          if (!heard) {
            setMic('idle')
            setStatus({ tone: 'error', text: 'Nothing was recognised. Try again.' })
            return
          }
          setMic('idle')
          setStatus({ tone: 'hint', text: `Heard: ${heard}` })
          void submit(heard)
        })
        .catch((err: unknown) => {
          setMic('idle')
          setStatus({
            tone: 'error',
            text: err instanceof AskError ? err.message : 'Transcription failed.',
          })
        })
    }

    recorder.start()
    setMic('listening')
    setStatus({ tone: 'hint', text: 'Listening. Start speaking.' })
  }

  /** Fallback for a backend without faster-whisper: Chrome and Edge can listen. */
  function startBrowserSpeech(Recognition: SpeechRecognitionCtor) {
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1
    let finalText = ''
    let lastText = ''
    let failed = false
    let timedOut = false
    let guard = 0

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        transcript += result[0]?.transcript ?? ''
        if (result.isFinal) finalText = transcript
      }
      lastText = transcript
      setText(normalizeTranscript(transcript))
    }
    recognition.onerror = (event) => {
      failed = true
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone blocked. Allow it in the address bar, then press Mic again.',
        'audio-capture': 'No microphone found. Check the input device in your sound settings.',
        network: 'Speech recognition could not reach its server. It needs internet, and some VPNs block it.',
        'no-speech': 'I did not hear anything. Try again.',
      }
      setMic('idle')
      setStatus({ tone: 'error', text: messages[event.error] ?? `Microphone error: ${event.error}` })
    }
    recognition.onend = () => {
      window.clearTimeout(guard)
      recognitionRef.current = null
      setMic('idle')
      const heard = normalizeTranscript(finalText || lastText)
      if (heard) {
        setText('')
        void submit(heard)
      } else if (!failed) {
        setStatus({
          tone: 'error',
          text: timedOut
            ? 'I did not hear anything. Press Mic and try again.'
            : 'Nothing was heard. Press Mic and try again.',
        })
      }
    }

    recognition.start()
    // Some browsers neither answer nor fail when they never get audio.
    guard = window.setTimeout(() => {
      timedOut = true
      recognition.stop()
    }, 8000)
    setMic('listening')
    setStatus({ tone: 'hint', text: 'Listening. Start speaking.' })
  }

  function toggleMic() {
    if (mic !== 'idle') {
      recorderRef.current?.stop()
      recognitionRef.current?.stop()
      return
    }
    stopSpeaking()
    const Recognition = speechRecognition()
    if (health?.stt) {
      void startRecording()
      return
    }
    if (Recognition) {
      startBrowserSpeech(Recognition)
      return
    }
    setStatus({
      tone: 'error',
      text: health?.ok
        ? health.note
          ? health.note
          : 'Voice input needs speech-to-text: set GROQ_API_KEY in .env.local (or install requirements-voice.txt when using the backend).'
        : `Voice input needs the assistant API${askBase() ? ` at ${askBase()}` : ''}.`,
    })
  }

  const voiceItems = [{ value: 'default', label: 'System voice' }, ...voices.map((v) => ({ value: v.voiceURI, label: v.name }))]

  return (
    <section aria-labelledby="ask-heading" className="rounded-xl border border-border bg-card p-5">
      <h2 id="ask-heading" className="text-lg font-semibold">
        Ask Ayn
      </h2>
      <p className="text-sm text-muted-foreground">Ask by voice or text about trains, intakes and the bloom</p>

      <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
        <label htmlFor="ask-input" className="sr-only">
          Question for Ayn
        </label>
        <Input
          id="ask-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question"
          className="h-10 flex-1"
          aria-describedby="ask-status"
          aria-invalid={status.tone === 'error' || undefined}
        />
        <div className="relative">
          {mic === 'listening' && (
            <span aria-hidden className="ayn-pulse pointer-events-none absolute inset-0 rounded-full border-2 border-critical" />
          )}
          <Button
            type="button"
            variant={mic === 'idle' ? 'outline' : 'default'}
            size="icon-lg"
            className={cn('relative rounded-full', mic === 'listening' && 'bg-critical text-background hover:bg-critical/90')}
            onClick={toggleMic}
            aria-label={mic === 'idle' ? 'Start voice input' : mic === 'listening' ? 'Listening, press to stop' : 'Transcribing, press to cancel'}
            aria-pressed={mic !== 'idle'}
          >
            {mic === 'transcribing' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          </Button>
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={thinking}>
          Ask
        </Button>
      </form>

      <div className="mt-2 flex min-h-5 items-start justify-between gap-3 text-sm">
        <p
          id="ask-status"
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={cn('flex items-start gap-1.5 text-pretty', status.tone === 'error' ? 'text-critical' : 'text-muted-foreground')}
        >
          {status.tone === 'error' && <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {status.text}
        </p>
        <span className="flex shrink-0 items-center gap-2">
          {health && (!health.ok || !health.ai) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void checkHealth()} disabled={checking}>
              {checking ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
              Check again
            </Button>
          )}
          {mic !== 'idle' && <span className="font-medium">{MIC_LABEL[mic]}</span>}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-border py-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={speakAnswers}
            onCheckedChange={(on) => {
              setSpeakAnswers(on)
              if (on) prime()
            }}
          />
          Speak answers
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={stopSpeaking} disabled={!speaking}>
          <Square className="size-3" aria-hidden />
          Stop speaking
        </Button>
        <Select
          items={voiceItems}
          value={voice}
          onValueChange={(v) => {
            setVoice(String(v))
            prime()
          }}
        >
          <SelectTrigger size="sm" className="ms-auto min-w-32" aria-label="Voice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voiceItems.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ol className="mt-4 flex max-h-[26rem] flex-col gap-4 overflow-y-auto" aria-label="Conversation, newest first" aria-live="polite">
        {exchanges.map((e) => (
          <li key={e.id} className="flex flex-col gap-2">
            <Message who="You" className="bg-muted">
              {e.question}
            </Message>
            {e.error ? (
              <Message who="Ayn" className="border border-critical/40 text-critical">
                <span className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {e.error}
                </span>
              </Message>
            ) : e.answer ? (
              <Message who="Ayn" className="border border-border">
                <span className="flex items-start gap-2">
                  <span className="flex-1 text-pretty">{e.answer}</span>
                  {/* Tap to hear it: on a phone this tap is what lets the page speak. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Read this answer aloud`}
                    onClick={() => speak(forSpeech(e.answer as string), voice)}
                  >
                    <Volume2 className="size-3.5" aria-hidden />
                  </Button>
                </span>
              </Message>
            ) : (
              <Message who="Ayn" className="border border-border text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {'Thinking\u2026'}
                </span>
              </Message>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Message({ who, className, children }: { who: 'You' | 'Ayn'; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg px-3.5 py-2.5 text-sm', who === 'You' && 'ms-8', who === 'Ayn' && 'me-8', className)}>
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{who}</p>
      <div className="text-pretty">{children}</div>
    </div>
  )
}
