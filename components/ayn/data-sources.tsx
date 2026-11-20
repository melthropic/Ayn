import { Badge } from '@/components/ui/badge'

const GROUPS = [
  {
    badge: 'Simulated in this demo',
    dot: 'bg-watch',
    items: [
      { name: 'Bloom drift', source: 'Stylised patch drifting along the UAE coast', date: '72 h scenario' },
      { name: 'Plant telemetry', source: '12 invented trains across 3 plants', date: 'Generated hourly' },
      { name: 'Fouling model', source: 'Rule based pressure drop curve', date: 'Not calibrated' },
    ],
  },
  {
    badge: 'Real data in the first prototype',
    dot: 'bg-healthy',
    items: [
      {
        name: 'Satellite chlorophyll',
        source: 'NOAA CoastWatch, VIIRS and Sentinel-3 OLCI merged, 9 km',
        date: 'Daily',
      },
      { name: 'Ocean currents', source: 'HYCOM/NCODA surface currents', date: 'Daily' },
    ],
  },
]

export function DataSources() {
  return (
    <section aria-labelledby="sources-heading" className="rounded-xl border border-border bg-card p-5">
      <h2 id="sources-heading" className="text-lg font-semibold">
        Data sources
      </h2>
      <div className="mt-4 flex flex-col gap-5">
        {GROUPS.map((g) => (
          <div key={g.badge}>
            <Badge variant="outline" className="gap-1.5 rounded-full font-normal">
              <span aria-hidden className={`size-1.5 rounded-full ${g.dot}`} />
              {g.badge}
            </Badge>
            <ul className="mt-3 flex flex-col gap-3">
              {g.items.map((i) => (
                <li key={i.name} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium">{i.name}</span>
                    <span className="block text-muted-foreground">{i.source}</span>
                  </span>
                  <span className="shrink-0 text-end text-muted-foreground">{i.date}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground text-pretty">
        This dashboard runs a simulated scenario so the 72 hours can be replayed on cue. The first prototype, a single
        page in this project, read real satellite chlorophyll and currents. Satellite views miss blooms under cloud and
        at depth, so use the rankings to plan, not to replace on site readings.
      </p>
    </section>
  )
}
