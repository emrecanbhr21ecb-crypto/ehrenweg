# Ehrenweg — İlerleme (PROGRESS)

Son güncelleme: 2026-09-25

## Faz durumu

| Faz | İçerik | Durum |
|---|---|---|
| **0** | Ortam, Firebase projeleri, monorepo iskeleti, CI, emülatör, seed | 🟡 ~%60 |
| 1 | Auth, onboarding, i18n, profil, roller/claim | ⬜ |
| 2 | Kurumlar ve aktiviteler | ⬜ |
| 3 | QR yoklama, pasaport, IP, seviye, rozet | ⬜ |
| 4 | Cüzdan, ledger, kupon, vezne | ⬜ |
| 5 | Trainer yolu | ⬜ |
| 6 | Push, duyuru, AI uçları | ⬜ |
| 7 | Analitik, PDF, DSGVO | ⬜ |
| 8 | Android derleme, imzalama, Play iç test | ⬜ |
| 9 | Sertleştirme, prod deploy | ⬜ |

---

## Faz 0 — detay

### ✅ Bitti

**0.1 Kararlar ve git**
- `.gitignore` ilk commit'ten önce kuruldu — hiçbir sır git'e girmedi
- `docs/DECISIONS.md`, `docs/LEGAL_OPEN_QUESTIONS.md` (8 madde)
- **P00 kapandı (25 Eyl):** Bölüm 17'deki 6 sorunun hepsi cevaplı. Son ikisi —
  alan adı pilot sonrası (DECISIONS §6), Play Console hesabı Türkiye'den
  (DECISIONS §1). Keystore `dname` bilinçli olarak P11'e ertelendi.

**0.1b Geliştirme ortamı (P01, 25 Eyl) — DOĞRULANDI**

macOS 26.2 · Apple M2 (arm64)

| Araç | Sürüm | Durum |
|---|---|---|
| Node.js / npm | v24.12.0 / 11.6.2 | ✅ arm64 |
| Git | 2.50.1 (Apple Git-155) | ✅ |
| JDK | 21.0.12.1 kurulu; PATH varsayılanı 17 | ✅ `with-jdk.sh` çözüyor |
| firebase-tools | 15.22.4 | ✅ |
| GitHub CLI | 2.98.0, giriş: `emrecanbhr21ecb-crypto` | ✅ |
| Android Studio | kurulu | ✅ |
| Android SDK | platform 31/34/35/36 · build-tools 36.1.0 · NDK · platform-tools | ✅ |

Bu adımda yapılan düzeltmeler:
- **Git kimliği kuruldu** (eskiden hiç ayarlı değildi, commit'ler
  `emrecanbuhur@Emre-MacBook-Air.local` adresine yazılıyordu):
  `Emre Can Buhur <273773889+emrecanbhr21ecb-crypto@users.noreply.github.com>`.
  GitHub'ın gizli adresi seçildi → commit'ler hesapla eşleşir ama gerçek e-posta
  hiçbir yerde açığa çıkmaz. **Global** ayarlandı; BazaltGo'nun kendi yerel
  kimliği (`BazaltGo <ahmetgokhankahraman@gmail.com>`) olduğu için o etkilenmedi.
- **Mevcut commit'lerin yazarı yeniden yazıldı** (`filter-branch`), böylece
  makine adı GitHub'a hiç gitmeyecek. Tarihler korundu. Uzak depo henüz
  olmadığı için bu işlem risksizdi — push'tan sonra mümkün olmayacaktı.
- **`ANDROID_HOME` / `ANDROID_SDK_ROOT`** `~/.zshrc`'ye eklendi (ikisi de boştu),
  `platform-tools` + `emulator` PATH'e alındı. `adb` artık doğrudan çalışıyor.
