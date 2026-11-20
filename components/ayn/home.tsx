'use client'

import Link from 'next/link'
import { ArrowRight, Gauge, ListOrdered, Mic, MonitorSmartphone, Waves } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { CLEANING_LIMIT, HORIZON_HOURS, PLANTS, TRAINS, fleetSummary } from '@/lib/ayn/model'
import { cn } from '@/lib/utils'
import { CountUp } from './count-up'
import { HeroMap } from './hero-map'
import { Logo } from './logo'
import { Reveal } from './reveal'
import { ThemeToggle } from './theme-toggle'

const delay = (ms: number) => ({ '--ayn-delay': `${ms}ms` }) as React.CSSProperties

const STEPS = [
  {
    icon: Waves,
    title: 'Bloom drift',
    body: `A chlorophyll patch drifts along the coast with the surface currents. Each intake gets a risk score for every hour of the next ${HORIZON_HOURS}.`,
  },
  {
    icon: Gauge,
    title: 'Membrane fouling',
    body: 'Pressure drop across each reverse osmosis train climbs faster when the bloom is near its intake, on top of its normal rate.',
  },
  {
    icon: ListOrdered,
    title: 'Clean order',
    body: `Trains are ranked by hours left until they reach the ${CLEANING_LIMIT}% cleaning limit, so crews and chemicals go where they are needed first.`,
  },
  {
    icon: Mic,
    title: 'Ask Ayn',
    body: 'Ask by voice or text, such as "what should we do about Plant B?" The answer uses the numbers on screen at the hour you are looking at.',
  },
]

export function Home() {
  const summary = fleetSummary(0)
  const stats = [
    { value: PLANTS.length, label: 'desalination plants' },
    { value: TRAINS.length, label: 'reverse osmosis trains' },
    { value: summary.totalOutput, label: 'MIGD of capacity' },
    { value: HORIZON_HOURS, label: 'hours of forecast' },
  ]

  return (
    <div className="relative isolate overflow-x-clip">
      {/* Background: faint grid and a slow glow behind the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden">
        <div className="ayn-drift absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="ayn-drift absolute top-20 -right-40 size-[28rem] rounded-full bg-bloom/10 blur-3xl [animation-delay:-9s]" />
        <div
          className="absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          style={{
            backgroundImage:
              'linear-gradient(var(--map-grid) 1px, transparent 1px), linear-gradient(90deg, var(--map-grid) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="ayn-rise flex items-center justify-between gap-4 py-6">
          <Link href="/" className="flex items-center gap-3 rounded-lg" aria-label="Ayn home">
            <Logo animated className="size-9" />
            <span className="text-2xl font-semibold leading-none tracking-tight">Ayn</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: 'outline' }), 'hidden rounded-full px-4 sm:inline-flex')}
            >
              Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main>
          <section
            aria-labelledby="hero-heading"
            className="grid items-center gap-10 pt-6 pb-16 sm:pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24"
          >
            <div>
              <p
                className="ayn-rise inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur"
                style={delay(100)}
              >
                <span aria-hidden className="relative flex size-2">
                  <span className="ayn-pulse absolute inline-flex size-full rounded-full bg-bloom" />
                  <span className="relative inline-flex size-2 rounded-full bg-bloom" />
                </span>
                Algal bloom early warning for UAE desalination
              </p>
              <h1
                id="hero-heading"
                className="ayn-rise mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]"
                style={delay(200)}
              >
                See the bloom coming before it reaches the intake.
              </h1>
              <p className="ayn-rise mt-5 max-w-xl text-lg text-muted-foreground text-pretty" style={delay(320)}>
                {`Ayn forecasts where a chlorophyll patch is heading over the next ${HORIZON_HOURS} hours and ranks which reverse osmosis trains will need cleaning first at ${PLANTS.length} plants on the UAE coast.`}
              </p>
              <div className="ayn-rise mt-8 flex flex-wrap items-center gap-3" style={delay(440)}>
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-5 text-base')}
                >
                  Open the dashboard
                  <ArrowRight className="ayn-nudge size-4 rtl:rotate-180" aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'h-11 rounded-full px-5 text-base')}
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="ayn-rise" style={delay(300)}>
              <HeroMap />
            </div>
          </section>

          <Reveal as="section" className="overflow-hidden rounded-xl border border-border bg-border">
            <dl className="grid grid-cols-2 gap-px lg:grid-cols-4" aria-label="Demo scenario at a glance">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col gap-1 bg-card px-5 py-6">
                  <dt className="order-2 text-sm text-muted-foreground">{s.label}</dt>
                  <dd className="order-1 text-4xl font-semibold tracking-tight tabular-nums">
                    <CountUp value={s.value} duration={1200} onView />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-8 py-20 lg:py-24">
            <Reveal>
              <h2 id="how-heading" className="text-3xl font-semibold tracking-tight">
                How it works
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground text-pretty">
                Four steps run for every hour on the timeline. Drag the dashboard timeline and every panel moves with
                it.
              </p>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <Reveal
                  as="li"
                  key={step.title}
                  delay={i * 110}
                  className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-primary/50"
                >
                  <span className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                      <step.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">{`0${i + 1}`}</span>
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">{step.body}</p>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={150} className="mt-4">
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-bloom/15 text-bloom">
                  <MonitorSmartphone className="size-5" aria-hidden />
                </span>
                <p className="text-sm text-muted-foreground text-pretty">
                  <span className="font-medium text-foreground">One shared clock. </span>
                  With Supabase connected, the forecast hour lives in one row. Move the timeline on a laptop and a phone
                  or projector follows within a second.
                </p>
              </div>
            </Reveal>
          </section>

          <Reveal as="section" className="mb-20">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 sm:px-10">
              <div
                aria-hidden
                className="ayn-drift absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold tracking-tight">Run the 72 hour scenario</h2>
                  <p className="mt-2 text-muted-foreground text-pretty">
                    Press play on the dashboard to watch the bloom reach Plant A, the clean order change, and alerts
                    arrive as they would.
                  </p>
                </div>
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: 'lg' }), 'h-11 shrink-0 rounded-full px-5 text-base')}
                >
                  Open the dashboard
                  <ArrowRight className="ayn-nudge size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        </main>

        <footer className="border-t border-border py-8 text-sm text-muted-foreground">
          <p className="max-w-3xl text-pretty">
            Satellite chlorophyll and ocean currents come from Copernicus snapshots. Plant telemetry is simulated and
            the fouling curves are a teaching model, not a calibrated one. Use the rankings to plan, not to replace
            on-site readings.
          </p>
        </footer>
      </div>
    </div>
  )
}
