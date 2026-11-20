import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/ayn/logo'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/ayn/auth'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ayn | Demo access',
  robots: { index: false, follow: false },
}

/** Only allow same-site paths, so ?next= cannot bounce anyone off-site. The
 * home page is public, so signing in goes to the dashboard by default. */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (await verifySessionToken(token)) redirect(safeNext(next))

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="ayn-rise w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo animated className="size-10" />
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
