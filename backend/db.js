import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { requireEnv } from './middleware/auth.js';

dotenv.config();

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseKey = requireEnv('SUPABASE_SERVICE_KEY');

// Backend uses the service role key to bypass RLS and manage data.
export const supabase = createClient(supabaseUrl, supabaseKey);
