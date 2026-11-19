'use client'

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { CLEANING_LIMIT, HORIZON_HOURS, type ForecastPoint } from '@/lib/ayn/model'

const config = {
  median: { label: 'Median', color: 'var(--primary)' },
  band: { label: 'P10 to P90', color: 'var(--primary)' },
} satisfies ChartConfig

export function ForecastChart({ data, hour }: { data: ForecastPoint[]; hour: number }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey="hour"
          type="number"
          domain={[-24, HORIZON_HOURS]}
          ticks={[-24, 0, 24, 48, 72]}
          tickFormatter={(h: number) => (h === 0 ? 'Now' : `${h > 0 ? '+' : ''}${h} h`)}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 20]}
          ticks={[0, 5, 10, 15, 20]}
          tickFormatter={(v: number) => `${v}%`}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => {
                const h = p?.[0]?.payload?.hour as number
                return h === 0 ? 'Now' : `${h > 0 ? '+' : ''}${h} h`
              }}
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{name === 'band' ? 'P10 to P90' : 'Median'}</span>
                  <span className="tabular-nums">
                    {Array.isArray(value) ? `${value[0]}% to ${value[1]}%` : `${value}%`}
                  </span>
                </span>
              )}
            />
          }
        />
        <Area dataKey="band" stroke="none" fill="var(--color-band)" fillOpacity={0.18} isAnimationActive={false} />
        <Line dataKey="median" stroke="var(--color-median)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceLine
          y={CLEANING_LIMIT}
          stroke="var(--critical)"
          strokeDasharray="5 4"
          label={{ value: `${CLEANING_LIMIT}% cleaning limit`, position: 'insideTopRight', fill: 'var(--critical)', fontSize: 12 }}
        />
        <ReferenceLine
          x={Math.round(hour / 3) * 3}
          stroke="var(--foreground)"
          strokeOpacity={0.6}
          label={{ value: 'Now', position: 'insideTopLeft', fill: 'var(--foreground)', fontSize: 12 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
