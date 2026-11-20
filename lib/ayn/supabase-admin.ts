import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only Supabase client with the service role key, for the tables the
// browser may read but never write (crew notifications). Returns null when the
// key is not set, so the notify routes still send Telegram messages without
// tracking them.
//
//   SUPABASE_SERVICE_ROLE_KEY   Supabase: Project Settings -> API. Server only;
//                               never prefix it with NEXT_PUBLIC_.

let admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient | null {
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}
