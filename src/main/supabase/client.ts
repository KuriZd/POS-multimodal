import { createClient } from '@supabase/supabase-js'
import { getRuntimeConfig } from '../../shared/runtime-config'

const runtimeConfig = getRuntimeConfig()
const supabaseUrl = runtimeConfig.supabaseUrl
const supabaseAnonKey = runtimeConfig.supabaseAnonKey
const supabaseServiceRoleKey = runtimeConfig.supabaseServiceRoleKey

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  clientOptions
)

// Bypasses RLS — usar solo en el proceso principal, nunca exponer al renderer
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions)
  : supabase
