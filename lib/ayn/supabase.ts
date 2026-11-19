import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The live dashboard reads two tables over Supabase Realtime. Everything is
// optional: without the env vars the app runs entirely on the simulated model
// in lib/ayn/model.ts, so local development and the current deployment keep
// working with no database.
//
//   NEXT_PUBLIC_SUPABASE_URL       https://<project>.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  the publishable / anon key (read-only RLS)

export function liveConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  )
}

let client: SupabaseClient | null = null

/** One browser client for the whole tab, or null when live mode is off. */
export function supabaseBrowser(): SupabaseClient | null {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return null
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // The simulator writes 13 rows per tick; the default 10/s is tight.
    realtime: { params: { eventsPerSecond: 30 } },
  })
  return client
}

/**
 * Move the shared scenario clock. Every other open device follows over
 * realtime, which is what lets a laptop drive a phone.
 *
 * The `scenario` table allows anonymous updates of the single row (see
 * supabase/schema.sql); there is no auth, so this is demo-grade by design.
 */
export async function writeScenarioHour(hour: number): Promise<void> {
  const supabase = supabaseBrowser()
  if (!supabase) return
  const { error } = await supabase
    .from('scenario')
    .update({ hour, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) console.warn('[ayn] could not write the scenario hour:', error.message)
}
