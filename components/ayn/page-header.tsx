import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

interface Props {
  /** Present when Supabase live mode is configured. */
  live?: {
    enabled: boolean
    connected: boolean
  }
}

export function PageHeader({ live }: Props) {
  const status = !live?.enabled
    ? { label: 'Simulated plant data', dot: 'bg-watch', live: false }
    : !live.connected
      ? { label: 'Live · connecting', dot: 'bg-watch', live: false }
      : { label: 'Live · Supabase', dot: 'bg-healthy', live: true }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Ayn home" className="rounded-full">
          <Logo animated className="size-9" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Ayn</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            Early warning for algal blooms at UAE desalination intakes
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn(
            'h-7 gap-1.5 rounded-full px-3 text-xs font-normal text-muted-foreground',
            status.live && 'border-healthy/40 text-foreground',
          )}
        >
          <span aria-hidden className={cn('relative flex size-1.5')}>
            {status.live && (
              <span className="absolute inline-flex size-full animate-pulse rounded-full bg-healthy opacity-60" />
            )}
            <span className={cn('relative inline-flex size-1.5 rounded-full', status.dot)} />
          </span>
          {status.label}
        </Badge>
        <ThemeToggle />
      </div>
    </header>
  )
}
