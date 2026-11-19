// Demo access gate.
//
// One shared password (`AYN_DEMO_PASSWORD`) unlocks the dashboard for 30 days
// via an HMAC-signed, httpOnly cookie. The signature key is
// `AYN_SESSION_SECRET`, or the password itself when that is not set.
//
// Used by proxy.ts (every request), /api/auth/login and /api/auth/logout. Web
// Crypto keeps it runtime-agnostic; nothing here is client-side.

export const SESSION_COOKIE = 'ayn_demo'
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days, in seconds

const encoder = new TextEncoder()

/** The gate is only active when a password is configured. */
export function gatePassword(): string | null {
  const value = process.env.AYN_DEMO_PASSWORD?.trim()
  return value ? value : null
}

function sessionSecret(): string | null {
  return process.env.AYN_SESSION_SECRET?.trim() || gatePassword()
}

async function hmacHex(message: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `expires.signature`, where the signature covers the expiry. */
export async function createSessionToken(now = Date.now()): Promise<string> {
  const key = sessionSecret()
  if (!key) throw new Error('AYN_DEMO_PASSWORD is not set.')
  const expires = String(now + SESSION_MAX_AGE * 1000)
  return `${expires}.${await hmacHex(`ayn-session:${expires}`, key)}`
}

function equalText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  const key = sessionSecret()
  if (!key || !token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expires = Number(payload)
  if (!Number.isFinite(expires) || expires <= Date.now()) return false
  return equalText(await hmacHex(`ayn-session:${payload}`, key), signature)
}

/** Constant-time-ish password check: compare digests, not the strings. */
export async function checkPassword(input: string): Promise<boolean> {
  const expected = gatePassword()
  if (!expected) return false
  const [given, wanted] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(input)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const a = new Uint8Array(given)
  const b = new Uint8Array(wanted)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
