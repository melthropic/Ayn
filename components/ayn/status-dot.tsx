import { cn } from '@/lib/utils'
import { STATUS_LABEL, type Status } from '@/lib/ayn/model'

export const statusBg: Record<Status, string> = {
  healthy: 'bg-healthy',
  watch: 'bg-watch',
  critical: 'bg-critical',
}

export const statusText: Record<Status, string> = {
  healthy: 'text-healthy',
  watch: 'text-watch',
  critical: 'text-critical',
}

export const statusVar: Record<Status, string> = {
  healthy: 'var(--healthy)',
  watch: 'var(--watch)',
  critical: 'var(--critical)',
}

export function StatusDot({
  status,
  label,
  className,
  pulse = false,
}: {
  status: Status
  label?: string
  className?: string
  /** Adds an expanding ring, for items that need attention now. */
  pulse?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <span aria-hidden className="relative flex size-2 shrink-0">
        {pulse && <span className={cn('ayn-pulse absolute inline-flex size-full rounded-full', statusBg[status])} />}
        <span className={cn('relative inline-flex size-2 rounded-full transition-colors duration-500', statusBg[status])} />
      </span>
      <span>{label ?? STATUS_LABEL[status]}</span>
    </span>
  )
}
