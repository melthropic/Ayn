import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/ayn/auth'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ayn | Demo access',
  robots: { index: false, follow: false },
}

/** Only allow same-site paths, so ?next= cannot bounce anyone off-site. */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (await verifySessionToken(token)) redirect('/')

  const { next } = await searchParams

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="size-10 shrink-0" aria-hidden>
            <circle cx="16" cy="16" r="15" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
            <path
              d="M5 16c3-5.5 7-8 11-8s8 2.5 11 8c-3 5.5-7 8-11 8s-8-2.5-11-8Z"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
            />
            <circle cx="16" cy="16" r="3.5" fill="var(--bloom)" />
          </svg>
          <div>
            <p className="text-2xl font-semibold leading-none tracking-tight">Ayn</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Private demo</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Enter the demo password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            This dashboard is limited to the demo devices. Sign in once — this browser stays unlocked for 30 days.
          </p>
          <LoginForm next={safeNext(next)} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Early warning for algal blooms at UAE desalination intakes
        </p>
      </div>
    </main>
  )
}
