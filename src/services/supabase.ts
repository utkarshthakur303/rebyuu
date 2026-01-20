import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  const missing = !supabaseUrl ? 'VITE_SUPABASE_URL' : 'VITE_SUPABASE_KEY'
  throw new Error(`Missing required environment variable: ${missing}`)
}

// Create Supabase client with error handling
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'anime-app@1.0.0',
    },
  },
})

// Health check helper (can be used for diagnostics)
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('anime_index').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

