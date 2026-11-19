# Ayn — Algal Bloom Early Warning for Desalination

A live dashboard for UAE desalination intakes: where the bloom is heading, which
train fouls first, and an analyst you can talk to. One shared clock in Supabase
keeps every screen — laptop, phone, projector — on the same forecast hour.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js dashboard (App Router, client components)           │
│  ├── Realtime ← Supabase postgres_changes                    │
│  │     ├── scenario        the shared forecast hour          │
│  │     └── train_readings  live pressure drop + metrics      │
│  ├── REST → /api/ask         Groq gpt-oss-120b               │
│  ├── REST → /api/transcribe  Groq whisper-large-v3           │
│  ├── lib/ayn/model.ts        deterministic fallback          │
│  └── Plant view              Three.js, 12 trains, 3 plants   │
└───────────────────────┬──────────────────────────────────────┘
                        │ realtime + REST
┌───────────────────────▼──────────────────────────────────────┐
│  Supabase (Postgres + Realtime)                              │
│  ├── scenario         id = 1, hour 0–72, updated_at          │
│  ├── train_readings   (train_id, hour) → ΔP + 7 metrics      │
│  └── publication      supabase_realtime                      │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Install
npm install

# 2. Ask Ayn (optional — the dashboard runs without it)
#    free key: https://console.groq.com/keys
echo "GROQ_API_KEY=gsk_..." >> .env.local

# 3. Run
npm run dev        # http://localhost:3000

# 4. Supabase live mode (optional)
#    run supabase/schema.sql in the SQL editor, then add the three
#    Supabase vars from .env.example to .env.local
npm run live       # auto-advance 1 h every 4 s
```

> Every feature works without Supabase or Groq — the dashboard falls back to the
> simulated model in `lib/ayn/model.ts`.

## Live demo

The `scenario` row is the clock. Any device can move it; every other device
follows over realtime.

| Action | Device |
|--------|--------|
| Drag the timeline | laptop — writes `scenario.hour` |
| Follow the clock | phone — automatic, no refresh |
| Ask a question at that hour | phone — Ask Ayn uses the shared hour |
| Push a reading | Supabase table editor → `train_readings` |
| Auto-advance | `npm run live` (optional) |

Step-by-step run sheet: [`DEMO.md`](DEMO.md).

**Private demo.** When `AYN_DEMO_PASSWORD` is set, the first visit on each device asks for it and a signed httpOnly cookie keeps that device unlocked for 30 days. The gate also covers `/api/*`, so the assistant cannot be used without it.

## Forecasting model

| Stage | Component | Role |
|-------|-----------|------|
| 1 | **Bloom drift** | Chlorophyll patch position and per-intake risk over 72 h |
| 2 | **Fouling** | ΔP rises with organic load, temperature and days since clean |
| 3 | **Train state** | Hours to the 15% cleaning limit → health + status |
| 4 | **Fleet** | KPIs, ranked trains, recommendation, alert feed |

**Bloom drift** — a stylised patch travels along the UAE coast; each intake gets a
0–1 risk that peaks as the patch passes. It drives the map, the 3D intake
colours and every train's fouling rate.

**Fouling** — `pressureDropAt()` integrates base rate + bloom sensitivity ×
intake risk, so any hour is reproducible everywhere. Live rows in
`train_readings` replace the curve for the hours they cover; the rest keep
forecasting.

**Status** — `critical` at or past 15% ΔP, `watch` if the limit is reached inside
the 72 h horizon, `healthy` otherwise. The train list ranks by hours-to-limit.

## Ask Ayn

| Stage | Model | Role |
|-------|-------|------|
| 1 | `whisper-large-v3` | Mic → text |
| 2 | `openai/gpt-oss-20b` | Fixes misheard words ("strain A3" → "train A3") |
| 3 | `openai/gpt-oss-120b` | Answers from the numbers on screen |
| 4 | Browser speech | Speaks the answer |

The panel sends the question plus a snapshot of the current hour (fleet KPIs,
ranked trains, intake risk) to `/api/ask`, so answers always match what is on
screen. Override the models with `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL` and
`GROQ_CORRECT_MODEL`.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ask` | Answer a question from the current snapshot |
| POST | `/api/transcribe` | Whisper transcription + correction pass |
| GET | `/api/health` | Which Groq models are configured |

## Data model

| Table | Key | Columns |
|-------|-----|---------|
| `scenario` | `id = 1` | `hour` (0–72), `playing`, `updated_at` |
| `train_readings` | `(train_id, hour)` | `pressure_drop`, `feed_pressure`, `permeate_flow`, `salt_rejection`, `energy_use`, `sdi`, `days_since_clean` |

Reads are public (RLS select). The clock row is writable with the anon key so a
phone can follow a laptop; readings are written with the service role by the
simulator or by hand in the table editor. Full SQL:
[`supabase/schema.sql`](supabase/schema.sql).

## Deployment

Vercel needs no configuration beyond env vars:

| Variable | Where | Purpose |
|----------|-------|---------|
| `AYN_DEMO_PASSWORD` | Vercel + `.env.local` | Password gate; unset means the site is open |
| `AYN_SESSION_SECRET` | Vercel + `.env.local` | Signs the 30-day session cookie (defaults to the password) |
| `GROQ_API_KEY` | Vercel + `.env.local` | Ask Ayn chat, Mic, correction |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Realtime project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Public read/write key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` only | Simulator writes |

The Mic needs a secure context: use the Vercel https URL, not a LAN IP.

## Honest limits

- Plant telemetry is simulated; the fouling curves are a teaching model, not a
  calibrated one.
- The bloom advection is stylised. The original single-page version
  (`Ayn_ desalination early warning.html`) used real NOAA chlorophyll and HYCOM
  current snapshots.
- Output-at-risk and fleet health are rough estimates.
- The password gate keeps the dashboard private, but the Supabase anon key is
  public by design: someone who extracts it could still write the scenario row.
  Demo-grade, not production auth.

## Also in this repo

- `Ayn_ desalination early warning.html` — the original single-page build (real
  ocean data, in-browser gradient boosting, Three.js RO train).
- `backend/` — optional FastAPI server (Ollama or Claude, local Whisper) used by
  that page.
