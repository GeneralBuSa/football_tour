import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env dosyasını backend klasöründen yükle
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    // 1. users tablosundaki sütunları ve ilk satırı kontrol et
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.error("HATA (users tablosu sorgulanamadı):", error.message);
      console.error("Detay:", error);
    } else {
      console.log("Başarılı! Users tablosundan 1 satır:");
      console.log(users);
    }
  } catch (e) {
    console.error("Beklenmeyen hata:", e);
  }
}

test();
