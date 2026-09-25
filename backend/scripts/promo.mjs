#!/usr/bin/env node
// Promosyon kodu yönetimi (yalnızca yöneticiler; backend .env içindeki service key kullanılır).
//
//   npm run promo -- create HOSGELDIN-2026 --coins 500 --max 1000 --expires 2026-12-31 --desc "Lansman hediyesi"
//   npm run promo -- create VIKING-FAN --character viking --max 100
//   npm run promo -- list
//   npm run promo -- disable HOSGELDIN-2026
//   npm run promo -- enable HOSGELDIN-2026
//
// Kodlar büyük harfe çevrilir; 4-32 karakter, harf/rakam/tire.
import dotenv from 'dotenv';

dotenv.config();

const CHARACTERS = ['architect', 'king', 'viking', 'rocket', 'wizard'];
const [command, rawCode, ...rest] = process.argv.slice(2);

function option(name) {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? undefined : rest[index + 1];
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) fail('Kod 4-32 karakter olmalı (harf, rakam, tire).');
  return code;
}

const { supabase } = await import('../db.js');

if (command === 'create') {
  const code = normalizeCode(rawCode);
  const coins = Number(option('coins') || 0);
  const character = option('character') || null;
  const max = option('max') ? Number(option('max')) : null;
  const expires = option('expires') ? new Date(option('expires')) : null;
  const starts = option('starts') ? new Date(option('starts')) : new Date();

  if (!Number.isInteger(coins) || coins < 0 || coins > 100000) fail('--coins 0-100000 arası tam sayı olmalı.');
  if (character && !CHARACTERS.includes(character)) fail(`--character şunlardan biri olmalı: ${CHARACTERS.join(', ')}`);
  if (!coins && !character) fail('Kod en az bir ödül vermeli (--coins veya --character).');
  if (max !== null && (!Number.isInteger(max) || max <= 0)) fail('--max pozitif tam sayı olmalı.');
  if (expires && Number.isNaN(expires.getTime())) fail('--expires geçerli bir tarih olmalı (YYYY-MM-DD).');

  const { data, error } = await supabase.from('promo_codes').insert([{
    code,
    coin_reward: coins,
    character_key: character,
    max_redemptions: max,
    starts_at: starts.toISOString(),
    expires_at: expires ? expires.toISOString() : null,
    description: option('desc') || null
  }]).select().single();
  if (error) fail(error.message);
  console.log('✔ Kod oluşturuldu:', data);
} else if (command === 'list') {
  const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
  if (error) fail(error.message);
  console.table(data.map(p => ({
    code: p.code,
    coins: p.coin_reward,
    character: p.character_key || '-',
    used: `${p.redemption_count}/${p.max_redemptions ?? '∞'}`,
    active: p.is_active,
    expires: p.expires_at ? p.expires_at.slice(0, 10) : '-'
  })));
} else if (command === 'disable' || command === 'enable') {
  const code = normalizeCode(rawCode);
  const { data, error } = await supabase.from('promo_codes').update({ is_active: command === 'enable' }).eq('code', code).select().maybeSingle();
  if (error) fail(error.message);
  if (!data) fail('Kod bulunamadı.');
  console.log(`✔ ${code} ${command === 'enable' ? 'aktif' : 'devre dışı'}.`);
} else {
  console.log('Kullanım: npm run promo -- <create|list|disable|enable> [KOD] [--coins N] [--character anahtar] [--max N] [--expires YYYY-MM-DD] [--desc "..."]');
  process.exit(command ? 1 : 0);
}
