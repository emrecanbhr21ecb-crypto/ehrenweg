# Ehrenweg — İlerleme (PROGRESS)

Son güncelleme: 2026-09-26 (Faz 4)

## Faz durumu

| Faz   | İçerik                                                           | Durum |
| ----- | ---------------------------------------------------------------- | ----- |
| **0** | Ortam, Firebase projeleri, monorepo iskeleti, CI, emülatör, seed | ✅    |
| 1     | Auth, onboarding, i18n, profil, roller/claim                     | ✅    |
| 2     | Kurumlar ve aktiviteler                                          | ✅    |
| 3     | QR yoklama, pasaport, IP, seviye, rozet                          | ⬜    |
| 4     | Cüzdan, ledger, kupon, vezne                                     | ⬜    |
| 5     | Trainer yolu                                                     | ⬜    |
| 6     | Push, duyuru, AI uçları                                          | ⬜    |
| 7     | Analitik, PDF, DSGVO                                             | ⬜    |
| 8     | Android derleme, imzalama, Play iç test                          | ⬜    |
| 9     | Sertleştirme, prod deploy                                        | ⬜    |

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

| Araç           | Sürüm                                                            | Durum                    |
| -------------- | ---------------------------------------------------------------- | ------------------------ |
| Node.js / npm  | v24.12.0 / 11.6.2                                                | ✅ arm64                 |
| Git            | 2.50.1 (Apple Git-155)                                           | ✅                       |
| JDK            | 21.0.12.1 kurulu; PATH varsayılanı 17                            | ✅ `with-jdk.sh` çözüyor |
| firebase-tools | 15.22.4                                                          | ✅                       |
| GitHub CLI     | 2.98.0, giriş: `emrecanbhr21ecb-crypto`                          | ✅                       |
| Android Studio | kurulu                                                           | ✅                       |
| Android SDK    | platform 31/34/35/36 · build-tools 36.1.0 · NDK · platform-tools | ✅                       |

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

|                | dev                      | prod                 |
| -------------- | ------------------------ | -------------------- |
| Proje kimliği  | `ehrenweg-dev`           | `ehrenweg-prod`      |
| Proje numarası | 845360816804             | 24663235054          |
| Web uygulaması | ✅                       | ✅                   |
| Android        | ✅ `de.ehrenweg.app.dev` | ✅ `de.ehrenweg.app` |
| Analytics      | kapalı ✅                | kapalı ✅            |

- `.firebaserc` zaten bu kimliklere işaret ediyordu, değişiklik gerekmedi.
- Gerçek web yapılandırması: **`app/.env.development.local`** (dev) ve
  **`app/.env.production`** (prod). İkisinin de git tarafından engellendiği
  `git check-ignore` ile kanıtlandı. `app/.env.development` bilerek git'te
  kalıyor ve yalnız sahte `demo-ehrenweg` emülatör değerleri tutuyor —
  **P02 promptu "gerçek değerleri .env.development'a yaz" diyordu, uygulanmadı**;
  o dosya `.gitignore` dışında olduğu için anahtarlar git'e sızardı.

**Hesap kurulumunda iki ayrı kapı çıktı** (ikisi de konsoldan, bir kez):

1. _Google Cloud ToS_ — geçilmeden `projects:create` "Callers must accept Terms
   of Service" veriyor.
2. _Firebase ilk kurulum_ — ayrı bir kapı; geçilmeden `addFirebase` 403
   PERMISSION_DENIED veriyor. GCP projesi oluşur ama Firebase eklenemez.

Bu sırada konsolda yanlışlıkla **`ehrenweg-dev-10c28`** adlı fazla bir proje
açıldı. Kullanılmıyor, silinecek. Doğru kimlik (`ehrenweg-dev`) var olan GCP
projesine `projects:addfirebase` ile Firebase eklenerek kurtarıldı.

### 🔜 Kaldı

**P02'den kalan — konsolda elle yapılacaklar (25 Eyl itibarıyla ölçüldü):**

