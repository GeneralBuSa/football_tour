# Football Tour Simulator (FT26)

Futbol temalı, Monopoly tarzı strateji ve yönetim oyunu. Projede Next.js tabanlı web arayüzü, Express tabanlı REST API, Supabase/PostgreSQL veri katmanı ve opsiyonel Tauri masaüstü kabuğu bulunur.

> Not: Çevrimiçi hızlı eşleşme, özel oda, arkadaş listesi, arkadaşlar arası canlı mesajlaşma ve SSE tabanlı canlı hamle aktarımı vardır. Üretim ölçeğinde çoklu instance desteği ve server-authoritative oyun komutları henüz tamamlanmamıştır.

## Özellikler

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| Tek oyunculu oyun | Var | Yerel oyun motoru, zar, mülk, kira ve stadyum akışı |
| Çevrimiçi lobi | Var | Advisory lock'lu eşleştirme kuyruğu, bayat kayıt temizliği, iptal bildirimi |
| Özel oda | Var | Kullanıcı adı ile oda oluşturma/katılma, arkadaşa oyun daveti |
| Arkadaşlar & mesaj | Var | İstek gönder/kabul/reddet/geri çek, arkadaş çıkar, canlı özel mesaj, çevrimiçi durumu |
| Yerel maç | Var | Hesap gerektirmeyen 2 kişilik aynı cihaz modu |
| Hesap silme | Var | Ayarlar sayfasından şifre doğrulamalı kalıcı silme |
| Auth | Var | Kayıt, giriş, profil ve avatar güncelleme |
| Başarımlar | Var | Yerel + Supabase kayıt desteği |
| Savaş bileti | Kısmi | XP tabanlı seviye görünümü |
| Maç geçmişi | Var | Oyun sonucu kaydı üzerinden beslenir |
| Mağaza | Var | Backend kontrollü bakiye ve satın alma akışı |
| Cloud save | Var | Supabase yedekli kayıt/yükleme |
| Tauri | Opsiyonel | Masaüstü paketleme ve yerel kayıt komutları |

## Proje Yapısı

```text
football_tour/
├── backend/                 # Express REST API + Supabase service role istemcisi
│   ├── middleware/          # Ortak auth/env middleware'leri
│   ├── routes/              # Auth, stats, games, store, lobby, friends, saves
│   ├── db.js                # Supabase bağlantısı
│   ├── index.js             # API giriş noktası
│   └── .env.example         # Backend ortam değişkenleri örneği
├── database/
│   └── schema.sql           # Supabase/PostgreSQL schema ve seed verileri
├── frontend/                # Next.js 14 App Router frontend
│   ├── js/                  # Vanilla JS oyun motoru ve UI yardımcıları
│   ├── services/            # API ve oyun servis katmanı
│   ├── src/app/             # Next.js sayfaları
│   ├── src-tauri/           # Tauri konfigürasyonu
│   └── .env.example         # Frontend ortam değişkenleri örneği
└── README.md
```

## Gereksinimler

- Node.js 18+
- npm 9+
- Supabase projesi
- Tauri masaüstü derlemesi için Rust toolchain ve Tauri gereksinimleri

## Kurulum

### Backend

```bash
cd backend
npm install
copy .env.example .env  # Windows; macOS/Linux: cp .env.example .env
npm run dev
```

`.env` içine gerçek Supabase ve JWT değerlerini girin:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:3000
PORT=8000
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Veritabanı

Supabase SQL editor veya `psql` ile şemayı çalıştırın. Şema idempotent'tir; **mevcut bir veritabanında da yeniden çalıştırılmalıdır** (eşleştirme fonksiyonlarındaki `column reference is ambiguous` hatasının düzeltmesi, `lobby_queue.last_seen`, `direct_messages` tablosu ve `apply_session_result` bu sürümle gelir):

```bash
psql -U postgres -d football_tour -f database/schema.sql
```

Schema şunları oluşturur:

- `users`
- `stats`
- `achievements`
- `games`
- `store_items`
- `purchases`
- `friends`
- `lobby_queue`
- `game_saves`
- `game_sessions`
- `game_session_players`
- `game_session_events`
- `password_reset_tokens`
- `character_entitlements`
- `starter_character_claims`
- `coin_ledger`
- `coin_orders`
- `coin_pack_catalog`
- `direct_messages`

Ayrıca futbolcu kataloğunu (Architect/King: 500 coin, Viking/Rocket/Wizard: 300 coin) ve coin paketlerini seed eder. Coin paketleri: 100 coin = 1,50 USD; 300 coin = 4 USD; 500 coin = 5 USD; 1000 coin = 8 USD. Coin yükleme için Stripe Checkout oturumu oluşturulur; coin yalnızca imzalı webhook ile başarılı ödeme sonrasında verilir.