- **`.claude/settings.json`** — proje izin listesi; sır dosyaları (`.env.*.local`,
  servis hesabı JSON'ları, `keystore.properties`) okuma engeline alındı.

**0.2 `/app` — React + Vite + TS + Tailwind**
- React 19.2, Vite 8, TypeScript 6 (`strict` + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`), Tailwind 4
- `src/config/brand.ts` — marka tek kaynağı (ad, slogan, renk, URL, QR ön ekleri)
- `src/styles/theme.css` — petrol yeşili/amber paleti, WCAG odak halkası,
  `prefers-reduced-motion`, güvenli alan (çentik) desteği
- i18n: DE/EN, `common` + `errors` ad alanları, **tip güvenli `t()`**
  (olmayan anahtar derlemeyi kırar), otomatik `<html lang/dir>`, RTL hazır
- `src/lib/firebase.ts` — emülatör otomatik bağlantısı, Firestore çevrimdışı
  kalıcılığı, App Check kancası
- Tema deposu (açık/koyu/sistem), PWA manifest, router + alt gezinti kabuğu
- `capacitor.config.ts` — `de.ehrenweg.app`
- `npm run build` ✅ · `tsc` ✅

**0.3 `/functions` — Cloud Functions v2**
- `europe-west3`, **`nodejs24`**, `setGlobalOptions` + `maxInstances: 10`
  (kaçak fatura koruması)
- Sır tanımları: `ANTHROPIC_API_KEY`, `VOUCHER_HMAC_SECRET`,
  `ATTENDANCE_HMAC_SECRET` (değer yok, yalnızca tanım)
- `common/roles.ts` — 7 rol, claim okuma/doğrulama, 1000 baytlık claim sınırı notu
- `common/guards.ts` — App Check zorunlu, claim kontrolü, zod doğrulama,
  hata mesajları **i18n anahtarı** olarak döner
- `common/admin.ts` — koleksiyon adları tek yerde
- `common/audit.ts` — denetim kaydı
- `healthCheck` onCall · `npm run build` ✅

**0.4 Güvenlik kuralları**
- `firestore.rules` — deny-all tabanlı, claim'den yetki, sunucu alanları kilitli
- `storage.rules` — boyut + MIME sınırı, hassas belgeler yalnız sahibi + admin
- `firestore.indexes.json` — 17 bileşik indeks
- `firebase.json` — emülatörler + güvenlik başlıklı hosting
- `.firebaserc` — `dev` / `prod` alias
- **`tests/firestore.rules.test.ts` — 49 test, hepsi geçiyor** ✅
  Kanıtlananlar: kullanıcı kendi puanını artıramıyor, kendine kupon basamıyor,
  pasaport girdisi uyduramıyor, ledger'a satır ekleyemiyor/değiştiremiyor,
  **dönen QR kodunu hiç kimse (admin dahil) okuyamıyor**
- `scripts/with-jdk.sh` — JDK 21+ otomatik bulunuyor, emülatör komutları
  makineye özel ayar istemiyor

**0.5 Firebase projeleri (P02, 25 Eyl) — CLI kısmı BİTTİ**

| | dev | prod |
|---|---|---|
| Proje kimliği | `ehrenweg-dev` | `ehrenweg-prod` |
| Proje numarası | 845360816804 | 24663235054 |
| Web uygulaması | ✅ | ✅ |
| Android | ✅ `de.ehrenweg.app.dev` | ✅ `de.ehrenweg.app` |
| Analytics | kapalı ✅ | kapalı ✅ |

- `.firebaserc` zaten bu kimliklere işaret ediyordu, değişiklik gerekmedi.
- Gerçek web yapılandırması: **`app/.env.development.local`** (dev) ve
  **`app/.env.production`** (prod). İkisinin de git tarafından engellendiği
  `git check-ignore` ile kanıtlandı. `app/.env.development` bilerek git'te
  kalıyor ve yalnız sahte `demo-ehrenweg` emülatör değerleri tutuyor —
  **P02 promptu "gerçek değerleri .env.development'a yaz" diyordu, uygulanmadı**;
  o dosya `.gitignore` dışında olduğu için anahtarlar git'e sızardı.

**Hesap kurulumunda iki ayrı kapı çıktı** (ikisi de konsoldan, bir kez):
1. *Google Cloud ToS* — geçilmeden `projects:create` "Callers must accept Terms
   of Service" veriyor.
2. *Firebase ilk kurulum* — ayrı bir kapı; geçilmeden `addFirebase` 403
   PERMISSION_DENIED veriyor. GCP projesi oluşur ama Firebase eklenemez.

Bu sırada konsolda yanlışlıkla **`ehrenweg-dev-10c28`** adlı fazla bir proje
açıldı. Kullanılmıyor, silinecek. Doğru kimlik (`ehrenweg-dev`) var olan GCP
projesine `projects:addfirebase` ile Firebase eklenerek kurtarıldı.

### 🔜 Kaldı

**P02'den kalan — konsolda elle yapılacaklar (25 Eyl itibarıyla ölçüldü):**

| Adım | dev | prod | Not |
|---|---|---|---|
| Authentication (E-posta/Şifre + Google) | ? | ⬜ | CLI'dan doğrulanamıyor |
| **Firestore — `europe-west3`** | ⬜ **YAPILMADI** | ⬜ | API bile açılmamış. ⚠️ Konum kalıcı, yanlış seçilirse dönüşü yok |
| Storage — aynı bölge | ⬜ | ⬜ | **Blaze'e bağlı**, ondan önce açılmıyor |
| Blaze + 10 € bütçe uyarısı | ⬜ | ⬜ | Storage ve Functions bunu bekliyor |
| App Check kaydı (enforcement KAPALI) | ⬜ | ⬜ | Web reCAPTCHA Enterprise; site key `.env`'e eklenecek |
| `ehrenweg-dev-10c28` sil | ⬜ | — | 30 gün geri alma süresi var |

Sıra önemli: **Blaze → Storage**. Firestore Blaze istemiyor, ondan önce
yapılabilir.

**Faz 0'dan kalan diğerleri:**
- `scripts/seed.ts` — demo içerik **yalnızca Firestore'a**, `seed: true` işaretli
- `scripts/unseed.ts` — demo içeriği tek komutla silme
- `scripts/grantAdmin.ts`
- Prettier + Husky + GitHub Actions CI + i18n eksik anahtar scripti
- GitHub private repo
- Firebase projeleri (`ehrenweg-dev`, `ehrenweg-prod`) + konsol adımları
- Android upload keystore

---

## Bilinen sorunlar / engeller

| # | Konu | Durum |
|---|---|---|
| 0 | firebase CLI'da aktif hesap VALEON'du; projeler yanlış hesaba açılabilirdi | 🟢 çözüldü (25 Eyl) — `firebase login:use ehrenwegde@gmail.com`. Ayar **klasöre özel** yazıldı: ehrenweg klasöründe ehrenwegde@, dışarıda VALEON. Diğer projeler etkilenmedi. `projects:list` → "No projects found" (temiz başlangıç doğrulandı) |
| 1 | `ehrenwegde@gmail.com` firebase CLI'ya eklendi | 🟢 çözüldü |
| 2 | firebase-tools JDK 21+ istiyor, sistem varsayılanı 17'ydi | 🟢 çözüldü — `scripts/with-jdk.sh` |
| 3 | Keystore için tam yasal ad + şehir alınmadı (üretimden sonra değiştirilemez) | 🟡 P11'e ertelendi (proje sahibi kararı) |
| 6 | Şahıs Play Console hesabı → üretime çıkmadan önce **12 test kullanıcısı / 14 gün kapalı test** şartı; pilot takvimini iki hafta uzatır | 🟡 P13'te |
| 7 | `package.json` henüz var olmayan dosyalara script tanımlıyor (`seed.ts`, `grantAdmin.ts`, `check-i18n.mjs`, `ledgerConsistencyCheck.ts`). Husky kurulu ama kanca yok, CI ve Prettier yapılandırması yok | 🟡 P03'te yazılacak |
| 4 | Firebase build'i 606 kB (179 kB gzip) — Faz 1'de tembel yükleme | 🟡 planlı |
| 5 | `attendanceSessions` ve `attendanceRecords`'a `orgId` eklendi (CLAUDE.md şemasında yoktu) — kuralların kurum yetkisini ek okuma yapmadan kontrol edebilmesi için gerekli | 🟢 bilinçli ekleme |

---

## Faz 1 — Auth, onboarding, profil (25 Eyl 2026)

### ✅ Bitti

**Firestore gerçek projelerde kuruldu:** `ehrenweg-dev` ve `ehrenweg-prod`,
ikisi de **`europe-west3`**. Kurallar + 17 indeks dev'e dağıtıldı.
⚠️ Dağıtım sırasında dikkat: `firebase deploy --only firestore` veritabanı
yoksa **sormadan `nam5` (ABD) bölgesinde açıyor**. Bölge kalıcı olduğu için
yeni projede önce `firestore:databases:create --location europe-west3`
çalıştır, sonra deploy et.

**Kod:**

| Dosya | İçerik |
|---|---|
| `lib/authService.ts` | kayıt, giriş, Google, doğrulama, şifre sıfırlama; Firebase hata kodu → i18n anahtarı |
| `lib/AuthProvider.tsx` | oturum + custom claim + canlı profil dinleme, tek kaynak |
| `lib/userProfile.ts` | users/{uid} oluşturma / okuma / güncelleme |
| `types/user.ts` | şema + zod doğrulama + rol tipleri |
| `config/catalog.ts` | kategori, beceri, dil, CEFR, seviye eşikleri |
| `components/ui.tsx` | Button, TextField, TextArea, Alert, Card, ChipToggle (WCAG AA) |
| `components/ProfileFields.tsx` | ilgi/beceri/dil seçicileri |
| `components/LevelRing.tsx` | seviye halkası + sayı kartları |
| `components/AppShell.tsx` | başlık + alt menü (ortada QR butonu, Faz 3'e kadar kapalı) |
| `pages/` | Welcome, SignUp, SignIn, VerifyEmail, ProfileSetup, Home, Profile, ProfileEdit, Legal, Placeholder |

**Doğrulandı:**
- `npm run build` ✅ · `tsc -b --noEmit` ✅ (tip güvenli i18n dahil)
- `npm run test:rules` → **59 test, hepsi geçiyor** (49 eskisi + 10 yeni
  profil-oluşturma saldırı senaryosu)
- Tarayıcıda: onboarding üç kart, DE/EN anında geçiş, kayıt formu, yönlendirme
  kapıları (`/` → `/welcome`) çalışıyor

**Bilinçli sapma:** profil belgesini istemci oluşturuyor — Blaze kapalı
olduğu için. Gerekçe ve güvenlik kanıtı: DECISIONS.md §7.

### 🔜 Faz 1'den kalan / sonraki adım

- Kayıt akışının canlı denemesi (gerçek e-posta ile) — proje sahibi yapacak
- `.env.development.local` şu an `VITE_USE_EMULATORS=false`: `npm run dev`
  gerçek `ehrenweg-dev` projesine bağlanıyor. Emülatörle çalışmak için
  `true` yap
- Emülatör hosting portu 5000 → **5050** değişti (macOS AirPlay 5000'i tutuyor)
- Profil fotoğrafı yükleme: Storage Blaze'e bağlı, Blaze açılınca
- App Check site key `.env`'e eklenmeli (konsolda kayıt yapıldı)
- Faz 2: kurumlar + aktiviteler (liste, harita, detay, başvuru)