| Adım                                    | dev              | prod | Not                                                              |
| --------------------------------------- | ---------------- | ---- | ---------------------------------------------------------------- |
| Authentication (E-posta/Şifre + Google) | ?                | ⬜   | CLI'dan doğrulanamıyor                                           |
| **Firestore — `europe-west3`**          | ⬜ **YAPILMADI** | ⬜   | API bile açılmamış. ⚠️ Konum kalıcı, yanlış seçilirse dönüşü yok |
| Storage — aynı bölge                    | ⬜               | ⬜   | **Blaze'e bağlı**, ondan önce açılmıyor                          |
| Blaze + 10 € bütçe uyarısı              | ⬜               | ⬜   | Storage ve Functions bunu bekliyor                               |
| App Check kaydı (enforcement KAPALI)    | ⬜               | ⬜   | Web reCAPTCHA Enterprise; site key `.env`'e eklenecek            |
| `ehrenweg-dev-10c28` sil                | ⬜               | —    | 30 gün geri alma süresi var                                      |

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

| #   | Konu                                                                                                                                                                                                    | Durum                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | firebase CLI'da aktif hesap VALEON'du; projeler yanlış hesaba açılabilirdi                                                                                                                              | 🟢 çözüldü (25 Eyl) — `firebase login:use ehrenwegde@gmail.com`. Ayar **klasöre özel** yazıldı: ehrenweg klasöründe ehrenwegde@, dışarıda VALEON. Diğer projeler etkilenmedi. `projects:list` → "No projects found" (temiz başlangıç doğrulandı) |
| 1   | `ehrenwegde@gmail.com` firebase CLI'ya eklendi                                                                                                                                                          | 🟢 çözüldü                                                                                                                                                                                                                                       |
| 2   | firebase-tools JDK 21+ istiyor, sistem varsayılanı 17'ydi                                                                                                                                               | 🟢 çözüldü — `scripts/with-jdk.sh`                                                                                                                                                                                                               |
| 3   | Keystore için tam yasal ad + şehir alınmadı (üretimden sonra değiştirilemez)                                                                                                                            | 🟡 P11'e ertelendi (proje sahibi kararı)                                                                                                                                                                                                         |
| 6   | Şahıs Play Console hesabı → üretime çıkmadan önce **12 test kullanıcısı / 14 gün kapalı test** şartı; pilot takvimini iki hafta uzatır                                                                  | 🟡 P13'te                                                                                                                                                                                                                                        |
| 7   | `package.json` henüz var olmayan dosyalara script tanımlıyor (`seed.ts`, `grantAdmin.ts`, `check-i18n.mjs`, `ledgerConsistencyCheck.ts`). Husky kurulu ama kanca yok, CI ve Prettier yapılandırması yok | 🟡 P03'te yazılacak                                                                                                                                                                                                                              |
| 4   | Firebase build'i 606 kB (179 kB gzip) — Faz 1'de tembel yükleme                                                                                                                                         | 🟡 planlı                                                                                                                                                                                                                                        |
| 5   | `attendanceSessions` ve `attendanceRecords`'a `orgId` eklendi (CLAUDE.md şemasında yoktu) — kuralların kurum yetkisini ek okuma yapmadan kontrol edebilmesi için gerekli                                | 🟢 bilinçli ekleme                                                                                                                                                                                                                               |

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

