import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xtwdnyvilfqztfwykbem.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0d2RueXZpbGZxenRmd3lrYmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTA4MzUsImV4cCI6MjA5MTg4NjgzNX0.-2-JeIY9apaHzMCwgKmQeNjykb1rahF6Ixm3Uv_MFz4';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[Supabase] VITE_SUPABASE_URL/ANON_KEY não encontrados no .env, usando fallback hardcoded');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
