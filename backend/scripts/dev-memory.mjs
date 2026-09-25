#!/usr/bin/env node
// Supabase olmadan lokal geliştirme/deneme: API'yi bellek içi Postgres (PGlite) ve
// database/schema.sql ile başlatır. Veriler süreç kapanınca silinir.
//
//   npm run dev:memory            (PORT varsayılanı 8000)
//
// Yalnızca geliştirme içindir; production'da kullanılmamalıdır.
import { createTestDatabase, configureTestEnv } from '../test/support/testEnv.js';
import { PgliteSupabase } from '../test/support/pgliteSupabase.js';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-memory production ortamında çalıştırılamaz.');
  process.exit(1);
}

process.env.CORS_ORIGIN ||= 'http://localhost:3000,http://127.0.0.1:3000';
process.env.JWT_SECRET ||= 'dev-memory-secret';
process.env.NODE_ENV = 'development';
configureTestEnv();

const db = await createTestDatabase();
// Yalnızca yerel deneme için örnek promosyon kodları (bellek içi DB kapanınca silinir).
await db.query(`INSERT INTO promo_codes (code, coin_reward, character_key, description) VALUES
  ('FT26-DEMO', 500, NULL, 'Yerel test: 500 coin'),
  ('WIZARD-DEMO', 0, 'wizard', 'Yerel test: The Wizard karakteri')`);
const { setSupabaseClient } = await import('../db.js');
setSupabaseClient(new PgliteSupabase(db));
const { createApp } = await import('../app.js');

const port = Number(process.env.PORT) || 8000;
createApp().listen(port, () => {
  console.log(`[dev-memory] API http://localhost:${port}/api (in-memory Postgres, CORS: ${process.env.CORS_ORIGIN})`);
  console.log('[dev-memory] Örnek promosyon kodları: FT26-DEMO (500 coin), WIZARD-DEMO (The Wizard)');
});