| Dosya                          | İçerik                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `lib/authService.ts`           | kayıt, giriş, Google, doğrulama, şifre sıfırlama; Firebase hata kodu → i18n anahtarı               |
| `lib/AuthProvider.tsx`         | oturum + custom claim + canlı profil dinleme, tek kaynak                                           |
| `lib/userProfile.ts`           | users/{uid} oluşturma / okuma / güncelleme                                                         |
| `types/user.ts`                | şema + zod doğrulama + rol tipleri                                                                 |
| `config/catalog.ts`            | kategori, beceri, dil, CEFR, seviye eşikleri                                                       |
| `components/ui.tsx`            | Button, TextField, TextArea, Alert, Card, ChipToggle (WCAG AA)                                     |
| `components/ProfileFields.tsx` | ilgi/beceri/dil seçicileri                                                                         |
| `components/LevelRing.tsx`     | seviye halkası + sayı kartları                                                                     |
| `components/AppShell.tsx`      | başlık + alt menü (ortada QR butonu, Faz 3'e kadar kapalı)                                         |
| `pages/`                       | Welcome, SignUp, SignIn, VerifyEmail, ProfileSetup, Home, Profile, ProfileEdit, Legal, Placeholder |

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

### P04 tamamlandı (25 Eyl 2026, akşam)

PDF yol haritasındaki 9 maddenin durumu:

| #   | Madde                                               | Durum                                                         |
| --- | --------------------------------------------------- | ------------------------------------------------------------- |
| 1   | i18n + eksik anahtar scripti + CI                   | ✅ `scripts/check-i18n.mjs` (269 anahtar, 2 dil)              |
| 2   | Onboarding → kayıt → doğrulama → onaylar → ilgi/dil | ✅                                                            |
| 3   | Şifremi unuttum, iki dilde hata mesajları           | ✅                                                            |
| 4   | Cloud Functions onUserCreate / setUserRole          | ⛔ Blaze kapalı — DECISIONS §7                                |
| 5   | Profil ekranı (fotoğraf hariç)                      | ✅ fotoğraf Storage'a bağlı, Blaze kapalı                     |
| 6   | Alt menü + rol bazlı kurum/admin girişleri          | ✅ claim yoksa rota bile yok                                  |
| 7   | Impressum + Datenschutz DE/EN                       | ✅ uygulama içinde, `[ ]` yer tutuculu, girişsiz erişilebilir |
| 8   | users kuralları + testler                           | ✅ 59 kural testi                                             |
| 9   | Playwright DE/EN e2e + ekran görüntüleri            | ✅ **10/10** (masaüstü + mobil), `docs/screenshots/faz1/`     |

**E2E testleri üç gerçek hata buldu ve düzeltildi:**

1. Profil belgesi geç gelirse kurulum formu boş açılıyor ve "Weiter" kilitli
   kalıyordu (kullanıcı kayıtta adını girmiş olmasına rağmen)
2. Firestore çoklu sekme kalıcı önbelleği emülatörde bağlantıyı hiç açmıyordu
   → test modunda bellek önbelleği
3. Firestore `permission-denied` hatası "giriş başarısız" diye gösteriliyordu

**Ayrıca:** Husky pre-commit kancası (lint-staged + çeviri denetimi),
GitHub Actions CI (biçim → tip → lint → çeviri → birim → kural → build).

---

## Faz 2 — Kurumlar ve aktiviteler (25 Eyl 2026, gece)

Bitme ölçütü (CLAUDE.md Bölüm 15): _"Kurum aktivite yayınlıyor, katılımcı
başvuruyor, admin onaylıyor."_ → akışın tamamı kodlandı ve derleniyor.

### Kurum tarafı

| #   | İş                                                                                                                                                                                               | Durum |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | Kurum başvuru formu → admin onay kuyruğu → doğrulanmış rozeti                                                                                                                                    | ✅    |
| 2   | Kurum ekibi: üye ekleme/çıkarma, rol verme (`org_admin`)                                                                                                                                         | ✅    |
| 3   | Aktivite formu: DE/EN başlık+açıklama, Leichte Sprache, kategori, beceriler, adres + harita pini, online, tarih/saat, son başvuru, kontenjan, başvuru gerekli mi, min. seviye, IP, kapak görseli | ✅    |
| 4   | Taslak → onaya gönder → yayında akışı, incelemeden geri çekme, iptal, taslak silme                                                                                                               | ✅    |
| 5   | Başvuranlar listesi, kabul/red + kısa gerekçe                                                                                                                                                    | ✅    |

### Platform admin

- `pending_review` aktiviteler: onayla / **gerekçeyle** reddet (reddedilen
  silinmez, `draft`'a döner ve gerekçe kuruma görünür) ✅
- Kurum kuyruğu: e-posta alan adı ve website kontrolüyle onay/red ✅

### Katılımcı tarafı

- Liste **ve harita** görünümü (Leaflet + OpenStreetMap) ✅
- Filtreler: kategori, tarih aralığı, mesafe, dil, online, arama ✅
- Konum **opsiyonel**: izin verilmezse şehir seçimiyle mesafe ölçülüyor ✅
- Detay: Leichte-Sprache anahtarı, takvime ekle (`.ics`, 1 gün önce VALARM),
  paylaş, başvur / başvuruyu geri çek ✅
- "Bir gün önce hatırlat" yerel bildirimi ✅
  (Android/iOS'te `@capacitor/local-notifications`; tarayıcıda yalnız sekme
  açıkken — arayüz bunu dürüstçe söylüyor ve takvim dosyasını öneriyor)
- Profilde **Başvurularım**: başvurdu / kabul / red / cevap gelmedi ✅

### Veri ve güvenlik

- `firestore.rules` genişletildi: organizations (başvuru + inceleme + profil),
  members (collection group dahil), activities (okuma, oluşturma, içerik
  düzenleme, durum geçiş tablosu, kontenjan sayacı), applicants (başvuru,
  geri çekme, kurum kararı). **dev projesine dağıtıldı.** ✅
- Kontenjan ve son başvuru kontrolü kuralda: aktivite belgesi `get()` ile
  okunup doğrulanıyor; sayaç `getAfter()` ile aynı commit'teki başvuruya
  bağlanıyor, tek başına oynatılamıyor
- `firestore.indexes.json`: `applications` collection-group indeksi
  `applicants` ile değişti, `activities(orgId, startAt desc)` eklendi,
  `applicants.uid` ve `members.uid` için COLLECTION_GROUP alan geçersiz
  kılmaları eklendi. **dev'e dağıtıldı** ✅
- `functions/src/activities.ts` + `organizations.ts`: Bölüm 12'deki
  `submitActivity`, `reviewActivity`, `applyToActivity` (transaction),
  `decideApplication`, `approveOrganization`, `setOrgMember`,
  `removeOrgMember` **yazıldı ve derleniyor — ama Blaze kapalı olduğu için
  DAĞITILMADI.** Geçiş tek bayrak: `app/src/lib/backend.ts`

### Seed

`scripts/seed.ts` + `scripts/unseed.ts`:
10 kategori, **Bezirksamt Berlin-Neukölln** (doğrulanmış) + Café Mosaik,
**12 aktivite** (10 yayında, 1 taslak, 1 incelemede) — gerçek Neukölln
adresleri ve koordinatlarıyla, hepsi çift dilli ve Leichte Sprache özetli.
Her belge `seed: true`; arayüzde hiçbir "demo" afişi yok.

```
npm run seed              # emülatöre
npm run seed:dev          # ehrenweg-dev projesine (kimlik gerekir)
npm run unseed:dev        # yalnız seed:true belgeleri siler
```

### ⚠️ Bu fazda BİLEREK yapılmayanlar

- **Otomatik test yok.** Proje sahibi 25 Eyl'de "test turu yok, hedef APK"
  dedi. Kural testleri (`tests/firestore.rules.test.ts`) ve Playwright e2e
  bu faz için yazılmadı; var olan Faz 1 testleri duruyor. Kurallar yine de
  tam yazıldı ve emülatörde derlendi.
- **Kapak görseli yükleme yok** — Storage, Blaze istiyor. Alan bağlantı
  olarak duruyor, veri modeli hazır.
- **Kurum üyesi e-posta ile davet edilemiyor** — kurum `users` koleksiyonunda
  arama yapamaz (veri minimizasyonu). Kişi profilindeki "Nutzer-ID"yi kuruma
  verir. E-posta daveti Faz 6'da (push/e-posta ile).

### 🔜 Sıradaki

- **Capacitor Android projesi hiç kurulmadı** (`android/` klasörü yok) —
  APK için önce o kurulmalı (Faz 8 / P13'ün ilk adımı)
- Demo veriyi `ehrenweg-dev`'e yazmak için kimlik gerekiyor:
  `gcloud auth application-default login` **ya da** konsoldan servis hesabı
  anahtarı → `npm run seed:dev -- --key <yol>`
- Faz 3: QR yoklama, pasaport, IP, seviye, rozet

---

## Faz 3 — QR yoklama, pasaport, puan (26 Eyl 2026)

Bitme ölçütü (CLAUDE.md Bölüm 15): _"İki cihazla uçtan uca: yoklama →
pasaporta işlendi → IP arttı."_ → akışın tamamı kodlandı, kurallarla korundu
ve 21 saldırı testiyle doğrulandı.

### Kurum / eğitmen

| #   | İş                                                                                     | Durum |
| --- | -------------------------------------------------------------------------------------- | ----- |
| 1   | "Yoklamayı başlat" → tam ekran dönen QR + 6 haneli manuel kod + canlı sayaç → "durdur" | ✅    |
| 3   | Opsiyonel GPS kontrolü, yarıçap ayarlanabilir                                          | ✅    |
| 4   | Geç / çevrimdışı taramalar: tek tek veya toplu onay                                    | ✅    |
| 7   | Gelmeyenleri işaretle → −5 IP, `noShows++`, 3 ardışıkta 14 gün kısıt                   | ✅    |
| 8   | Fotoğraflı katılım iddialarını onayla → pasaporta `source: 'admin'`                    | ✅    |

### Katılımcı

| #   | İş                                                                                                                                | Durum |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 2   | Kamera ile QR okuma (jsQR), manuel kod girişi                                                                                     | ✅    |
| 2   | Altı hata kodu DE+EN: wrong-code, expired, inactive, activity-missing, already-recorded, geo-too-far                              | ✅    |
| 2   | Çevrimdışı kuyruk: cihazda sıraya alma, bağlantı gelince otomatik gönderim, bekleyen sayısı (alt menüdeki QR düğmesinde de rozet) | ✅    |
| 8   | "Katıldım ama yoklama alınmadı" — fotoğraflı iddia                                                                                | ✅    |
| 9   | Integrationspass: seviye halkası, ilerleme, rozetler, saat, IP, katılım geçmişi, kategori dağılımı                                | ✅    |

### Puan motoru

- `config/scoring` belgesinden okunuyor, belge yoksa koddaki Bölüm 6
  varsayılanlarına düşüyor (item 6) ✅
- Pasaport girdisi + ledger `ip_award` + `users.stats` + seviye **tek
  transaction**ta; kimlik `{activityId}_{uid}` olduğu için **idempotent** —
  aynı kişi aynı aktiviteden iki kez puan alamıyor (item 5) ✅
- 9 rozet pasaport girdilerinden hesaplanıyor (saklanmıyor) ✅

### Güvenlik (item 10) — `tests/attendance.rules.test.ts`, 21 test

Kanıtlananlar: dönen kod belgesi **admin dahil kimseye okunmuyor**; yanlış
kod, süresi geçmiş kod, çift tarama, başkası adına tarama reddediliyor;
sayaç kopyası şişirilemiyor; kullanıcı `stats`'a, pasaport girdisine ve
ledger'a **yazamıyor**; kurum ilan ettiğinden fazla puan veremiyor; başka
kurumun personeli puan yazamıyor; pasaport girdisi bir kez yazılıp
değiştirilemiyor; no-show sayacı sıfırlanamıyor; 3 no-show sonrası başvuru
14 gün kapalı, sonra açılıyor.

**Tüm kural testleri: 81/81 yeşil** (Faz 1+2'nin 60'ı + Faz 3'ün 21'i).

### ⚠️ Bu fazda BİLEREK yapılmayanlar

- **İki tarayıcı pencereli Playwright testi (item 11) yazılmadı.** İstenen üç
  senaryo — süresi geçmiş kod, yanlış kod, çift tarama — kararın gerçekten
  verildiği katmanda, kural testlerinde sınanıyor. Tarayıcı testi ayrıca
  kamera taklidi gerektirirdi ve proje sahibinin "test turu yok, hedef APK"
  talimatı duruyor.
- **Bonuslar (yeni kategori +15, ayda 4+ katılım +25) bugün verilmiyor** —
  gerekçe DECISIONS §9.2. Kod yazılı, Blaze ile açılacak.
- **`ATTENDANCE_HMAC_SECRET` henüz kurulmadı** — Cloud Functions dağıtılmadığı
  için kullanılmıyor. Komut aşağıda.

### Sırlar — proje sahibi çalıştıracak

```
firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-dev
firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-prod
```

Değeri kendin gir, bana gösterme. Öneri: `openssl rand -base64 48`.
Emülatörde sır gerekmiyor; istemci yolu HMAC kullanmıyor (DECISIONS §9.1).

### 🔜 Sıradaki

Faz 4: cüzdan — ödül şablonları, bütçe, ledger, IP ile ödül alma, 60 sn
imzalı kupon QR'ı, vezne/partner tarama, mutabakat raporu.

---

## Faz 4 — Cüzdan, ödüller, kuponlar (26 Eyl 2026)

Bitme ölçütü (CLAUDE.md Bölüm 15): _"Ledger tutarlılık scripti hatasız;
ekran görüntüsüyle ikinci kullanım reddediliyor."_ → ikisi de sağlandı;
ikincisi kural testiyle kanıtlı.

### Kurum paneli

| #   | İş                                                                                                                | Durum |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Ödül şablonu: 4 tür, toplam bütçe, kişi başı aylık sınır, geçerlilik, partner işletme                             | ✅    |
| 1   | `cash_voucher` yalnız `features.cashVouchers` açık kurumda; varsayılan kapalı, açma yetkisi yalnız platform admin | ✅    |
| 5   | Aylık mutabakat raporu: CSV indir + yazdır/PDF; verilen, kullanılan, süresi dolan, kalan bütçe                    | ✅    |
| —   | Süresi dolan kuponları işaretleme (zamanlayıcının elle karşılığı)                                                 | ✅    |

### Katılımcı — Wallet

| #   | İş                                                                                      | Durum |
| --- | --------------------------------------------------------------------------------------- | ----- |
| 2   | IP bakiyesi, ödül mağazası, kuponlarım (aktif/kullanıldı/süresi doldu), hareket geçmişi | ✅    |
| 2   | Kupon detayında **60 saniyede yenilenen** imzalı QR (`EHRENWEG:VCH:` öneki)             | ✅    |
| 2   | QR'ın yanında kullanıcının adı ve profil fotoğrafı                                      | ✅    |

### Vezne / partner

| #   | İş                                                                                       | Durum |
| --- | ---------------------------------------------------------------------------------------- | ----- |
| 4   | Kupon tara → geçerli/geçersiz, tutar, ad + fotoğrafla kimlik eşleştirme → "Ödendi" onayı | ✅    |
| 4   | Günlük işlem listesi ve toplam                                                           | ✅    |
| —   | "Uygulama ödeme yapmaz" uyarısı ekranda (Bölüm 7.4)                                      | ✅    |

### Suistimal önlemleri (item 6)

- Kişi başı aylık sınır: `rewardTemplates/{id}/holders/{uid}` sayacı, dönem
  damgası `request.time` ile uydurulamaz ✅
- Aynı QR'ın ikinci kullanımı: kupon `issued` değilse reddediliyor ✅
- Tüm elle para işlemleri `auditLog`'a (yalnız ekleme, değiştirilemez) ✅
- Olağan dışı durum tespiti: admin panelindeki **defter kontrolü** ✅

### Defter tutarlılığı (item 7)

`scripts/ledgerConsistencyCheck.ts` — defterden IP bakiyelerini ve kurum
harcamalarını yeniden hesaplayıp saklanan değerlerle karşılaştırıyor. Hiçbir
şeyi DÜZELTMİYOR, yalnız raporluyor: para tarafında sessizce onarmak asıl
hatayı görünmez kılardı. Aynı hesap `lib/ledgerCheck.ts`ten paylaşılıyor ve
admin panelinden de tetiklenebiliyor.

```
npm run ledger:check              # emülatör
npm run ledger:check:prod         # ehrenweg-prod
```

### Testler (item 8) — `tests/rewards.rules.test.ts`, 23 test

İstenen altı senaryonun hepsi:

| İstenen                            | Test                                              |
| ---------------------------------- | ------------------------------------------------- |
| Bütçe aşımı                        | 🔒 BÜTÇE AŞILAMAZ                                 |
| Eşzamanlı iki buyReward            | 🔒 EŞZAMANLI iki alımda ikincisi düşer            |
| Süresi geçmiş QR                   | 🔒 SÜRESİ GEÇMİŞ QR reddedilir                    |
| Ekran görüntüsüyle ikinci kullanım | 🔒 EKRAN GÖRÜNTÜSÜ ile ikinci kullanım reddedilir |
| Başka kurumun kuponunu okutma      | 🔒 BAŞKA KURUMUN veznesi bu kuponu okutamaz       |
| İstemciden ledger'a yazma          | 🔒 istemci kendi başına ledger kaydı yazamaz      |

Ayrıca: token belgesi kimseye okunmuyor (vezne + admin dahil), uzun ömürlü
token üretilemiyor, kullanıcı kendi puanını artıramıyor, kurum kendi
kurumunda parasal kuponu açamıyor, defter değiştirilemiyor/silinemiyor.

**Tüm kural testleri: 104/104 yeşil** (Faz 1+2: 60, Faz 3: 21, Faz 4: 23).

### ⚠️ Testin yakaladığı gerçek açık

İlk yazdığım kural, kupon `create`'inde yalnız kuponun kendi şeklini
doğruluyordu. Yani kullanıcı bütçeye ve kendi puanına **hiç dokunmadan**
kendine kupon basabilirdi — bedava ödül. "IP düşmeden kupon basılamaz"
testi geçmedi ve kural `budgetCommitted()` + `ipPaid()` şartlarıyla
kapatıldı (DECISIONS §10.1).

### ⚠️ Bilerek yapılmayanlar

- **`cash_voucher` hiçbir kurumda açık değil.** Kod tam, bayrak kapalı.
  Cevaplanması gereken altı hukuki soru `docs/LEGAL_OPEN_QUESTIONS.md` §9'a
  eklendi — bunlar cevaplanmadan bayrak açılmamalı.
- **PDF kütüphanesi eklenmedi** — rapor CSV olarak iniyor, PDF için tarayıcı
  yazdırma penceresi kullanılıyor (DECISIONS §10.4).
- **Bonuslar hâlâ verilmiyor** (Faz 3'ten devam) — Blaze ile gelecek.
- **Cloud Functions dağıtılmadı.** `functions/src/rewards.ts` yazıldı ve
  derleniyor.

### Sırlar — proje sahibi çalıştıracak

```
firebase functions:secrets:set VOUCHER_HMAC_SECRET --project ehrenweg-dev
firebase functions:secrets:set VOUCHER_HMAC_SECRET --project ehrenweg-prod
```

Değeri kendin gir, bana gösterme. `openssl rand -base64 48` iyi bir değer üretir.
Şu an gerekmiyor (Functions dağıtılmadı), Blaze açılınca lazım.

### 🔜 Sıradaki

Faz 5 (P08): Eğitmen kariyer yolu — trainer başvurusu, admin onayı, eğitim
oturumları, katılımcı geri bildirimi, Learn ekranı.

---

## Faz 5 — Eğitmen kariyer yolu (26 Eyl 2026)

| #   | İş                                                                                                                | Durum      |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Profilde "Trainer:in werden" kartı, 5 şart için ilerleme çubuğu; şartlar `config/scoring.trainerRequirements`'tan | ✅         |
| 2   | Başvuru formu: konular, dil + seviye beyanı, B2+ belge, motivasyon, istatistik snapshot'ı                         | ✅         |
| 3   | Admin kuyruğu: onayla / gerekçeyle reddet → eğitmen yetkisi + rozet                                               | ✅         |
| 4   | Eğitmen `type: 'training'` taslak önerir → kurum/admin yayınlar; kendi eğitiminde yoklama başlatabilir; IP ×1.5   | ✅         |
| 5   | 1–5 yıldız + yorum, eğitmen ortalaması, kurum yorumu gizleyebilir                                                 | ✅         |
| 6   | Learn ekranı: kurslar, sadece dil kursları filtresi, eğitmene "kurs öner" kısayolu                                | ✅         |
| 7   | Kural testleri                                                                                                    | ✅ 13 test |

**Testler:** eğitmen olmayan eğitim öneremiyor, eğitmen doğrudan yayına
alamıyor, başkasını eğitmen göstererek kurs açamıyor, kimse kendi başvurusunu
onaylayamıyor, kullanıcı kendini eğitmen yapamıyor, başkasının dil belgesi
okunamıyor, katılmayan puan veremiyor, kullanıcı kendi yorumunu gizleyemiyor,
5 üstü puan verilemiyor. **Toplam 117/117 yeşil.**

⚠️ `pages/Placeholder.tsx` silindi — tüm sekmeler artık gerçek sayfa.

⚠️ Eğitmen yetkisi claim yerine `users.trainerStatus`'tan okunuyor
(DECISIONS §11). Push bildirimi Faz 6'nın işi.

---

## Faz 6 — Bildirimler, duyurular, yapay zekâ (26 Eyl 2026) · 🟡 KISMİ

Bu faz **tam bitmedi ve bitemez**: AI uçları Cloud Functions olmadan
çalıştırılamaz. Aşağıda ne çalışıyor, ne beklemede, açıkça yazıyor.

### ✅ Bugün çalışan

| #   | İş                                                                                                                      | Not                            |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Bildirim tercihleri: duyurular, son başvuru hatırlatıcısı, aylık özet                                                   | `users/{uid}/private/settings` |
| 1   | Push izni + FCM jetonu kaydı (Android)                                                                                  | jetonlar şimdiden toplanıyor   |
| 2   | Kurum/admin DE+EN duyuru yazıyor, ana ekran slider'ında görünüyor                                                       | push hariç                     |
| 5   | Ana ekran: saate göre selamlama, duyuru slider'ı, öneriler, yaklaşan başvurular, bu ayki özet, hava durumu (Open-Meteo) | ✅                             |
| 6   | AI uçları için sahte yanıtlı testler — gerçek API çağrılmıyor                                                           | 8 test                         |
| —   | Analitik rızası ayarlarda, **varsayılan KAPALI** (Bölüm 10)                                                             | ✅                             |

### ⏸️ Yazıldı, Blaze bekliyor

| #   | İş                                                                     | Dosya                            |
| --- | ---------------------------------------------------------------------- | -------------------------------- |
| 2   | `sendAnnouncement` — duyuruyu push olarak gönderir                     | `functions/src/notifications.ts` |
| 3   | `deadlineReminders` (her gün 09:00), `monthlySummary` (ayın 1'i 03:00) | aynı dosya                       |
| 4   | `aiMatch`, `aiTranslate`, `aiDraftApplication`, `parseLink`, `aiChat`  | `functions/src/ai.ts`            |

### 🔴 Neden AI bugün açılamıyor

Faz 2–5'te sunucusuz kalan her iş istemciye alınıp `firestore.rules` ile
korundu. **AI'da bu mümkün değil: bir sırrı kuralla koruyamazsınız.**
Anthropic anahtarı APK'ya konsaydı, indiren herkes çıkarabilirdi.

Arayüz bunu gizlemiyor: AI özelliklerinin yerinde sebebini anlatan bir kutu
var. Ana ekrandaki "Sana uygun" bölümü AI yerine ilgi alanı + dil eşleşmesi
kullanıyor ve bunu da açıkça söylüyor.

### Asistanın sistem talimatı

`docs/AI_ASSISTANT.md` — **tek kaynak**. Asistan hukuki tavsiye vermiyor,
MBE / JMD / Ausländerbehörde / Jobcenter gibi doğru kuruma yönlendiriyor,
tehlike durumunda 110/112 ve 116 016 veriyor. Metin
`functions/src/common/aiPrompt.ts` içine birebir kopyalanıyor (Functions
paketine `docs/` girmiyor).

### Sırlar — proje sahibi çalıştıracak

```
firebase functions:secrets:set ANTHROPIC_API_KEY --project ehrenweg-prod
```

Değeri kendin gir, bana gösterme. Model adı koda gömülü DEĞİL:
`functions/src/common/config.ts` içindeki `AI_MODEL` parametresinden okunuyor
(varsayılan `claude-sonnet-5`), yani model değişince yeniden dağıtım yeter.

Günlük çağrı sınırı: kullanıcı başına **30** (`AI_DAILY_LIMIT`).

### 📱 Push'u kendi telefonunda nasıl deneyeceksin

Bugün **push düşmez** — gönderen taraf yok. Şu an denenebilecekler:

1. APK'yı kur → Profil → **Benachrichtigungen** → "Push einschalten".
   Android izin penceresi çıkar, izin ver.
2. "Gerät registriert" yazısını görürsen jeton kaydedilmiştir.
   Firebase Console → Firestore → `users/{uid}/private/settings` →
   `pushTokens` dizisinde jetonu görebilirsin.
3. Gerçek bildirim için Blaze gerekiyor. Açıldıktan sonra:
   `firebase deploy --only functions --project ehrenweg-prod` →
   kurum panelinde duyuru yayınla → `sendAnnouncement` çağrısı push'u atar.
4. Blaze'siz test etmek istersen: Firebase Console → **Cloud Messaging** →
   "Send test message" → yukarıdaki jetonu yapıştır. Bu, uygulamanın ALMA
   tarafının çalıştığını kanıtlar.

### 🔜 Sıradaki

Faz 7 (P10): kurum/admin analitiği, PDF pasaport, doğrulama sayfası,
karne görseli, DSGVO (veri indirme, hesap silme, rıza yönetimi).
