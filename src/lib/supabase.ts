import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xtwdnyvilfqztfwykbem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0d2RueXZpbGZxenRmd3lrYmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTA4MzUsImV4cCI6MjA5MTg4NjgzNX0.-2-JeIY9apaHzMCwgKmQeNjykb1rahF6Ixm3Uv_MFz4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
