// Crew notifications: the message Ayn sends when a train needs cleaning, and
// the record the dashboard shows for it. Pure functions, shared by the API
// routes (which send) and the dashboard (which displays).

import {
  CLEANING_LIMIT,
  PLANTS,
  TRAINS,
  formatClock,
  formatHours,
  plantRisk,
  rankedTrains,
  riskStatus,
  STATUS_LABEL,
  trainStateAt,
} from './model'

export type NotificationKind = 'auto' | 'manual'

/** A row of the `notifications` table, as the dashboard reads it. */
export interface CrewNotification {
  id: string
  kind: NotificationKind
  train_id: string
  plant_id: string
  hour: number
  message: string
  sent_at: string
  delivered: boolean
  acknowledged_at: string | null
  acknowledged_by: string | null
}

export function isTrainId(id: unknown): id is string {
  return typeof id === 'string' && TRAINS.some((t) => t.id === id)
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The alert for one train at one forecast hour, as Telegram HTML plus a plain
 * text copy for the database and the dashboard.
 */
export function crewMessage(trainId: string, hour: number, kind: NotificationKind) {
  const spec = TRAINS.find((t) => t.id === trainId)
  if (!spec) throw new Error(`Unknown train ${trainId}`)
  const plant = PLANTS.find((p) => p.id === spec.plant)!
  const h = Math.max(0, Math.min(72, Math.round(hour)))
  const train = trainStateAt(spec, h)
  const risk = plantRisk(plant, h)
  const clock = formatClock(h)
  const ranked = rankedTrains(h)
  const next = ranked.find((t) => t.id !== trainId)

  const action =
    train.hoursToLimit <= 0
      ? `Clean ${trainId} now. Pressure drop is ${train.pressureDrop.toFixed(1)}%, past the ${CLEANING_LIMIT}% limit.`
      : `Clean ${trainId} within ${formatHours(train.hoursToLimit)}. Pressure drop is ${train.pressureDrop.toFixed(1)}% of the ${CLEANING_LIMIT}% limit.`
  const lines = [
    `Ayn alert: ${plant.name}, ${plant.location}`,
    `Forecast ${clock.offset} (${clock.stamp})`,
    '',
    action,
    `Intake bloom risk ${Math.round(risk * 100)}%, ${STATUS_LABEL[riskStatus(risk)].toLowerCase()}.`,
    next ? `Next in line: ${next.id}, ${formatHours(next.hoursToLimit)} to limit.` : null,
    '',
    kind === 'auto' ? 'Sent automatically when the train reached the cleaning limit.' : 'Sent from the Ayn dashboard.',
  ].filter((l): l is string => l !== null)

  const plain = lines.join('\n')
  const html = [`<b>${escapeHtml(lines[0])}</b>`, ...lines.slice(1).map(escapeHtml)].join('\n')
  return { plain, html, plantId: plant.id, hour: h }
}

/** The line Telegram shows under the message once someone acknowledges it. */
export function ackLine(name: string, at: Date) {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  }).format(at)
  return `Acknowledged by ${name} at ${time} GST`
}
