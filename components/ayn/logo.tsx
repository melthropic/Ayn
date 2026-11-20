import { cn } from '@/lib/utils'

/** The Ayn mark: an eye inside a ring. `animated` draws the strokes in once on mount. */
export function Logo({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0 overflow-visible', className)} aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        pathLength={100}
        className={cn(animated && 'ayn-draw')}
        transform="rotate(-90 16 16)"
      />
      <g>
        <path
          d="M5 16c3-5.5 7-8 11-8s8 2.5 11 8c-3 5.5-7 8-11 8s-8-2.5-11-8Z"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          pathLength={100}
          className={cn(animated && 'ayn-draw')}
          style={animated ? ({ '--ayn-delay': '250ms' } as React.CSSProperties) : undefined}
        />
        <circle
          cx="16"
          cy="16"
          r="3.5"
          fill="var(--bloom)"
          className={cn(animated && 'ayn-iris-in')}
          style={animated ? ({ '--ayn-delay': '900ms' } as React.CSSProperties) : undefined}
        />
      </g>
    </svg>
  )
}