Meshy’den gelen ayrı oyuncu modelleri `frontend/public/assets/players/` altında standart adlarla tutulur: `architect.glb`, `king.glb`, `viking.glb`, `rocket.glb`, `wizard.glb`. Bu tam çözünürlüklü dosyalar yalnızca `/showcase` sayfasında kullanılır; oyun tahtası Draco ile sıkıştırılmış hafif kopyaları (`frontend/public/assets/players/game/*.glb`, ~400 KB) yükler. Web tarafındaki katalog bu yolları `frontend/js/data/playerCatalog.js` üzerinden kullanır.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local  # Windows; macOS/Linux: cp .env.example .env.local
npm run dev
```

Varsayılan frontend: `http://localhost:3000`
Varsayılan backend API: `http://localhost:8000/api`

## Komutlar

```bash
# Backend geliştirme
cd backend && npm run dev

# Backend: Supabase olmadan, bellek içi Postgres (PGlite) + gerçek şema ile API
cd backend && npm run dev:memory

# Backend testleri (birim + SQL + API entegrasyon + uçtan uca smoke)
cd backend && npm test

# Çalışan bir API'ye karşı smoke kontrolü (SMOKE_WRITE=1 geçici kullanıcılarla akışları da dener)
cd backend && SMOKE_API_URL=https://api.example.com/api npm run smoke

# Frontend birim testleri (oyun motoru, canlı senkronizasyon, API istemcisi)
cd frontend && npm run test:unit

# Frontend build smoke testi (build sonrası meta/robots/sitemap/404 kontrolleri)
cd frontend && npm run build && npm run test:build

# Backend syntax kontrolü
cd backend && npm run check

# Frontend geliştirme
cd frontend && npm run dev

# Frontend production build / check
cd frontend && npm run build
cd frontend && npm run check

# Tauri geliştirme
cd frontend && npm run tauri dev
```

## Güvenlik Notları

- Backend `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` ve `JWT_SECRET` olmadan başlamamalıdır.
- Kullanıcıya özel API uçları JWT token üzerinden çalışır; body ile gönderilen `user_id` güven kaynağı değildir.
- Stats endpoint'i istemciden bakiye, XP veya galibiyet yazılmasına izin vermez; kalıcı istatistikler server-owned'dur.
- Satın alma işlemlerinde bakiye ve ürün fiyatı tek RPC transaction'ında backend tarafından kontrol edilir.
- Gerçek para ödemesinde kart bilgisi backend'e girmez; Stripe Checkout kullanılır. `checkout.session.completed` webhook imzası doğrulanmadan coin yüklenmez ve aynı oturum ikinci kez işlenemez.
- Canlı ödeme için Stripe hesabı, ürün/ödeme ayarları ve `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` değerleri zorunludur; test anahtarlarıyla lokal Stripe CLI üzerinden denenmelidir.
- API body boyutu 256 KB ile sınırlıdır; genel API, login ve şifre sıfırlama rate limit'leri aktiftir.
- Supabase RLS politikaları service role API kullanımına göre sınırlandırılmıştır.
- Tauri allowlist daraltılmıştır; yeni Tauri API ihtiyacı doğarsa sadece gereken izin açılmalıdır.

## Testler

| Katman | Dosya | Kapsam |
|--------|-------|--------|
| Birim | `backend/test/security.test.js` | Rate limiter (limiter'lar arası izolasyon), body doğrulama, hata sızdırmama |
| SQL | `backend/test/matchmaking.sql.test.js` | `database/schema.sql` PGlite'ta: eşleştirme, bayat kuyruk, özel oda, iptal, istatistik, ekonomi RPC'leri, idempotent şema |
| Entegrasyon | `backend/test/api.*.test.js` | Gerçek Express uygulaması + SSE: auth, hesap silme, arkadaşlar, mesajlaşma, lobi, çevrimiçi oyun, mağaza, kayıt |
| Smoke / E2E | `backend/test/smoke.e2e.test.js` | Kayıt → arkadaşlık → mesaj → davet → özel oda → canlı hamleler → maç sonu |
| Frontend birim | `frontend/test/*.test.js` | Oyun kuralları, MultiplayerService, ApiService, sosyal yardımcılar, analitik gizliliği |
| Build smoke | `frontend/test/build.smoke.test.js` | Her sayfanın title/description/canonical/OG, noindex, robots, sitemap, 404 |

Yeni bir özellik eklerken ilgili `api.*.test.js` dosyasına senaryo eklemek yeterlidir; test ortamı (`backend/test/support`) şemayı her dosya için sıfırdan kurar.

## Bilinen Eksikler

- Multiplayer SSE akışı tek backend instance ile sınırlıdır; çoklu instance için ortak event bus gerekir.
- Oyun state'i hâlâ istemciden gelir; tam server-authoritative command modeline geçilmelidir.
- Şifre sıfırlama token'ları hash'lenerek `password_reset_tokens` tablosunda saklanır ve tek kullanımlıdır.
- `frontend/public/assets/players/*.glb` dosyaları ~30 MB'tır (yalnızca `/showcase` sayfasında yüklenir); dokular sıkıştırılarak (ör. `gltf-transform` ile WebP doku) küçültülmelidir.
- `frontend/out` build çıktısı ignore edilir; dağıtım için build çıktısı CI/CD tarafında üretilmelidir.

## Lisans

Bu proje MIT lisansı ile dağıtılır. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
