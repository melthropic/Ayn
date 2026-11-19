'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    } catch {
      setError('Could not reach the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
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
        <p id="demo-password-error" role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-1 w-full" disabled={busy || password.length === 0}>
        {busy ? 'Checking…' : 'Unlock the demo'}
      </Button>
    </form>
  )
}
