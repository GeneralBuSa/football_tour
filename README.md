# ⚽ Football Tour Simulator (FT26)

> Futbol temalı, monopoly tarzı strateji ve yönetim oyunu. Tarayıcı tabanlı, çok oyunculu destek ile birlikte gelir.

![Versiyon](https://img.shields.io/badge/versiyon-1.0.0-blue)
![Lisans](https://img.shields.io/badge/lisans-MIT-green)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Tauri-orange)

---

## 📸 Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🎮 **Tek Oyunculu Mod** | Yapay zeka rakiplere karşı oynayın |
| 🌐 **Çevrimiçi Lobi** | Socket.io ile gerçek zamanlı çok oyunculu mod |
| 🏆 **Başarım Sistemi** | 8 farklı başarım kilidi açın |
| 🎟️ **Savaş Bileti** | Sezonluk ödül sistemi (5 seviye) |
| 📜 **Maç Geçmişi** | Oynanan maçların detaylı kayıtları |
| 🛒 **Mağaza** | Oyun içi satın alım sistemi |
| 👤 **Profil Sistemi** | Oyuncu profilleri ve istatistikler |
| 🔐 **Kimlik Doğrulama** | Giriş, kayıt ve şifre sıfırlama ekranları |
| 🪙 **Çift Para Birimi** | Oyun parası (🪙) ve satın alım coini (💎) |
| 💾 **Otomatik Kayıt** | localStorage ile oyun durumu kaydı |

---

## 🏗️ Proje Yapısı

```
football_tour/
├── frontend/                  # İstemci tarafı (Vite + Vanilla JS)
│   ├── assets/                # Görseller, videolar, ses dosyaları
│   ├── css/
│   │   └── style.css          # Ana stil dosyası
│   ├── js/
│   │   └── game.js            # Oyun motoru ve ana oyun mantığı
│   ├── pages/
│   │   ├── achievements.html  # Başarımlar sayfası
│   │   ├── auth.html          # Giriş / Kayıt / Şifre sıfırlama
│   │   ├── battlepass.html    # Savaş bileti (sezon ödülleri)
│   │   ├── history.html       # Maç geçmişi
│   │   ├── profile.html       # Oyuncu profilleri
│   │   └── store.html         # Mağaza
│   ├── services/
│   │   └── GameService.js     # Oyun servisi (başarım, kayıt yönetimi)
│   ├── src/                   # Ek kaynak dosyaları
│   ├── src-tauri/             # Tauri masaüstü uygulama konfigürasyonu
│   ├── index.html             # Ana sayfa ve oyun menüsü
│   ├── package.json           # Frontend bağımlılıkları
│   └── vite.config.js         # Vite yapılandırması (varsa)
│
├── backend/                   # Sunucu tarafı (Express + Socket.io)
│   ├── index.js               # Ana sunucu dosyası
│   ├── db.js                  # SQLite veritabanı bağlantısı
│   └── package.json           # Backend bağımlılıkları
│
├── database/
│   └── schema.sql             # PostgreSQL veritabanı şeması
│
├── .gitignore
└── README.md
```

---

## 🚀 Kurulum

### Gereksinimler

- **Node.js** v18+
- **npm** v9+
- (Opsiyonel) **Tauri** — masaüstü uygulama derlemesi için

### 1. Depoyu Klonlayın

```bash
git clone https://github.com/kullanici/football_tour.git
cd football_tour
```

### 2. Frontend Kurulumu

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresine gidin.

### 3. Backend Kurulumu

```bash
cd backend
npm install
node index.js
```

Sunucu varsayılan olarak `http://localhost:3000` portunda çalışır.

### 4. Veritabanı (Opsiyonel)

PostgreSQL veritabanı şemasını oluşturmak için:

```bash
psql -U postgres -d football_tour -f database/schema.sql
```

---

## 🎮 Oyun Nasıl Oynanır?

1. **Ana Menü** → "OYNA" butonuna tıklayın
2. **Oyun Modu Seçimi:**
   - 🎮 **Hızlı Maç** — Yapay zekaya karşı tek oyunculu
   - 🌐 **Özel Oyun** — Çevrimiçi lobi ile çok oyunculu
3. Zar atın, şehirleri satın alın, stadyum ve tesisler inşa edin
4. Rakiplerinizi iflas ettirerek galibiyeti kazanın

### Para Birimleri

| Simge | Tür | Kullanım |
|-------|-----|----------|
| 🪙 | Oyun Parası | Maç giriş ücreti, oyun içi harcamalar |
| 💎 | Satın Alım Coini | Mağaza satın alımları |

> Her yeni hesaba otomatik olarak **₺2.000** oyun parası atanır.

---

## 🛠️ Teknoloji Yığını

### Frontend
| Teknoloji | Açıklama |
|-----------|----------|
| **Vite** | Hızlı geliştirme sunucusu ve build aracı |
| **Vanilla JS** | Framework'süz saf JavaScript |
| **Three.js** | 3D görsel efektler (opsiyonel) |
| **CSS3** | Özel animasyonlar ve glassmorphism |
| **Tauri** | Masaüstü uygulama desteği |

### Backend
| Teknoloji | Açıklama |
|-----------|----------|
| **Express 5** | REST API sunucusu |
| **Socket.io** | Gerçek zamanlı WebSocket iletişimi |
| **SQLite3** | Yerel veritabanı |
| **CORS** | Cross-origin kaynak paylaşımı |

### Veritabanı
| Teknoloji | Açıklama |
|-----------|----------|
| **PostgreSQL** | Üretim veritabanı (RLS destekli) |
| **SQLite** | Geliştirme/yerel veritabanı |

---

## 📱 Sayfa Rehberi

| Sayfa | Yol | Açıklama |
|-------|-----|----------|
| Ana Menü | `/index.html` | Oyun menüsü, mod seçimi, ayarlar |
| Giriş/Kayıt | `/pages/auth.html` | Kimlik doğrulama (şifre güçlüğü göstergesi) |
| Profil | `/pages/profile.html` | Oyuncu profilleri ve istatistikler |
| Savaş Bileti | `/pages/battlepass.html` | Sezon ödülleri (5 seviye) |
| Başarımlar | `/pages/achievements.html` | 8 başarım ve kilit durumları |
| Maç Geçmişi | `/pages/history.html` | Geçmiş maç kayıtları |
| Mağaza | `/pages/store.html` | Oyun içi satın alım |

---

## 📦 Veritabanı Şeması

```
users ──────────┐
                ├── player_stats (1:1)
                ├── achievements (1:N)
                └── game_players (N:M) ── games
```

- **users** — Kullanıcı hesapları
- **player_stats** — Kazanç, mülk, maç sayısı istatistikleri
- **achievements** — Kullanıcıya özel başarım kilitleri
- **games** — Maç kayıtları
- **game_players** — Maç-oyuncu ilişkisi ve skorlar

---

## 🔧 Geliştirme Komutları

```bash
# Frontend geliştirme sunucusu
cd frontend && npm run dev

# Frontend production build
cd frontend && npm run build

# Backend sunucusu
cd backend && node index.js

# Tauri masaüstü uygulaması (opsiyonel)
cd frontend && npm run tauri dev
```

---

## 📄 Lisans

Bu proje [MIT](LICENSE) lisansı ile lisanslanmıştır.

---

<p align="center">
  <b>⚽ FT26 — Football Tour Simulator</b><br>
  <sub>Sezon 01 • 2026</sub>
</p>
