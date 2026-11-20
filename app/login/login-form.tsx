'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // A short side-to-side shake on a wrong password, skipped for reduced motion.
  function shake() {
    const form = formRef.current
    if (!form || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    form.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 380, easing: 'ease-in-out' },
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Full reload so the proxy sees the new cookie on the next request.
        window.location.assign(next)
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'That password is not right.')
      setBusy(false)
      shake()
    } catch {
      setError('Could not reach the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
      <label htmlFor="demo-password" className="text-sm font-medium">
        Password
      </label>
      <Input
        id="demo-password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'demo-password-error' : undefined}
      />
      {error && (
        <p id="demo-password-error" role="alert" className="ayn-fade text-sm text-critical">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-1 w-full" disabled={busy || password.length === 0}>
        {busy ? 'Checking…' : 'Unlock the demo'}
      </Button>
    </form>
  )
}
