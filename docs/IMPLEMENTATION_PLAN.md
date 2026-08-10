# FT26 Proje İnceleme ve Uygulama Planı

> Son güncelleme: 2026-07-06  
> Durum: **Faz 0 — Stabilizasyon aşaması**

Bu belge, mevcut repo durumunu detaylı kod incelemesi sonrası kalan işleri güvenli bir sıraya koymak için hazırlandı. Amaç, yarım kalan değişiklikleri önce stabilize etmek, sonra büyük işleri parça parça tamamlamaktır.

---

## 1. Mevcut Durum Özeti

Proje şu anda çalışan bir **Next.js frontend**, **Express backend**, **Supabase/PostgreSQL** şeması ve opsiyonel **Tauri** kabuğundan oluşuyor.

### Tamamlanmış İşler
- [x] Backend auth middleware (`backend/middleware/auth.js`) — JWT doğrulama + `requireSameUser` koruması
- [x] Backend route'larının JWT ile sertleştirilmesi
- [x] Mağaza satın alma işlemi backend tarafına taşınması (`backend/routes/store.js`)
- [x] Supabase şemasına RLS düzenlemeleri, store seed verileri eklenmesi
- [x] Multiplayer session tabloları eklenmesi (`game_sessions`, `game_session_players`, `game_session_events`)
- [x] Şifre sıfırlama için Resend uyumlu e-posta servisi başlangıcı (`backend/services/email.js`)
- [x] Multiplayer backend session/SSE route başlangıcı (`backend/routes/multiplayer.js`)
- [x] Frontend `MultiplayerService` ve oyun snapshot modülü (`frontend/services/MultiplayerService.js`, `frontend/js/engine/snapshot.js`)
- [x] `frontend/out/` build çıktısı `.gitignore`'a alınması
- [x] Rate limiting ve şifre güçlülük kontrolü (`backend/routes/auth.js` satır 17-25)
- [x] Backend `.env.example` dosyasına mail ayarlarının eklenmesi

### Yarım Kalan İşler (Kritik)
- [ ] SSE auth — query token desteği yok
- [ ] Lobby status response'unda `session_id` eksik
- [ ] Frontend reset token akışında `emailSent` durumu ele alınmıyor
- [ ] `playLocalGame()` session_id parametresi almıyor
- [ ] Multiplayer state sync çağrıları eksik (zar atma, sıra bitirme)
- [ ] Turn ownership ve version kontrolü yok

---

## 2. Doğrulama Sonuçları

| Kontrol | Sonuç | Not |
|---------|-------|-----|
| Backend `npm run check` | ✅ Başarılı | — |
| Backend `.js` dosyaları `node --check` | ✅ Başarılı | — |
| Frontend `npm run build` | ✅ Başarılı | Build başarılı olsa da multiplayer akışını doğrulamaz |
| Tauri `cargo check` | ❌ Çalıştırılamadı | Sistemde `cargo` komutu bulunmuyor |

---

## 3. Kritik Bulgular

### 3.1 Git ve Build Çıktısı Durumu ✅

`frontend/out/` git takibinden çıkarılmış durumda. Bu doğru bir karar.

**Yapılacak:**
- [x] ~~`frontend/out/` staged deletion korunacak~~ → Zaten yapıldı
- [ ] Deployment için build çıktısı CI/CD veya local build ile üretilecek — pipeline netleştirilmeli

---

### 3.2 Şifre Sıfırlama E-posta Entegrasyonu — TAMAMLANDI ✅

**Backend durumu:** Tamamlanmış.
- `backend/services/email.js` — Resend entegrasyonu hazır
- `backend/routes/auth.js` satır 139-205 — `forgot-password` ve `reset-password` endpoint'leri çalışır durumda
- Rate limiting aktif (satır 17-25)
- E-posta yapılandırılmışsa `emailSent: true` döner, yapılandırılmamışsa dev token döner

**Frontend durumu:** Tamamlandı.
- `frontend/src/app/auth/page.jsx` → `resetToken` ve `emailSent` yanıtları ele alınıyor
- URL'den `?resetToken=xxx` query parametresi okunuyor

