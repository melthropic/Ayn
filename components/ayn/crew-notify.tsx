'use client'

import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrewNotification } from '@/lib/ayn/notify'
import type { PendingSend } from '@/lib/ayn/use-crew-notify'
import { cn } from '@/lib/utils'

export interface CrewProps {
  trainId: string
  /** Latest recorded alert for this train (Supabase), if any. */
  row: CrewNotification | null
  /** This device's own send, if it started one. */
  pending: PendingSend | null
  /** Acknowledgements come back live only when alerts are recorded. */
  tracking: boolean
  /** Make the button the primary action (when there is something to act on). */
  urgent: boolean
  onNotify: () => void
}

const clock = (at: string | number) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(new Date(at))

type Line = { key: string; tone: 'muted' | 'watch' | 'healthy' | 'critical'; text: string }

function statusLine({ row, pending, tracking }: CrewProps): Line | null {
  const rowAt = row ? Date.parse(row.sent_at) : 0
  // A send in flight, or one that failed after the last recorded alert, wins.
  if (pending?.state === 'sending' && pending.at > rowAt - 2000) {
    return { key: 'sending', tone: 'muted', text: 'Sending to the crew on Telegram…' }
  }
  if (pending?.state === 'failed' && pending.at > rowAt) {
    return { key: `failed-${pending.at}`, tone: 'critical', text: pending.error ?? 'The alert was not sent.' }
  }
  if (row) {
    if (row.acknowledged_at) {
      return {
        key: `ack-${row.id}`,
        tone: 'healthy',
        text: `Acknowledged by ${row.acknowledged_by ?? 'the crew'} at ${clock(row.acknowledged_at)} GST`,
      }
    }
    const how = row.kind === 'auto' ? 'Sent automatically' : 'Sent to the crew'
    return {
      key: `sent-${row.id}`,
      tone: 'watch',
      text: `${how} at ${clock(row.sent_at)} GST, waiting for acknowledgement`,
    }
  }
  if (pending?.state === 'sent') {
    return {
      key: `sent-${pending.at}`,
      tone: 'watch',
      text: tracking
        ? `Sent to the crew at ${clock(pending.at)} GST, waiting for acknowledgement`
        : `Sent to the crew at ${clock(pending.at)} GST`,
    }
  }
  return null
}

const DOT: Record<Line['tone'], string> = {
  muted: 'bg-muted-foreground',
  watch: 'bg-watch',
  healthy: 'bg-healthy',
  critical: 'bg-critical',
}

/** The Notify crew button and the alert's status, under the recommendation. */
export function CrewNotify(props: CrewProps) {
  const line = statusLine(props)
  const sending = line?.key === 'sending'
  const sentAlready = Boolean(props.row) || props.pending?.state === 'sent'

  return (
    <>
      <Button
        size="sm"
        variant={props.urgent ? 'default' : 'outline'}
        className={cn('gap-1.5', !props.urgent && 'bg-card')}
        onClick={props.onNotify}
        disabled={sending}
      >
        {sending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Send className="size-3.5" aria-hidden />
        )}
        {sentAlready ? 'Notify again' : 'Notify crew'}
      </Button>
      {line && (
        <p
          key={line.key}
          className={cn(
            'order-last flex w-full items-start gap-2 pt-1 text-sm',
            line.tone === 'healthy' ? 'ayn-pop text-foreground' : 'ayn-fade',
            line.tone === 'critical' ? 'text-critical' : line.tone !== 'healthy' && 'text-muted-foreground',
          )}
        >
          <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[line.tone])} />
          <span className="text-pretty">{line.text}</span>
        </p>
      )}
    </>
  )
}
