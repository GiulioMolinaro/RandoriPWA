import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wrelvpdqboikufugcpes.supabase.co'
const supabaseAnonKey = 'sb_publishable_QKdevj4Fc45oBZS92LDylQ_hU3EK2oX'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)