**Tamamlanan ek güvenlik:**
1. [x] `password_reset_tokens` tablosu ve hash'lenmiş, tek kullanımlık token akışı

**Kabul kriteri:**
- Resend env yokken dev token akışıyla şifre sıfırlanabilir ✅ (zaten çalışıyor)
- Resend env varken token response'ta dönmez, e-posta linki üretilir ✅
- `/auth?resetToken=...` direkt yeni şifre formunu açar ✅

---

### 3.3 Multiplayer Senkronizasyon Altyapısı — BETA ⚠️

**Tamamlanmış kısımlar:**
- `database/schema.sql` satır 145-185 → `game_sessions`, `game_session_players`, `game_session_events` tabloları hazır
- `backend/routes/multiplayer.js` → Session CRUD, state update, SSE event stream, finish endpoint'leri var
- `backend/routes/lobby.js` → Join, leave, status, özel oda oluştur/katıl endpoint'leri var
- `frontend/services/MultiplayerService.js` → `start()`, `stop()`, `syncState()` metotları var
- `frontend/js/engine/snapshot.js` → `getGameSnapshot()` ve `applyGameSnapshot()` hazır
- `frontend/js/engine/player.js` satır 102-128 → `syncMultiplayerState()` ve `finishMultiplayerSession()` hazır

**Kritik sorunlar:**

#### Eski sorun notu: SSE Auth Uyumsuzluğu
- **Backend** (`multiplayer.js` satır 146): `authenticate` middleware kullanıyor → `Authorization: Bearer xxx` header bekliyor
- **Frontend** (`MultiplayerService.js` satır 31): `?token=xxx` query parametresi gönderiyor
- **Güncel durum:** Query token doğrulaması mevcut; üretimde kısa ömürlü SSE ticket tercih edilmelidir.

#### Eski sorun notu: Lobby Status'ta `session_id` Eksik
- `backend/routes/lobby.js` satır 95-107: `matched` durumunda response'a `session_id` **eklenmiyor**
- `lobby_queue` tablosunda `session_id` sütunu var (schema satır 174) ve join/match sırasında yazılıyor
- **Güncel durum:** `session_id` status yanıtına aktarılıyor.

#### Eski sorun notu: `playLocalGame` Session ID Almıyor
- `frontend/js/ui/menu.js` satır 14: `function playLocalGame()` → parametre kabul etmiyor
- Satır 128 ve 481'de eşleşme sonrası `window.playLocalGame()` parametresiz çağrılıyor
- **Güncel durum:** Akış mevcut kodda session seçeneğini taşıyor; gerçek server-authoritative oyun akışı hâlâ beta.

#### Kalan sorun 1: State Sync kapsamı 🟡
- `frontend/js/engine/dice.js`: Zar atma (`rollDice`, satır 20-41) ve piyon hareketi (`movePlayer`, satır 44-66) sonrası `syncMultiplayerState` çağrılmıyor
- `frontend/js/engine/player.js`: `endTurn` fonksiyonu (satır 50-70) sonrası sync çağrısı yok
- `frontend/js/engine/economy.js`: Satın alma ve stadyum geliştirme sonrası sync yok

#### Kalan sorun 2: Server-authoritative state 🟡
- `backend/routes/multiplayer.js` satır 90-123: `PUT /sessions/:sessionId/state` sadece `ensureParticipant` kontrol ediyor
- Herhangi bir katılımcı sırası olmasa bile state güncelleyebilir
- `version` veya `updated_at` ile stale update kontrolü yok

#### Kalan sorun 3: Çoklu instance event dağıtımı 🟡
- `MultiplayerService.js` satır 43-45: `onerror` sadece `console.warn` yapıyor
- Bağlantı koptuğunda yeniden bağlanma mekanizması yok
- Son session state'i backend'den çekme ve `applyGameSnapshot` ile uygulama mekanizması yok

