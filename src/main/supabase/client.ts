// src/main/supabase/client.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY')
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)

// Bypasses RLS — usar solo en el proceso principal, nunca exponer al renderer
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions)
  : supabase
