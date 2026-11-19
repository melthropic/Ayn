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
}: {
  status: Status
  label?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full transition-colors duration-500', statusBg[status])} />
      <span>{label ?? STATUS_LABEL[status]}</span>
    </span>
  )
}