**Kalan yapılacaklar:**
1. [ ] Zar, ekonomi ve tur komutlarını backend’de doğrulayan server-authoritative protokol
2. [ ] SSE yerine ortak event bus/WebSocket/Realtime katmanı
3. [ ] Event replay cursor ve idempotent game actions

**Kabul kriteri:**
- İki farklı kullanıcı lobi ile aynı session id alır ✅
- SSE auth ve reconnect temel akışı çalışır ✅
- Sıra kontrolü backend’de yapılır ✅; aksiyonun oyun kurallarına göre doğrulanması devam ediyor
- Çoklu instance event dağıtımı ❌

---

### 3.4 Frontend Ortak Layout/Hook Refactor'u — YAPILMADI ⬜

Sayfalarda tekrar eden kod blokları:
- Arka plan video bloğu
- Üst navigasyon
- Auth/lang/stats yükleme
- `game.js` dynamic import akışı
- Sayfa container yapısı

Bu dosyalarda tekrar tespit edildi:
- `frontend/src/app/store/page.jsx`
- `frontend/src/app/achievements/page.jsx`
- `frontend/src/app/history/page.jsx`
- `frontend/src/app/profile/page.jsx`
- `frontend/src/app/settings/page.jsx`
- `frontend/src/app/battlepass/page.jsx`

**Yapılacak:**
1. [ ] `frontend/src/app/shared/useSession.js` — Auth/lang/stats hook'u
2. [ ] `frontend/src/app/shared/PageBackground.jsx` — Arka plan video bileşeni
3. [ ] `frontend/src/app/shared/TopNav.jsx` — Ortak navigasyon
4. [ ] `frontend/src/app/shared/PageShell.jsx` — Sayfa sarmalayıcısı
5. [ ] Önce basit sayfalar refactor edilecek: `history`, `store`, `achievements`
6. [ ] Sonra: `profile`, `settings`, `battlepass`
7. [ ] Ana sayfa oyun DOM'una dokunulmadan en son ele alınacak

**Kabul kriteri:**
- Ortak nav değişikliği tek komponentten yapılabilir
- Dil/auth/stats yükleme tekrar eden useEffect bloklarından ayrılır
- Frontend build geçmeye devam eder

---

### 3.5 Tauri Build Doğrulanmadı ⬜

`frontend/src-tauri/Cargo.toml` içinde Tauri izinleri daraltılmış durumda. Sistemde Rust/Cargo bulunmadığı için doğrulama yapılamadı.

**Yapılacak:**
1. [ ] Rust toolchain kurulumu doğrulanacak
2. [ ] `cargo check` çalıştırılacak
3. [ ] `npm run tauri build` denenmeden önce CSP ve Tauri invoke kullanımları kontrol edilecek
4. [ ] CSP Next static export ile uyumlu mu test edilecek

**Kabul kriteri:**
- `cargo check` başarılı
- `npm run tauri build` başarılı
- Uygulama açılınca Tauri invoke komutları çalışır

---

### 3.6 Supabase Schema ve Canlı API Testi Yapılmadı ⬜

Schema dosyası güncellenmiş ancak gerçek Supabase projesine uygulanmamış. Canlı env değerleri olmadığı için API uçtan uca test edilemedi.

**Yapılacak:**
1. [ ] `database/schema.sql` Supabase SQL editor veya `psql` ile çalıştırılacak
2. [ ] `backend/.env` gerçek değerlerle doldurulacak
3. [ ] Backend başlatılacak
4. [ ] Frontend `.env.local` API adresiyle çalıştırılacak
5. [ ] Smoke test listesi:
   - [ ] Register
   - [ ] Login
   - [ ] `/auth/me`
   - [ ] Stats fetch
   - [ ] Store items fetch
   - [ ] Purchase
   - [ ] Save/load game
   - [ ] Forgot/reset password
   - [ ] Lobby match
   - [ ] Multiplayer session state update

