# CLAUDE.md — Ehrenweg Ana Geliştirme Talimatı

> Bu dosyayı projenin kök klasörüne `CLAUDE.md` adıyla koy. Claude Code her oturumda otomatik okur.
> İlk komut olarak terminalde şunu yaz: `claude` → sonra: **"CLAUDE.md'yi oku ve Faz 0'dan başla."**

---

## 0. Senin rolün ve çalışma kuralların

Sen bu projenin **baş mimarı ve baş geliştiricisisin**. Proje sahibiyle **Türkçe** konuş; uygulamanın arayüz dili **Almanca (varsayılan) ve İngilizce**.

Kurallar:

1. **Fazlara böl, her fazın sonunda dur.** Ne yaptığını 5–10 satırla özetle, neyi test ettiğini söyle, onay almadan sonraki faza geçme.
2. **Para veya geri dönüşü olmayan işlemlerden önce mutlaka sor:** Firebase Blaze plana geçiş, fatura hesabı bağlama, proje silme, prod veritabanına yazma, mağazaya yükleme.
3. **Konsolda elle yapılması gereken adımlarda** (ör. Auth sağlayıcısı açma, faturalandırma, Play Console) dur, kullanıcıya adım adım ne tıklayacağını yaz, "tamam" demesini bekle.
4. **Sır yönetimi:** API anahtarları, servis hesabı JSON'ları, `.env` dosyaları asla git'e girmez. `.gitignore`'u ilk commit'ten önce kur. Sunucu sırları Google Secret Manager'da tutulur.
5. **Önce emülatör:** Her özellik önce Firebase Emulator Suite'te çalışıp test edilir, sonra dev projesine deploy edilir.
6. **Küçük ve sık commit** at, Conventional Commits formatında (`feat:`, `fix:`, `chore:`).
7. Emin olmadığın bir iş kuralında **tahmin etme, sor.**
8. Her faz sonunda `docs/PROGRESS.md` dosyasını güncelle (ne bitti, ne kaldı, bilinen sorunlar).

---

## 1. Ürün özeti

**Referans uygulama: BazaltGo** (Bazalt Gençlik Derneği). Orada dernek projeler yayınlar, gençler başvurur/katılır, katılım QR yoklamayla "Gönüllü Pasaportu"na işlenir, seviye ve rozet kazanılır.

**Bizim uygulama:** Aynı mantık, farklı hedef kitle ve amaç:

- **Kullanıcılar:** Almanya'daki (sonra tüm Avrupa'daki) mülteciler ve göçmenler.
- **İçerik:** Belediyeler, valilikler, resmi kurumlar ve onaylı STK'lar **gönüllülük aktiviteleri** ve **eğitimler** yayınlar (bahçe/park temizliği, yaşlılara yardım, Almanca/İngilizce dersi, mahalle etkinlikleri vb.).
- **Katılım:** Kullanıcı aktiviteye başvurur, gider, yerinde QR ile yoklama verir → katılım profiline işlenir.
- **Kazanım:**
  1. **Entegrasyon Puanı (IP)** — itibar/seviye puanı, paraya çevrilmez.
  2. **Ödüller** — hediye çekleri, kafe/mağaza indirimleri (partner işletmeler).
  3. **Parasal kuponlar** — kurumun bütçesinden, belediye/valilik/devlet tarafından paraya veya ayni yardıma çevrilebilir.
- **Kariyer yolu:** Yeterli geçmişe sahip kullanıcılar başvurur, admin onaylarsa **Eğitmen (Trainer)** olur ve kendisi eğitim açabilir.

## 1A. Marka ve kimlik: **Ehrenweg**

Uygulamanın adı **Ehrenweg**'dir ("Ehrenamt" = gönüllülük + "Weg" = yol → _gönüllülükle entegrasyon yolu_). Ad **her dilde aynı kalır, çevrilmez.**

