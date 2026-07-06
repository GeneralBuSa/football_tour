# Football Tour Simulator (FT26)

Futbol temalı, Monopoly tarzı strateji ve yönetim oyunu. Projede Next.js tabanlı web arayüzü, Express tabanlı REST API, Supabase/PostgreSQL veri katmanı ve opsiyonel Tauri masaüstü kabuğu bulunur.

> Not: Çevrimiçi lobi ve özel oda eşleştirmesi vardır; gerçek zamanlı oyun state senkronizasyonu henüz Socket.io/WebSocket ile uygulanmamıştır. Eşleşme sonrası oyun mevcut durumda yerel oyun akışıyla başlar.

## Özellikler

| Özellik | Durum | Açıklama |
|---------|-------|----------|
| Tek oyunculu oyun | Var | Yerel oyun motoru, zar, mülk, kira ve stadyum akışı |
| Çevrimiçi lobi | Kısmi | Supabase tabanlı eşleştirme kuyruğu |
| Özel oda | Kısmi | Kullanıcı adı ile oda oluşturma/katılma |
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
copy .env.example .env
npm run dev
```

`.env` içine gerçek Supabase ve JWT değerlerini girin:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:3000
PORT=8000
```

### Veritabanı

Supabase SQL editor veya `psql` ile şemayı çalıştırın:

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

Ayrıca başlangıç mağaza ürünlerini seed eder.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Varsayılan frontend: `http://localhost:3000`
Varsayılan backend API: `http://localhost:8000/api`

## Komutlar

```bash
# Backend geliştirme
cd backend && npm run dev

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
- Satın alma işlemlerinde bakiye ve ürün fiyatı backend tarafından kontrol edilir.
- Supabase RLS politikaları service role API kullanımına göre sınırlandırılmıştır.
- Tauri allowlist daraltılmıştır; yeni Tauri API ihtiyacı doğarsa sadece gereken izin açılmalıdır.

## Bilinen Eksikler

- Gerçek zamanlı multiplayer oyun state senkronizasyonu henüz uygulanmadı.
- Şifre sıfırlama akışı e-posta servisiyle tamamlanmalı; mevcut geliştirme akışı token döndürür.
- Frontend sayfalarında ortak layout/hook refactor'ı yapılabilir.
- `frontend/out` build çıktısı ignore edilir; dağıtım için build çıktısı CI/CD tarafında üretilmelidir.

## Lisans

MIT
