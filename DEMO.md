# Ayn — demo quick start

One shared clock lives in Supabase. Whatever hour the laptop puts it on, the
phone shows too.

## 1. Start

```bash
npm run dev        # terminal 1 — http://localhost:3000
npm run live       # terminal 2 — OPTIONAL: advances 1 h every 4 s
```

For a manual demo, **skip `npm run live`** — the slider is the control. If it is
already running, Ctrl+C it.

## 2. Open

| Device | URL |
|---|---|
| Laptop | http://localhost:3000/dashboard **or** https://ayn-pi.vercel.app/dashboard |
| Phone | https://ayn-pi.vercel.app/dashboard (must be https for the Mic) |

The root URL is the home screen; its **Open the dashboard** button goes to the same place.

Both ask for the demo password once; the browser then stays unlocked for 30 days.
Local dev is only gated if `AYN_DEMO_PASSWORD` is in `.env.local`.

Check the badge top-right: **Live · Supabase**. If it says *Simulated plant
data*, that build has no Supabase env vars — see Troubleshooting.

## 3. Demo script (about 5 minutes)

1. **Laptop** — drag the timeline to **+60 h**. The clock, map, trains, KPIs and
   alerts all move.
2. **Phone** — it is already on +60 h. Tap **Mic** and ask, for example,
   *"What should we do about Plant B?"* The answer is computed at that hour.
3. **Laptop** — open the table editor:
   https://supabase.com/dashboard/project/xwkyopfwiwmvbryhdvgw/editor →
   `train_readings` → edit **A3**, current hour, `pressure_drop` = **18**.
   A3 turns Critical on both screens in about a second.
4. **Laptop** — delete that A3 row (row menu → Delete) and it returns to the
   simulated curve. Drag the slider back to **Now**.

Optional: `npm run live` in the second terminal makes the whole dashboard
animate by itself while you talk — stop it (Ctrl+C) before step 3.

## 4. Reset between run-throughs

```bash
npm run live        # let it run a few seconds, then Ctrl+C
```

or in the table editor set `scenario.hour` back to `0`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Badge says *Simulated plant data* | Env vars missing for that build: `.env.local` + restart `npm run dev`, or add the two `NEXT_PUBLIC_SUPABASE_*` vars on Vercel and redeploy. |
| Badge stuck on *Live · connecting* | Wrong URL/key, or the project is paused in the Supabase dashboard. |
| Slider moves the laptop but not the phone | The write grant is missing — run the `scenario is writable` block from `supabase/schema.sql`. |
| Phone Mic does nothing | The page must be https (Vercel). `http://10.x.x.x:3000` will not work. |
| Phone is on the wrong hour | Reload it once; after that it follows live. |
| Two people fight over the slider | Only touch the timeline on the device that should drive. |

## The one rule

Writes are demo-grade: the `scenario` row is writable with the anon key, which
is public by design. The password gate keeps the dashboard private, but do not
put real data behind it.