| Alan                           | Değer                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Görünen ad (tüm dillerde)      | `Ehrenweg`                                                                                                                  |
| Slogan DE                      | _Dein Weg durchs Ehrenamt – mitten in die Gesellschaft._                                                                    |
| Slogan EN                      | _Your path through volunteering – into the heart of the community._                                                         |
| Android `applicationId` (prod) | `de.ehrenweg.app`                                                                                                           |
| Android `applicationId` (dev)  | `de.ehrenweg.app.dev` (aynı cihaza ikisi birden kurulabilsin; dev adı `Ehrenweg Dev`)                                       |
| iOS Bundle ID                  | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`)                                                                              |
| Firebase projeleri             | `ehrenweg-dev`, `ehrenweg-prod`                                                                                             |
| Cloud Functions bölgesi        | `europe-west3`                                                                                                              |
| Web / PWA                      | `ehrenweg.de` (öneri; alan adını kullanıcı alır), kurum paneli `app.ehrenweg.de`                                            |
| Destek e-postası               | `support@ehrenweg.de` (yer tutucu, kullanıcıya sor)                                                                         |
| Deep link                      | `ehrenweg://` şeması + App Links / Universal Links: `https://ehrenweg.de/a/{activityId}`                                    |
| QR içerik ön eki               | `EHRENWEG:ATT:` (yoklama), `EHRENWEG:VCH:` (kupon); başka uygulamanın QR'ı okutulursa anlaşılır hata ver                    |
| Tema rengi                     | Ana renk petrol yeşili `#0F766E`, vurgu amber `#F59E0B`, koyu arka plan `#0B1220` (BazaltGo'nun indigo paletinden ayrışsın) |
| Tipografi                      | Inter (BazaltGo'daki gibi); ileride Arapça için Noto Sans Arabic                                                            |
| İkon                           | Soyut yol + el/kalp motifi; tek SVG'den `@capacitor/assets` ile tüm boyutlar (adaptive icon, splash, PWA 192/512/maskable)  |

Adın geçtiği her şey tek kaynaktan gelir: `app/src/config/brand.ts` (ad, slogan, renkler, URL'ler, e-posta). Ad bir gün değişirse yalnız bu dosya ve native kimlikler değişir.

Ad aşağıdaki yerlerin **hepsinde** ayarlanır:

- `capacitor.config.ts` → `appId: 'de.ehrenweg.app'`, `appName: 'Ehrenweg'`
- `android/app/build.gradle` → `productFlavors { dev { applicationIdSuffix ".dev"; resValue "string","app_name","Ehrenweg Dev" } prod { resValue "string","app_name","Ehrenweg" } }`
- `android/app/src/main/res/values/strings.xml` → `app_name` tanımını kaldır (flavor'daki `resValue` ile çakışmasın), `title_activity_main` = Ehrenweg
- `ios/App/App/Info.plist` → `CFBundleDisplayName = Ehrenweg`; izin metinleri (`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`) `de.lproj` ve `en.lproj` altındaki `InfoPlist.strings` ile iki dilde
- `app/public/manifest.webmanifest` → `name: "Ehrenweg"`, `short_name: "Ehrenweg"`, `lang: "de"`, `theme_color: "#0F766E"`
- `index.html` `<title>`, meta açıklama, Open Graph etiketleri
- i18n: `common.appName` anahtarı **çevrilmez**, iki dilde de `Ehrenweg`
- Push bildirim kanalları: DE „Ehrenweg – Aktivitäten“, EN "Ehrenweg – Activities"
- PDF pasaport: „Ehrenweg Integrationspass“ / "Ehrenweg Integration Passport"; doğrulama adresi `https://ehrenweg.de/verify/{id}`
- Firebase Auth e-posta şablonları: gönderen adı `Ehrenweg`, dil kullanıcının diline göre

**Marka kontrolü (yayından önce kullanıcıya hatırlat):** "Ehrenweg" adının DPMA (Almanya) ve EUIPO (AB) marka kayıtlarında, Google Play ve App Store'da, `ehrenweg.de` alan adında müsait olup olmadığı kontrol edilmeli. Bu kontrolü yapamazsan bağlantıları ver ve maddeyi `docs/LEGAL_OPEN_QUESTIONS.md`'ye ekle.

---

## 2. BazaltGo'dan tersine mühendislikle çıkarılan mimari (birebir örnek alınacak)

APK incelemesinde tespit edilenler:

| Alan                  | BazaltGo'da olan                                                                                                                                                                                                                                                                                             | Bizde karşılığı                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Teknoloji             | React + Vite + TypeScript, Capacitor (Android/iOS), PWA (service worker, manifest)                                                                                                                                                                                                                           | Aynısı                                                                                                |
| Backend               | Firebase Auth, Firestore, FCM, App Check (reCAPTCHA Enterprise) + Cloud Run'da Node API (`europe-west1`)                                                                                                                                                                                                     | Aynısı, ama **bölge `europe-west3` (Frankfurt)** — Alman veri yerleşimi                               |
| Capacitor eklentileri | app, camera, filesystem, geolocation, local-notifications, push-notifications, share, badge, calendar, App Check                                                                                                                                                                                             | Aynısı                                                                                                |
| Sekmeler              | HOME, PROJECTS, ACADEMY, PROFILE, ADMIN, UPLOADER                                                                                                                                                                                                                                                            | HOME, ACTIVITIES, LEARN, PROFILE, ORG (kurum paneli), ADMIN                                           |
| Koleksiyonlar         | `kullaniciPasaportu`, `bekleyenOnaylar`, `bekleyenProjeYuklemeleri`, `duyurular`, `sertifikalar`, `akademiGonderileri`, `feedback`, `slider`, `kullaniciAyarlari`, `yetkililer`, `yoklamaOturumlari`, `yoklamaKodlari`, `yoklamaKayitlari`                                                                   | Bölüm 5'teki İngilizce şema                                                                           |
| Roller                | `admin`, `ekleyici` (içerik yükleyici), üye                                                                                                                                                                                                                                                                  | Bölüm 4'teki genişletilmiş roller                                                                     |
| Yoklama               | Yönetici "yoklamayı başlat" der, ekranda **periyodik değişen QR** çıkar; üye okutur; hata kodları `wrong-code / expired / inactive / project-missing`; QR okutamayana **manuel kod**; internet yoksa tarama **çevrimdışı kuyruğa** alınır, gelince gönderilir; kod süresi geçmişse yönetici **elle onaylar** | Aynısı + GPS mesafe kontrolü (opsiyonel, kurum açar)                                                  |
| Pasaport              | "Gönüllü Pasaportu": katılımlar, gönüllülük saati (QR'lı etkinliklerden birikir), PDF pasaport, paylaşılabilir "karne" görseli                                                                                                                                                                               | "Integration Passport / Integrationspass"                                                             |
| Seviyeler             | Katılım sayısına göre: 1 → GÖNÜLLÜ, 3 → AKTİF GÖNÜLLÜ, 6 → PROJE ELÇİSİ, 12 → KIDEMLİ ELÇİ, 25 → BAZALT LİDERİ                                                                                                                                                                                               | Bölüm 6                                                                                               |
| Rozetler              | İlk proje, 3/10/20 proje, 3/5 farklı kategori, uluslararası vb.                                                                                                                                                                                                                                              | Bölüm 6                                                                                               |
| Onay akışı            | Üyenin kendi eklediği katılım → `bekleyenOnaylar` → admin onaylar → pasaporta `source:"admin", status:"completed"` batch yazımı; ekleyicinin yüklediği proje → `bekleyenProjeYuklemeleri` → admin yayına alır                                                                                                | Aynısı                                                                                                |
| Başvuru takibi        | "Başvurdun mu?" → sonucu (kabul/red/cevap gelmedi) → katıldı/katılmadı; admin analitiği: başvuru→katılım oranı, kategori dağılımı, PDF rapor                                                                                                                                                                 | Aynısı                                                                                                |
| AI uçları             | `/api/ai/chat` (danışman sohbet), `/api/ai/match` (ilgi alanına göre proje önerisi + gerekçe), `/api/ai/motivation-letter`, `/api/ai/karne-tanitim`, `/api/parse-news` (link'ten başlık/görsel/açıklama otomatik doldurma)                                                                                   | Aynısı; motivasyon mektubu yerine "başvuru mesajı taslağı" + **basit dil (Leichte Sprache) çevirisi** |
| Diğer                 | Push ile duyuru gönderme (`/api/push/send`), son başvuru hatırlatıcıları, takvime ekleme, karanlık/aydınlık tema, hesap silme (`/api/hesabimi-sil`), çevrimdışı önbellek                                                                                                                                     | Aynısı                                                                                                |

---

## 3. Teknoloji yığını (kesin)

- **Frontend:** React 18 + Vite + TypeScript (strict), Tailwind CSS, React Router, TanStack Query, Zustand (hafif state), `react-i18next`, `zod` (form doğrulama), `html5-qrcode` veya `jsQR` (BazaltGo jsQR kullanıyor), `qrcode` (üretim), `date-fns`.
- **Mobil:** Capacitor 6+ (Android önce, iOS sonra). Uygulama adı **Ehrenweg**, paket/bundle kimliği **`de.ehrenweg.app`** (ayrıntılar Bölüm 1A ve 16).
- **Backend:** Firebase — Auth, Firestore (Native mode, **konum `eur3` veya `europe-west3`**, kullanıcıya sor), Storage, Cloud Functions **v2** (Node 20, TypeScript, `region: europe-west3`), FCM, App Check.
  - BazaltGo ayrı bir Cloud Run Express API kullanıyor; biz aynı uçları **Cloud Functions v2 (onCall + onRequest)** olarak yazacağız — daha az altyapı, aynı sonuç.
- **AI:** Anthropic Claude API (sunucu tarafında, anahtar Secret Manager'da). Model adını kodda sabitleme; `functions/config` üzerinden ayarlanabilir yap.
- **Test:** Vitest (birim), `@firebase/rules-unit-testing` (Firestore kuralları — **zorunlu**), Playwright (kritik akışlar için e2e).
- **Kalite:** ESLint, Prettier, Husky pre-commit, GitHub Actions CI (lint + test + build).
- **Monorepo yapısı:**

```
/app            → React + Capacitor istemci
/functions      → Cloud Functions (TS)
/firestore.rules, /storage.rules, /firestore.indexes.json
/docs           → PROGRESS.md, ARCHITECTURE.md, DATA_MODEL.md, PRIVACY.md
/scripts        → seed verisi, admin atama scripti
```

---

## 4. Roller ve yetkiler

Roller **Firebase Auth custom claims** ile tutulur (Firestore'daki alan yalnızca görüntüleme içindir; yetki kontrolü claim'den yapılır). Claim'leri yalnızca Cloud Function değiştirebilir.

| Rol                  | Kim                                      | Yapabildikleri                                                                                         |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `participant`        | Mülteci/göçmen kullanıcı (varsayılan)    | Aktivite görme, başvurma, QR ile katılım, profil, ödül görme/kullanma, trainer başvurusu               |
| `trainer`            | Admin onaylı katılımcı                   | + Eğitim oturumu önerme (kurum veya admin onayıyla yayınlanır), kendi eğitiminde yoklama başlatma      |
| `org_staff`          | Belediye/kurum çalışanı                  | Kendi kurumu adına aktivite oluşturma, yoklama başlatma, katılımcı listesi, elle katılım onayı         |
| `org_admin`          | Kurumun yöneticisi                       | + Kurum personeli ekleme/çıkarma, kurum bütçesi ve ödül tanımlama, kurum analitiği                     |
| `redemption_officer` | Belediye veznesi/sosyal hizmet görevlisi | Parasal kuponu tarama ve "ödendi" olarak işaretleme (yalnızca kendi kurumunun kuponları)               |
| `partner`            | Kafe/mağaza (indirim veren)              | Kendi indirim kuponunu doğrulama/kullanıldı işaretleme                                                 |
| `platform_admin`     | Sen / proje sahibi                       | Her şey: kurum doğrulama, trainer onayı, içerik moderasyonu, puan kuralları, dolandırıcılık incelemesi |

**Kurum doğrulama:** Bir kurum kendi başına kayıt olamaz. `organizations` başvurusu yapar → `platform_admin` resmi belge/e-posta alan adı kontrolüyle onaylar (ör. `@berlin.de`). Onaylı kurumların profilinde doğrulanmış rozeti görünür.

---

## 5. Veri modeli (Firestore)

Tüm tarihler `Timestamp`. Çok dilli metinler `{ de: string, en: string }` nesnesi olarak saklanır.

```
users/{uid}
  displayName, photoURL, email, locale ('de'|'en'), city, countryCode,
  languages: [{code, level}]         // konuştuğu diller, CEFR seviyesi
  skills: string[]                    // beceri etiketleri (sabit sözlükten)
  interests: string[]                 // kategori id'leri
  bio, roleDisplay, orgId?            // görüntüleme amaçlı
  stats: { ip, hours, activitiesCompleted, noShows, categoriesCount, level } // yalnız sunucu yazar
  trainerStatus: 'none'|'pending'|'approved'|'rejected'
  createdAt, lastActiveAt
  // HASSAS VERİ YOK: oturum izni türü, uyruk, din, sağlık vb. SAKLANMAZ (bkz. Bölüm 10)

users/{uid}/private/settings         // bildirim tercihleri, push token'ları
users/{uid}/applications/{activityId} // başvuru: status 'applied'|'accepted'|'rejected'|'no_response'|'withdrawn', attended bool

organizations/{orgId}
  name, type ('municipality'|'state'|'federal'|'ngo'|'partner_business'), city, country,
  verified bool, logoURL, website, contactEmail, budget: { currency:'EUR', allocated, spent } // sunucu yazar

organizations/{orgId}/members/{uid}  // role: 'org_admin'|'org_staff'|'redemption_officer'

categories/{id}                      // environment, elderly_care, language_teaching, language_learning,
                                     // children_youth, culture, sports, digital_skills, community, other
                                     // name:{de,en}, icon, color

activities/{activityId}
  orgId, createdBy, type: 'volunteering'|'training', trainerUid?,
  title:{de,en}, description:{de,en}, simpleDescription:{de,en}  // Leichte Sprache
  categoryId, skillsGained: string[], languagesUsed: string[],
  location: { address, lat, lng, geohash }, online bool,
  startAt, endAt, applicationDeadline, capacity, requiresApplication bool,
  minLevel (0 = herkes), status: 'draft'|'pending_review'|'published'|'cancelled'|'completed',
  rewards: { ip: number, rewardTemplateIds: string[] },
  hoursCredited: number, coverImageURL, passportEnabled bool
  stats: { applicants, attendees } // sunucu yazar

attendanceSessions/{sessionId}       // BazaltGo: yoklamaOturumlari
  activityId, startedBy, active bool, startedAt, endedAt,
  rotationSeconds (varsayılan 30), manualCode (6 hane), requireGeo bool, geoRadiusMeters

attendanceSessions/{sessionId}/codes/{codeId}  // yalnız sunucu; HMAC imzalı, kısa ömürlü
attendanceRecords/{sessionId_uid}    // BazaltGo: yoklamaKayitlari
  uid, activityId, sessionId, method: 'qr'|'manual_code'|'staff_approved'|'offline_late',
  scannedAt, status: 'confirmed'|'pending_review'|'rejected', geoOk?

passportEntries/{entryId}            // BazaltGo: kullaniciPasaportu
  uid, activityId, orgId, categoryId, hours, ipAwarded, skillsGained,
  source: 'attendance'|'admin', status: 'completed', approvedAt
  // Kullanıcı bunu ASLA doğrudan yazamaz

pendingClaims/{id}                   // BazaltGo: bekleyenOnaylar — kullanıcının "katıldım" iddiası, kanıt fotoğrafıyla

rewardTemplates/{id}
  orgId, kind: 'integration_points'|'gift_voucher'|'discount'|'cash_voucher',
  title:{de,en}, valueCents?, discountPercent?, partnerOrgId?,
  costIp?,                           // ödül mağazasında IP ile "satın alınıyorsa"
  validityDays, totalBudgetCents?, issuedCount, maxPerUserPerMonth

vouchers/{voucherId}                 // kullanıcıya verilmiş somut kupon
  uid, templateId, orgId, kind, valueCents?, status: 'issued'|'redeemed'|'expired'|'revoked',
  issuedAt, expiresAt, redeemedAt?, redeemedBy?, redemptionOrgId?

ledger/{txId}                        // DEĞİŞMEZ muhasebe defteri — yalnızca ekleme, silme/güncelleme yok
  uid, type: 'ip_award'|'ip_spend'|'voucher_issue'|'voucher_redeem'|'voucher_revoke'|'adjustment',
  amount, currency ('IP'|'EUR'), refId, orgId, actorUid, reason, createdAt

trainerApplications/{uid}
  status, submittedAt, reviewedBy, reviewedAt, note,
  snapshot: { level, hours, activitiesCompleted, noShowRate, languageCertificates[], topics[] }

announcements/{id}  (BazaltGo: duyurular)   orgId?, title:{de,en}, body:{de,en}, pushSent bool
slider/{id}                                  ana sayfa banner'ları
feedback/{id}
certificates/{id}                            katılım belgesi PDF meta verisi (Storage yolu)
auditLog/{id}                                admin/kurum işlemlerinin kaydı (kim, ne, ne zaman)
config/scoring                               puan kuralları (admin değiştirir, sürüm numaralı)
```

**Kural:** `stats`, `passportEntries`, `vouchers`, `ledger`, `attendanceRecords`, custom claim'ler, bütçe alanları **yalnızca Cloud Functions** tarafından yazılır. İstemci bunlara Firestore Rules ile yazamaz.

---

## 6. Oyunlaştırma: Entegrasyon Puanı, seviye, rozet

`config/scoring` (admin panelinden değiştirilebilir, varsayılanlar):

- **IP kazanımı:** her onaylı katılım `activity.rewards.ip` (varsayılan: 10 IP/saat, aktivite başına üst sınır 60).
- **Bonuslar:** yeni kategoride ilk katılım +15; aynı ay 4+ katılım +25; eğitmen olarak ders verme saat başı ×1.5.
- **Cezalar:** başvurup kabul edilip gelmeme (no-show) → −5 IP ve `noShows++`; 3 ardışık no-show → 14 gün başvuru kısıtı (kullanıcıya nazikçe açıklanır).
- **Seviyeler** (BazaltGo eşik mantığı, katılım sayısı + saat birlikte):

| Seviye | DE              | EN             | Eşik                            |
| ------ | --------------- | -------------- | ------------------------------- |
| 1      | Neuankömmling   | Newcomer       | 0                               |
| 2      | Engagiert       | Engaged        | 3 katılım                       |
| 3      | Brückenbauer:in | Bridge Builder | 8 katılım, 20 saat              |
| 4      | Mentor:in       | Mentor         | 15 katılım, 50 saat, 3 kategori |
| 5      | Botschafter:in  | Ambassador     | 30 katılım, 120 saat            |

- **Rozetler:** İlk Adım (1), Düzenli (3), Kıdemli (10), Efsane (25); Kaşif (3 kategori), Çok Yönlü (5 kategori); Dil Köprüsü (dil eğitimine 5 kez katılım veya ders verme); Mahalle Kahramanı (aynı ilçede 10 katılım); Eğitmen (trainer onayı).
- **Ay sonu:** zamanlanmış fonksiyon (`onSchedule`, her ayın 1'i 03:00 Europe/Berlin) aylık özet üretir, push ile "Bu ay X saat, Y IP" bildirimi atar, kurumların tanımladığı aylık ödül kurallarını çalıştırır.

---

## 7. Ödül ve parasal kupon sistemi (EN KRİTİK BÖLÜM)

Bu bölüm gerçek para içerdiği için **güvenlik ve denetlenebilirlik birinci öncelik.**

1. **Kupon her zaman bir kurumun bütçesinden çıkar.** Kurum `org_admin`'i bir `rewardTemplate` tanımlar ve toplam bütçe koyar. Bütçe aşılamaz (Firestore transaction ile kontrol).
2. **Kupon verme** yalnızca sunucu tarafında, şu tetiklerden biriyle olur: aktivite tamamlanınca otomatik kural, ay sonu kuralı, kullanıcının IP ile ödül mağazasından seçmesi (onCall fonksiyon, IP bakiyesi transaction içinde düşülür).
3. **Her hareket `ledger`'a yazılır.** Kullanıcının IP bakiyesi ve kurumun harcaması ledger'dan yeniden hesaplanabilir olmalı (tutarlılık kontrol scripti yaz).
4. **Kullanım (redemption):**
   - Kullanıcının uygulamasında kupon, **kısa ömürlü (60 sn), sunucu imzalı QR** olarak gösterilir (voucherId + nonce + exp + HMAC). Ekran görüntüsü tekrar kullanılamaz.
   - `redemption_officer` veya `partner` kendi uygulama ekranından tarar → `redeemVoucher` onCall fonksiyonu: imza, süre, durum, kurum yetkisi kontrolü → transaction ile `redeemed` yapar → ledger kaydı → iki tarafa bildirim.
   - Parasal kuponlarda uygulama **ödeme yapmaz**; yalnızca "vezne şu tutarı ödedi" kaydını tutar. Gerçek ödeme kurumun kendi süreciyle (nakit/banka havalesi/ayni) olur. Kurum paneli aylık **CSV/PDF mutabakat raporu** üretir.
5. **Suistimal önlemleri:** kişi başı aylık kupon üst sınırı; aynı cihazdan çoklu hesap tespiti (App Check + cihaz parmak izi hash'i, yalnızca işaretleme için); tek kurumdan olağandışı yüksek onay oranı için admin uyarısı; tüm manuel onaylar `auditLog`'a.
6. **Tutarlar ve parasal kupon özelliği kurum bazında açılıp kapatılabilir** (`organizations.features.cashVouchers`). Varsayılan: **kapalı.** Bölüm 10'daki hukuki notu gör.

---

## 8. Eğitmen (Trainer) kariyer yolu

- Profilde "Eğitmen ol / Trainer werden" kartı; şartlar ve kullanıcının mevcut ilerlemesi çubuklarla gösterilir.
- **Varsayılan şartlar** (`config/scoring.trainerRequirements`, admin değiştirebilir): seviye ≥ 3, ≥ 20 gönüllülük saati, ≥ 8 onaylı katılım, no-show oranı < %15, hesap yaşı ≥ 60 gün, öğretmek istediği konu(lar) ve dil seviyesi beyanı (dil eğitimi verecekse B2+ belge yüklemesi).
- Şartlar sağlanınca başvuru butonu aktifleşir → `trainerApplications` → `platform_admin` (veya ilgili kurumun `org_admin`'i) inceler → onaylanırsa `setTrainerRole` fonksiyonu custom claim ekler, rozet verir, push atar.
- Trainer eğitim önerir → ilgili kurum onaylar → yayına girer. Trainer kendi eğitiminde yoklama başlatabilir. Eğitimlerine gelen katılımcı geri bildirimleri (1–5 yıldız + yorum) profilinde ortalama olarak görünür.

---

## 9. Ekranlar

**Katılımcı:**

- **Onboarding:** dil seçimi (DE/EN, ilk ekran), kısa tanıtım (3 kart), kayıt (e-posta+şifre, Google, Apple), e-posta doğrulama, ilgi alanları ve konuştuğu diller, konum izni (opsiyonel, "yakınımdakiler" için).
- **Home:** selamlama (saat dilimine göre), duyuru slider'ı, "Sana uygun" AI önerileri, yaklaşan başvurularım, bu ayki özet (IP/saat), hava durumu (Open-Meteo, BazaltGo'daki gibi).
- **Activities:** liste + harita görünümü, filtre (kategori, tarih, mesafe, dil, online), detay sayfası (Leichte Sprache anahtarı, takvime ekle, paylaş, başvur, hatırlatma kur).
- **Scan:** alt menüde ortada büyük QR butonu; kamera ile tarama, manuel kod girişi, çevrimdışı kuyruk göstergesi.
- **Learn (Akademi):** dil ve beceri eğitimleri, trainer'ların oturumları, kaynak içerikler.
- **Wallet:** IP bakiyesi, ödül mağazası, kuponlarım (aktif/kullanılmış/süresi dolmuş), kupon QR'ı.
- **Profile / Integrationspass:** seviye halkası, rozetler, beceriler, diller, katılım geçmişi (katıldı / katılmadı / başvurdu-sonuç), saat grafiği, **PDF pasaport indir** (işverene/kuruma gösterilebilir, doğrulama QR'ı içerir), paylaşılabilir karne görseli, trainer kartı, ayarlar, **hesabımı sil**, **verilerimi indir** (DSGVO Art. 20).

**Kurum paneli (org_staff / org_admin):** aktivite oluştur (link'ten otomatik doldurma, AI ile DE↔EN çeviri ve Leichte Sprache özeti), başvuranlar listesi ve kabul/red, **yoklama başlat** (tam ekran dönen QR + manuel kod + canlı katılımcı sayacı), geç/çevrimdışı taramaları elle onayla, ödül şablonları ve bütçe, analitik (başvuru→katılım oranı, kategori dağılımı, en çok katılım alan aktiviteler, PDF rapor), duyuru yayınla + push.

**Vezne / partner ekranı:** kupon tara, sonuç (geçerli/geçersiz, tutar, kullanıcı adı ve profil fotoğrafı ile kimlik eşleştirme), günlük kullanım listesi.

**Platform admin:** kurum doğrulama kuyruğu, trainer başvuruları, içerik moderasyonu (`pending_review` aktiviteler), kullanıcı arama/rol yönetimi, puan kuralları editörü, şüpheli işlem panosu, audit log, sistem geneli istatistik.

---

## 10. Hukuk, gizlilik ve etik (tasarım kısıtları — kod buna göre yazılır)

Bu kısımda uygulama bir avukat değildir; aşağıdakileri **teknik kısıt** olarak uygula ve `docs/PRIVACY.md` + `docs/LEGAL_OPEN_QUESTIONS.md` dosyalarına proje sahibinin hukukçuya soracağı sorular olarak yaz:

- **DSGVO/GDPR:** veri minimizasyonu. Oturum/ikamet statüsü, uyruk, din, etnik köken, sağlık **toplanmaz** (Art. 9 özel kategori riski). Açık rıza ekranları DE/EN, gizlilik politikası ve Impressum sayfası, hesap silmede 30 gün içinde tüm kişisel verinin silinmesi (ledger kayıtları anonimleştirilir, silinmez — muhasebe yükümlülüğü), veri dışa aktarma, Firebase'de AB bölgesi, Analytics varsayılan kapalı ve rızaya bağlı.
- **Parasal kuponlar:** Gönüllülük karşılığı para, sığınmacıların sosyal yardımlarını (AsylbLG/Bürgergeld) veya çalışma izni kurallarını etkileyebilir ve "gizli istihdam" gibi yorumlanabilir; vergi tarafında Ehrenamtspauschale sınırları vardır. Bu yüzden parasal kupon özelliği **kurum bazında, varsayılan kapalı** ve tutarlar yalnızca yapılandırmadan gelir. Hukuki onay gelene kadar pilotta yalnızca IP + hediye/indirim ödülleri açık olur.
- **Yaş:** 16 yaş altı kayıt engellenir (DSGVO rızası); 16–18 arası için ebeveyn onayı sonraki sürüme bırakılır — kullanıcıya sor.
- **Güvenlik ve koruma:** yaşlı bakımı ve çocuk/genç içeren aktivitelerde kurum "erweitertes Führungszeugnis gerekli" işaretleyebilir; uygulama bu belgeyi saklamaz, yalnızca kurumun "kontrol edildi" onayını tutar.
- **Erişilebilirlik:** WCAG 2.1 AA, büyük yazı desteği, ikonlarla desteklenmiş basit dil, ekran okuyucu etiketleri.

---

## 11. Çok dillilik

- `react-i18next`, dosyalar: `app/src/locales/de/*.json`, `app/src/locales/en/*.json`. Varsayılan `de`, cihaz dili İngilizceyse `en`.
- **Hiçbir arayüz metni koda gömülmez.** CI'da eksik anahtar kontrolü yapan script yaz.
- Mimari yeni dil eklemeye hazır olsun (Türkçe, Arapça (RTL!), Ukraynaca, Farsça, Dari sonraki fazlarda). Tailwind'de `rtl:` varyantlarını baştan kullan.
- Kurumların girdiği içerik `{de,en}` alanlarıyla saklanır; biri boşsa AI çeviri önerisi getirilir, kurum onaylayıp kaydeder.
- Tarih/saat/para formatı `Intl` ile, saat dilimi `Europe/Berlin` varsayılan.

---

## 12. Cloud Functions listesi

```
Auth:         onUserCreate (varsayılan claim + users doc), deleteMyAccount, exportMyData
Roller:       setUserRole (admin), approveOrganization, reviewTrainerApplication
Aktivite:     submitActivity, reviewActivity, applyToActivity, decideApplication
Yoklama:      startAttendanceSession, stopAttendanceSession, getCurrentCode (her rotationSeconds'da yeni HMAC'li kod),
              submitScan (wrong-code/expired/inactive/activity-missing/geo-too-far hata kodları),
              approveLateScans (staff), onAttendanceConfirmed → passportEntry + IP + ledger + rozet/seviye hesap
Ödül:         issueVoucher (iç), buyReward (IP ile), getVoucherQr (60 sn imzalı), redeemVoucher, revokeVoucher
Zamanlı:      monthlySummary, expireVouchers (günlük), markNoShows (aktivite bitiminden 24 saat sonra),
              deadlineReminders (son başvuru 1 gün önce push)
AI:           aiMatch, aiChat (entegrasyon asistanı; resmi hukuki tavsiye vermez, kurumlara yönlendirir),
              aiTranslate (DE↔EN + Leichte Sprache), aiDraftApplication, parseLink
Push:         sendAnnouncement
Rapor:        orgMonthlyReport (CSV+PDF), passportPdf
Bakım:        ledgerConsistencyCheck (admin tetikler)
```

Her onCall fonksiyonda: App Check zorunlu, claim kontrolü, `zod` ile girdi doğrulama, rate limit (kullanıcı başına), hata mesajları i18n anahtarı olarak döner.

---

## 13. Firebase kurulumu (bilgisayarda senin yapacağın işler)

Faz 0'da sırayla:

1. Ortam kontrolü: `node -v` (≥ 20), `npm -v`, `git --version`, `java -version` (emülatörler için JDK 11+ gerekli). Eksikse işletim sistemini tespit edip kurulum komutunu **önce göster, onay alınca çalıştır.**
2. `npm i -g firebase-tools` → `firebase login` (tarayıcı açılır; kullanıcıdan girişi tamamlamasını iste).
3. İki Firebase projesi oluştur: `ehrenweg-dev` ve `ehrenweg-prod` (kimlik alınmışsa `ehrenweg-app-dev` / `ehrenweg-app-prod` dene ve kullanıcıya bildir).
   `firebase projects:create ehrenweg-dev --display-name "Ehrenweg Dev"`
   `firebase projects:create ehrenweg-prod --display-name "Ehrenweg"`
4. Web ve Android uygulamalarını kaydet: `firebase apps:create web`, `firebase apps:create android "Ehrenweg Android" --package-name de.ehrenweg.app` (dev projesinde ayrıca `de.ehrenweg.app.dev`); config'i `firebase apps:sdkconfig` ile al, `app/.env.development`'a yaz (git dışı).
5. **Kullanıcıya konsolda yaptırılacaklar (dur ve adım adım anlat):**
   - Authentication → E-posta/Şifre, Google (Apple iOS fazında) sağlayıcılarını aç.
   - Firestore oluştur → Native mode → konum (`eur3` çok bölgeli veya `europe-west3`) — **sonradan değiştirilemez, kullanıcıya açıkça söyle.**
   - Storage'ı aynı bölgede aç.
   - Blaze planına geçiş (Cloud Functions ve Secret Manager için gerekli) — **maliyet uyarısıyla birlikte**, bütçe uyarısı (ör. 20 €) kurmasını öner.
   - App Check → reCAPTCHA Enterprise (web) ve Play Integrity (Android).
6. `firebase init` → firestore, functions (TypeScript), storage, emulators (auth, firestore, functions, storage, pubsub), hosting (PWA/kurum paneli için).
7. `functions` bölgesini `europe-west3` olarak ayarla (`setGlobalOptions`).
8. Sırlar: `firebase functions:secrets:set ANTHROPIC_API_KEY`, `VOUCHER_HMAC_SECRET`, `ATTENDANCE_HMAC_SECRET` (kullanıcı değeri kendisi girer; sen görme/yazdırma).
9. `.firebaserc`'de `dev` ve `prod` alias'ları.
10. `scripts/grantAdmin.ts`: verilen e-postaya `platform_admin` claim'i veren tek seferlik script (servis hesabıyla, yerelde çalışır).
11. `scripts/seed.ts`: emülatör için örnek veri — "Bezirksamt Berlin-Neukölln" (belediye, doğrulanmış), 10 aktivite (Park temizliği Hasenheide, Seniorenbegleitung, Deutsch-Sprachcafé, English conversation club, Tafel gıda dağıtımı vb.), 1 partner kafe, 5 test kullanıcısı (her rolden biri).

---

## 14. Firestore Security Rules ilkeleri

- Varsayılan her şey kapalı (`allow read, write: if false;`), sonra açık izinler.
- Kullanıcı yalnızca kendi `users/{uid}` belgesinin **izin verilen alanlarını** (`displayName, bio, skills, interests, languages, locale, photoURL, city`) güncelleyebilir — `affectedKeys().hasOnly([...])` ile.
- `activities` okuması: `status == 'published'` herkes (giriş yapmış); taslaklar yalnız ilgili kurum üyeleri.
- Kurum yetkisi: `request.auth.token.orgs[orgId] in ['org_admin','org_staff']` (claim'e kurum-rol haritası koy).
- `ledger`, `vouchers`, `passportEntries`, `attendanceRecords`, `auditLog`: istemciden yazma **yok**; okuma yalnızca sahibi, ilgili kurum ve admin.
- Her kural için `rules-unit-testing` testi yaz; **CI'da kurallar testi geçmeden deploy yok.**

---

## 15. Geliştirme fazları (her faz sonunda DUR)

| Faz   | İçerik                                                                                                                      | Bitti sayılma ölçütü                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **0** | Ortam, Firebase projeleri, monorepo iskeleti, CI, emülatör, seed                                                            | `npm run dev` + emülatörde seed verisiyle boş uygulama açılıyor                    |
| **1** | Auth, onboarding, DE/EN i18n, profil düzenleme, tema, roller/claim altyapısı                                                | Kayıt→doğrulama→profil akışı DE ve EN'de çalışıyor, kural testleri yeşil           |
| **2** | Kurumlar ve aktiviteler: oluşturma, moderasyon, liste/harita/detay, başvuru, takvim, hatırlatma                             | Kurum aktivite yayınlıyor, katılımcı başvuruyor, admin onaylıyor                   |
| **3** | QR yoklama (dönen kod, manuel kod, çevrimdışı kuyruk, geç onay), pasaport, IP, seviye, rozet, no-show                       | İki cihazla uçtan uca: yoklama → pasaporta işlendi → IP arttı                      |
| **4** | Cüzdan: ödül şablonları, bütçe, ledger, IP ile ödül alma, imzalı kupon QR, vezne/partner tarama, mutabakat raporu           | Ledger tutarlılık scripti hatasız; ekran görüntüsüyle ikinci kullanım reddediliyor |
| **5** | Trainer yolu, eğitim oturumları, geri bildirim                                                                              | Şartları sağlayan kullanıcı başvuruyor, admin onaylıyor, eğitim açıyor             |
| **6** | Push, duyurular, ay sonu özeti, AI uçları (eşleştirme, çeviri, Leichte Sprache, sohbet, link çözümleme)                     | Bildirimler cihaza düşüyor; AI anahtarı yalnız sunucuda                            |
| **7** | Admin/kurum analitiği, PDF raporlar, PDF pasaport, karne görseli, DSGVO (silme, dışa aktarma, rıza, Impressum)              | Hesap silme tüm izleri kaldırıyor, ledger anonimleşiyor                            |
| **8** | Capacitor Android derleme, Ehrenweg ikon/splash, izin metinleri, **Bölüm 16'daki imzalama**, Play Integrity, iç test kanalı | İmzalı AAB üretildi (yükleme kullanıcı onayıyla)                                   |
| **9** | Sertleştirme: performans, erişilebilirlik denetimi, e2e testler, prod projesine deploy, izleme (Crashlytics rızalı)         | Pilot kuruma teslim edilebilir durum                                               |

---

## 16. Uygulama imzalama ve mağaza hazırlığı

### 16.1 Android imzalama (anahtar Faz 0 sonunda üretilir, kullanımı Faz 8'de)

1. **Upload key** (yükleme anahtarı) üret. Komutu önce göster, onay gelince çalıştır. Şifreyi **kullanıcı kendisi yazar**; sen görmez, loglamaz, hiçbir dosyaya yazmazsın:
   ```
   mkdir -p ~/ehrenweg-keys
   keytool -genkeypair -v -keystore ~/ehrenweg-keys/ehrenweg-upload.jks \
     -alias ehrenweg-upload -keyalg RSA -keysize 4096 -validity 10000 \
     -dname "CN=Ehrenweg, O=<Kurum veya kişi adı>, L=<Şehir>, C=DE"
   ```
   Keystore **proje klasörünün dışında** durur.
2. `android/keystore.properties` oluştur (`.gitignore`'da olduğundan emin ol; değerleri kullanıcı doldurur):
   ```
   storeFile=/home/<kullanici>/ehrenweg-keys/ehrenweg-upload.jks
   storePassword=
   keyAlias=ehrenweg-upload
   keyPassword=
   ```
3. `android/app/build.gradle` → `signingConfigs.release` bu dosyadan okur. Dosya yoksa release derlemesi anlaşılır bir hata mesajıyla durur. Şifreler asla gradle dosyasına yazılmaz. CI'da keystore base64 olarak GitHub Secrets'tan gelir.
4. **Play App Signing** kullanılır: asıl imzalama anahtarını Google tutar, bizimki yalnızca yükleme anahtarıdır (kaybolursa Play Console'dan sıfırlama talep edilebilir). Yine de kullanıcıya keystore dosyasını ve şifresini **iki ayrı güvenli yere** yedeklemesini söyle (ör. şifre yöneticisi + şifreli harici disk). Kullanıcı "yedekledim" demeden Faz 8'i bitmiş sayma.
5. **SHA parmak izlerini Firebase'e ekle** (Google ile giriş, App Check/Play Integrity ve App Links bunlara bağlı):
   - Debug: `cd android && ./gradlew signingReport`
   - Upload key: `keytool -list -v -keystore ~/ehrenweg-keys/ehrenweg-upload.jks -alias ehrenweg-upload`
   - Play App Signing anahtarı: Play Console → Test ve yayınla → Uygulama bütünlüğü → SHA-1/SHA-256 (kullanıcı kopyalayıp sana verir)
   - Hepsini `firebase apps:android:sha:create <APP_ID> <SHA>` ile ekle, ardından `google-services.json`'u yeniden indir (`firebase apps:sdkconfig android <APP_ID>`), dev/prod flavor klasörlerine koy (`android/app/src/dev/`, `android/app/src/prod/`).
6. **App Links:** Play App Signing SHA-256'sı ile `https://ehrenweg.de/.well-known/assetlinks.json` üret, Firebase Hosting'den yayınla, Manifest'te `autoVerify="true"`.
7. **Derleme:** `npm run build && npx cap sync android && cd android && ./gradlew bundleProdRelease` → `app-prod-release.aab`. `versionCode` her yüklemede artar (CI'da commit sayısından), `versionName` semver (`1.0.0`).
8. **Play Console** (kullanıcı yapar, sen adım adım yönlendirirsin): geliştirici hesabı (tek seferlik ücret; kurum adına açılması önerilir), uygulama "Ehrenweg", mağaza dili Almanca + İngilizce, **Veri güvenliği formu** (Bölüm 10 ile birebir tutarlı; taslağını sen hazırla), içerik derecelendirmesi, hedef kitle 16+, gizlilik politikası URL'si, kamera/konum/bildirim izin gerekçeleri, önce **Dahili test** kanalı, sonra kapalı test.

### 16.2 iOS imzalama (Android pilotundan sonra)

- Apple Developer Program üyeliği (kurum adına alınacaksa D-U-N-S numarası gerekir; kullanıcıya erkenden hatırlat).
- Bundle ID `de.ehrenweg.app` (ve `.dev`) kaydı; yetenekler: Push Notifications, Associated Domains (`applinks:ehrenweg.de`), App Attest (App Check).
- Xcode'da _Automatically manage signing_, Team'i kullanıcı seçer; iki scheme: `Ehrenweg Dev`, `Ehrenweg`.
- FCM için **APNs Auth Key (.p8)** oluşturulur ve Firebase Console → Cloud Messaging'e yüklenir (kullanıcı yapar).
- `apple-app-site-association` dosyası Hosting'den yayınlanır.
- TestFlight ile iç test; App Store Connect'te ad "Ehrenweg", DE + EN açıklamalar; gizlilik etiketinin taslağını sen hazırla.

### 16.3 Mağaza metinleri

`docs/store/de/` ve `docs/store/en/` altında: kısa açıklama (80 karakter), uzun açıklama, anahtar kelimeler, ekran görüntüsü planı (seed verisiyle, gerçek kişi fotoğrafı olmadan), "Neler yeni" şablonu.

---

## 17. İlk mesajında yapman gerekenler

1. Bu dosyayı okuduğunu ve anladığını 5 maddede özetle.
2. Bana şu soruları **tek seferde** sor:
   - Firestore konumu: `eur3` mü `europe-west3` mü?
   - Pilot şehir ve pilot kurum (ör. bir Berlin Bezirksamt'ı)?
   - İlk sürümde parasal kupon açık mı olsun, yoksa hukuki görüş gelene kadar kapalı mı?
   - GitHub reposu var mı, yoksa ben mi oluşturayım (`gh` CLI)?
   - `ehrenweg.de` alan adı alındı mı / alınacak mı? Destek e-postası ne olacak?
   - İmza anahtarındaki ve mağaza hesabındaki kurum/kişi adı ne olacak (dernek mi, şirket mi, şahıs mı)?
3. Cevapları `docs/DECISIONS.md`'ye yaz ve Faz 0'a başla.
