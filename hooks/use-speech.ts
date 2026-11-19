'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const EMPTY: SpeechSynthesisVoice[] = []
let cached: SpeechSynthesisVoice[] = EMPTY

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => {}
  const update = () => {
    cached = window.speechSynthesis.getVoices().filter((v) => /^(en|ar)/i.test(v.lang))
    onChange()
  }
  update()
  window.speechSynthesis.addEventListener('voiceschanged', update)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
}

export function useSpeech() {
  const voices = useSyncExternalStore(subscribe, () => cached, () => EMPTY)
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback(
    (text: string, voiceURI: string) => {
      if (!('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const voice = voices.find((v) => v.voiceURI === voiceURI)
      if (voice) u.voice = voice
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    },
    [voices],
  )

  /** iPhones only let the page speak later if speech was first started inside
      a tap. Answers arrive tens of seconds after the tap that asked for them,
      so the switch and the Ask button start a silent utterance to unlock it. */
  const prime = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => stop, [stop])

  return { voices, speaking, speak, prime, stop }
}
