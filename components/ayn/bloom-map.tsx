'use client'

import { useId, useMemo } from 'react'
import {
  HORIZON_HOURS,
  PLANTS,
  STATUS_LABEL,
  bloomAt,
  plantRisk,
  riskStatus,
  type Plant,
} from '@/lib/ayn/model'
import { statusVar } from './status-dot'

const LAND =
  'M0,372 C60,368 120,382 180,366 C230,352 270,350 318,348 C360,346 400,322 440,300 C490,276 530,258 560,250 C600,234 640,202 680,170 C710,144 735,112 755,82 C770,60 782,40 792,24 C800,32 806,50 812,72 C820,112 828,162 836,212 C842,252 846,282 846,302 C850,342 866,392 884,460 L0,460 Z'
const QATAR = 'M0,176 C30,186 52,226 48,276 C46,316 24,338 0,344 Z'
const ISLANDS = [
  { cx: 268, cy: 338, rx: 14, ry: 5 },
  { cx: 236, cy: 330, rx: 9, ry: 4 },
  { cx: 384, cy: 318, rx: 7, ry: 3 },
  { cx: 150, cy: 322, rx: 10, ry: 4 },
]
const CURRENTS = [
  'M150,120 C220,130 290,150 350,180',
  'M420,70 C480,90 520,120 560,160',
  'M120,240 C180,250 230,262 280,286',
  'M900,120 C910,170 920,220 930,270',
]

const LABEL_LAYOUT: Record<Plant['id'], { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }> = {
  A: { dx: 26, dy: 30, anchor: 'start' },
  B: { dx: 0, dy: 44, anchor: 'middle' },
  C: { dx: -28, dy: 30, anchor: 'end' },
}

interface Props {
  hour: number
  /** 0–1, multiplies the bloom opacity. The home page fades it out and back in when its loop restarts. */
  bloomFade?: number
}

export function BloomMap({ hour, bloomFade = 1 }: Props) {
  const uid = useId().replace(/:/g, '')
  const bloom = bloomAt(hour)

  const track = useMemo(() => {
    const pts: string[] = []
    for (let h = 0; h <= HORIZON_HOURS; h += 3) {
      const b = bloomAt(h)
      pts.push(`${b.x.toFixed(1)},${b.y.toFixed(1)}`)
    }
    return `M${pts.join(' L')}`
  }, [])
  const markers = useMemo(() => [24, 48, 72].map((h) => ({ h, ...bloomAt(h) })), [])

  const plants = PLANTS.map((p) => {
    const risk = plantRisk(p, hour)
    return { plant: p, risk, status: riskStatus(risk) }
  })

  const description = `Bloom at forecast hour ${Math.round(hour)}, drifting south east toward Plant A. ${plants
    .map((p) => `${p.plant.name}, ${p.plant.location}: ${STATUS_LABEL[p.status]}, intake risk ${Math.round(p.risk * 100)} percent.`)
    .join(' ')}`

  return (
    <svg
      viewBox="0 0 1000 460"
      preserveAspectRatio="xMidYMid slice"
      className="block size-full"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
    >
      <title id={`${uid}-title`}>Bloom forecast map of the UAE coast</title>
      <desc id={`${uid}-desc`}>{description}</desc>
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="var(--bloom)" stopOpacity="0.55" />
          <stop offset="45%" stopColor="var(--bloom)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--bloom)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <mask id={`${uid}-water`}>
          <rect width="1000" height="460" fill="white" />
          <path d={LAND} fill="black" />
          <path d={QATAR} fill="black" />
        </mask>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,1 L8,5 L0,9" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" />
        </marker>
      </defs>

      <rect width="1000" height="460" fill="var(--map-water)" />
      <g stroke="var(--map-grid)" strokeWidth="1">
        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1="0" y2="460" />
        ))}
        {[100, 200, 300, 400].map((y) => (
          <line key={`h${y}`} x1="0" x2="1000" y1={y} y2={y} />
        ))}
      </g>

      <g fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="1.25" markerEnd={`url(#${uid}-arrow)`}>
        {CURRENTS.map((d) => (
          <path key={d} d={d} className="ayn-current" />
        ))}
      </g>

      <path d={LAND} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth="1.5" />
      <path d={QATAR} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth="1.5" />
      {ISLANDS.map((i) => (
        <ellipse key={i.cx} {...i} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth="1" />
      ))}

      <g fill="var(--muted-foreground)" fontSize="15" letterSpacing="0.5">
        <text x="200" y="170">Arabian Gulf</text>
        <text x="935" y="390" textAnchor="middle">Gulf of Oman</text>
        <text x="620" y="400" fontSize="20" opacity="0.7">United Arab Emirates</text>
        <text x="776" y="214" textAnchor="middle" opacity="0.7">Oman</text>
      </g>

      <g mask={`url(#${uid}-water)`}>
        <path
          d={track}
          fill="none"
          stroke="var(--bloom)"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          className="ayn-flow"
        />
        {markers.map((m) => (
          <g key={m.h}>
            <circle cx={m.x} cy={m.y} r="3" fill="var(--bloom)" opacity="0.7" />
          </g>
        ))}
        <g
          transform={`translate(${bloom.x} ${bloom.y}) rotate(${bloom.rotation}) scale(${bloom.radius / 50})`}
          opacity={bloom.intensity * bloomFade}
        >
          <ellipse rx="110" ry="74" fill={`url(#${uid}-glow)`} />
          <g fill="var(--bloom)" filter={`url(#${uid}-soft)`}>
            <path
              d="M-48,-6 C-46,-30 -14,-40 10,-34 C34,-28 52,-14 50,6 C48,26 24,36 2,34 C-22,32 -50,18 -48,-6Z"
              opacity="0.55"
            />
            <ellipse cx="-58" cy="16" rx="16" ry="7" opacity="0.4" />
            <ellipse cx="54" cy="-26" rx="12" ry="6" opacity="0.4" />
            <ellipse cx="6" cy="-2" rx="22" ry="14" opacity="0.6" />
          </g>
        </g>
      </g>

      <g fill="var(--bloom)" fontSize="12">
        {markers.map((m) => (
          <text key={m.h} x={m.x + 8} y={m.y - 8} opacity="0.85" className="tabular-nums">
            {`+${m.h} h`}
          </text>
        ))}
      </g>

      {plants.map(({ plant, risk, status }) => {
        const color = statusVar[status]
        const layout = LABEL_LAYOUT[plant.id]
        const tx = plant.x + layout.dx
        return (
          <g key={plant.id}>
            {status === 'critical' && (
              <circle
                cx={plant.x}
                cy={plant.y}
                r="18"
                fill="none"
                stroke={color}
                strokeWidth="2"
                className="ayn-pulse"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            )}
            <circle
              cx={plant.x}
              cy={plant.y}
              r="18"
              fill={color}
              fillOpacity="0.14"
              stroke={color}
              strokeWidth="2"
              style={{ transition: 'stroke 500ms, fill 500ms' }}
            />
            <circle cx={plant.x} cy={plant.y} r="5" fill="var(--foreground)" />
            <text x={tx} y={plant.y + layout.dy} textAnchor={layout.anchor} fill="var(--foreground)" fontSize="15" fontWeight="600">
              {plant.name}
            </text>
            <text
              x={tx}
              y={plant.y + layout.dy + 18}
              textAnchor={layout.anchor}
              fill="var(--muted-foreground)"
              fontSize="13"
              className="tabular-nums"
            >
              {`${STATUS_LABEL[status]}, ${Math.round(risk * 100)}% risk`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
