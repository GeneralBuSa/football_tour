import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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

      if (users.length > 0) {
        const userId = users[0].id;
        console.log("Avatar güncelleniyor: userId =", userId);
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ avatar: '🦁' })
          .eq('id', userId)
          .select('id, username, email, avatar')
          .single();

        if (updateError) {
          console.error("HATA (Avatar güncellenemedi):", updateError.message);
        } else {
          console.log("Avatar güncelleme başarılı! Güncellenen veri:", updatedUser);
        }
      }
    }
  } catch (e) {
    console.error("Beklenmeyen hata:", e);
  }
}

test();
