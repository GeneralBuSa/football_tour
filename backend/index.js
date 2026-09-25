import dotenv from 'dotenv';
import { requireEnv } from './middleware/auth.js';

dotenv.config();

// Zorunlu ortam değişkenleri olmadan sunucu başlamaz.
['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'].forEach(requireEnv);

const { createApp } = await import('./app.js');
const app = createApp();
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
