import { createClient } from '@supabase/supabase-js'

const publicConfig = window.pos.config.getPublic()
const supabaseUrl = publicConfig.supabaseUrl
const supabaseAnonKey = publicConfig.supabaseAnonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})
