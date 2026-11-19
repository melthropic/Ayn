import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPassword,
  createSessionToken,
  gatePassword,
} from '@/lib/ayn/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!gatePassword()) {
    return NextResponse.json({ error: 'The demo password is not configured.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!password || !(await checkPassword(password))) {
    // Slow down guessing without locking anyone out.
    await new Promise((resolve) => setTimeout(resolve, 350))
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