**Kabul kriteri:**
- Supabase'de tablo/policy hatası yok
- Auth token ile korunan endpoint'ler çalışır
- Başka user id ile veri çekme/güncelleme 403 döner
- Store satın alma bakiyeyi backend'de düşer

---

## 4. Uygulama Sırası

### Faz 0 — Yarı Kalmış Değişiklikleri Stabilize Et 🟢
**Öncelik:** Çok yüksek  
**Tahmini süre:** 1-2 gün  
**Bu faz başarıyla tamamlanmıştır.**

| # | Görev | Dosya | Durum |
|---|-------|-------|-------|
| 1 | SSE auth: query token desteği ekle | `backend/routes/multiplayer.js` satır 146 | [x] |
| 2 | Lobby status response'una `session_id` ekle | `backend/routes/lobby.js` satır 95-107 | [x] |
| 3 | Auth frontend: `emailSent` durumunu ele al | `frontend/src/app/auth/page.jsx` satır 98-120 | [x] |
| 4 | Auth frontend: URL'den `resetToken` oku | `frontend/src/app/auth/page.jsx` satır 41-48 | [x] |
| 5 | `playLocalGame` → session_id parametresi ekle | `frontend/js/ui/menu.js` satır 14, 128, 481 | [x] |
| 6 | Zar atma sonrası sync çağrısı ekle | `frontend/js/engine/dice.js` satır 39-40 | [x] |
| 7 | Sıra bitirme sonrası sync çağrısı ekle | `frontend/js/engine/player.js` satır 69 | [x] |
| 8 | Frontend build + backend syntax check çalıştır | — | [x] |

---

### Faz 1 — Frontend Ortak Shell/Hook Refactor'u 🟢
**Öncelik:** Yüksek  
**Tahmini süre:** 2-3 gün

| # | Görev | Durum |
|---|-------|-------|
| 1 | `shared/useSession.js` — ortak session hook | [x] |
| 2 | `shared/PageBackground.jsx` — arka plan bileşeni | [x] |
| 3 | `shared/TopNav.jsx` — ortak navigasyon | [x] |
| 4 | `shared/PageShell.jsx` — sayfa sarmalayıcısı | [x] |
| 5 | Basit sayfaları refactor et: history, store, achievements | [x] |
| 6 | Karmaşık sayfaları refactor et: profile, settings, battlepass | [x] |

> Bu faz UI davranışını değiştirmemeli; sadece tekrar azaltmalı.

---

### Faz 2 — Şifre Sıfırlama E-postasını Tamamla 🟢
**Öncelik:** Yüksek  
**Tahmini süre:** 0.5-1 gün

| # | Görev | Durum |
|---|-------|-------|
| 1 | Frontend `emailSent` yanıt desteği | [x] |
| 2 | Frontend `?resetToken=` query okuma | [x] |
| 3 | Dev/prod davranış ayrımı doğrulama | [x] |
| 4 | Hata mesajları ve UX iyileştirmeleri | [x] |

---

### Faz 3 — Multiplayer State Sync'i Çalışır Hale Getir 🟡
**Öncelik:** Yüksek ama riskli  
**Tahmini süre:** 3-5 gün

| # | Görev | Durum |
|---|-------|-------|
| 1 | SSE query token auth desteği | [x] |
| 2 | Lobby → session_id akışı | [x] |
| 3 | playLocalGame → MultiplayerService.start bağlantısı | [x] |
| 4 | Tüm state-değiştiren aksiyonlara sync eklenmesi | [x] |
| 5 | Remote state geldiğinde snapshot apply + echo loop engelleme | [x] |
| 6 | Turn ownership backend kontrolü | [x] |
| 7 | Version/updated_at ile stale update engelleme | [x] |
| 8 | Reconnect + son state yükleme | [x] |
| 9 | İki oyunculu smoke test | ⬜ |

> **Not:** Faz 0'daki multiplayer ile ilgili maddeler (SSE auth, lobby session_id, playLocalGame, sync çağrıları) Faz 3'ün ön koşuludur. Faz 0 tamamlanmadan Faz 3'e geçilmemeli.

---

