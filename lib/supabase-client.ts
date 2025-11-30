import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Store as constants after checks to ensure they're defined
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Client-side browser client (uses anon key, respects RLS, handles auth cookies)
// Use this in client components
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Legacy client export for backwards compatibility with data operations
export const supabase = createSupabaseClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

// Server-side Supabase client (uses service role key, bypasses RLS)
// Use this for admin operations in API routes
// Note: This will only work on the server-side where SUPABASE_SERVICE_ROLE_KEY is available
function getAdminClient() {
  // Only check for the key when actually creating the client (server-side)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    // This will only throw on the server when actually accessed
    if (typeof window === 'undefined') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
    }
    // Return a dummy client for client-side (will never be used)
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  return createSupabaseClient(
    SUPABASE_URL,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Export the admin client - will only work server-side
export const supabaseAdmin = getAdminClient()
