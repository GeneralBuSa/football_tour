import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { requireEnv } from './middleware/auth.js';

dotenv.config();

let client = null;

function getClient() {
  if (!client) {
    // Backend uses the service role key to bypass RLS and manage data.
    client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_KEY'));
  }
  return client;
}

// Testler ve yerel "memory" modu gerçek Supabase yerine aynı API'ye sahip bir
// istemci enjekte edebilir. Uygulama kodu her zaman `supabase` üzerinden çalışır.
export function setSupabaseClient(nextClient) {
  client = nextClient;
}

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const target = getClient();
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});