### Faz 4 — Tauri Doğrulama 🟢
**Öncelik:** Orta  
**Tahmini süre:** 0.5-1 gün

| # | Görev | Durum |
|---|-------|-------|
| 1 | Rust/Cargo kurulumu | ⬜ |
| 2 | `cargo check` çalıştırma | ⬜ |
| 3 | `npm run tauri build` çalıştırma | ⬜ |
| 4 | CSP düzeltmeleri | ⬜ |

---

### Faz 5 — Supabase Canlı E2E Test 🟡
**Öncelik:** Yüksek, ama env gerektirir  
**Tahmini süre:** 1 gün

| # | Görev | Durum |
|---|-------|-------|
| 1 | Schema SQL uygulama | ⬜ |
| 2 | Backend .env yapılandırma | ⬜ |
| 3 | Frontend .env.local yapılandırma | ⬜ |
| 4 | Smoke test (12 madde) | ⬜ |

---

## 5. Riskler

| Risk | Seviye | Açıklama |
|------|--------|----------|
| SSE tek instance | 🟡 Orta | Çoklu instance deployment için Supabase Realtime, Redis pub/sub veya WebSocket gateway gerekir |
| Service role güvenliği | 🔴 Yüksek | Backend hâlâ service role ile çalıştığı için API auth kontrolleri kritik önemdedir |
| React dışı mutable state | 🟡 Orta | Frontend oyun motoru React dışı mutable state kullandığı için multiplayer sync sırasında state çakışabilir |
| Tauri CSP uyumsuzluğu | 🟡 Orta | Tauri CSP sıkılaştırma Next static output ile uyumsuz olabilir |
| Deployment pipeline | 🟢 Düşük | `frontend/out` git'ten çıkarıldığı için deployment pipeline netleştirilmeli |

---

## 6. Hemen Sonraki Adım

Kodlamaya yeniden başlanacaksa ilk yapılacak iş **Faz 0** olmalıdır:

1. `backend/routes/multiplayer.js` → SSE endpoint'inde query token auth desteği ekle
2. `backend/routes/lobby.js` → Status response'a `session_id` ekle
3. `frontend/src/app/auth/page.jsx` → `emailSent` desteği + `?resetToken=` query okuma
4. `frontend/js/ui/menu.js` → `playLocalGame(options)` session_id parametresi
5. `frontend/js/engine/dice.js` + `player.js` → Sync çağrıları
6. `npm run build` + backend JS syntax check çalıştır

Bu adımlardan sonra proje tekrar sağlam bir zemine oturur; sonra refactor ve multiplayer asıl uygulama daha güvenli ilerler.

---

## 7. Dosya Referans Haritası

| Dosya | Satır | İlgili Faz |
|-------|-------|------------|
| `backend/routes/multiplayer.js` | 146 (SSE auth), 90-123 (state update) | Faz 0, 3 |
| `backend/routes/lobby.js` | 95-107 (status response) | Faz 0 |
| `backend/routes/auth.js` | 139-205 (forgot/reset) | Faz 2 |
| `backend/services/email.js` | 1-42 (Resend entegrasyonu) | Faz 2 |
| `backend/middleware/auth.js` | 11-28 (auth middleware) | Faz 0 |
| `frontend/src/app/auth/page.jsx` | 98-120 (forgot), 41-48 (useEffect) | Faz 0, 2 |
| `frontend/js/ui/menu.js` | 14 (playLocalGame), 128, 481 (çağrılar) | Faz 0 |
| `frontend/js/engine/dice.js` | 20-41 (rollDice), 44-66 (movePlayer) | Faz 0 |
| `frontend/js/engine/player.js` | 50-70 (endTurn), 102-128 (sync) | Faz 0 |
| `frontend/js/engine/snapshot.js` | 12-64 (get/apply snapshot) | Faz 3 |
| `frontend/services/MultiplayerService.js` | 24-45 (start/events) | Faz 0, 3 |
| `database/schema.sql` | 145-185 (multiplayer tables) | Faz 5 |
