import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL="https://ljwwccaxyivjtzzbemqe.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqd3djY2F4eWl2anR6emJlbXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDk0NDcsImV4cCI6MjA5MTcyNTQ0N30.59CKh4b9RF-FLRXTTAzkjnKADSbdFvRwC6NOF2t44pE";

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);