# Ehrenweg — Kararlar (DECISIONS)

Bu dosya, proje sahibinin verdiği bağlayıcı kararları tutar. Bir karar değişirse
burası güncellenir ve değişikliğin nedeni "Değişiklik günlüğü"ne yazılır.

Son güncelleme: 2026-09-24

---

## 1. Kimlik ve hesaplar

| Konu | Karar | Not |
|---|---|---|
| Uygulama adı | **Ehrenweg** | Her dilde aynı, çevrilmez |
| Firebase / destek hesabı | **ehrenwegde@gmail.com** | Firebase projeleri bu hesap altında açılır; CLI'ya eklendi ✅ |
| Destek e-postası | **ehrenwegde@gmail.com** | `support@ehrenweg.de` yerine; alan adı alınırsa yönlendirme kurulabilir |
| **Play Console geliştirici hesabı** | **ehrenwegde@gmail.com** | Firebase ile AYNI hesap (proje sahibi 24 Eyl 2026'da netleştirdi) |
| Tüzel kimlik | **Şahıs** (dernek/şirket değil) | Play Console ve Apple Developer hesabı şahıs adına açılacak |
| GitHub hesabı | `emrecanbhr21ecb-crypto` | Repo: **private** `ehrenweg` |
| Android applicationId | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) | |
| iOS bundle ID | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) | |

**AÇIK:** İmza anahtarındaki (`keytool -dname`) tam yasal ad ve şehir henüz
verilmedi. Keystore üretilmeden önce sorulacak — anahtar üretildikten sonra
bu alanlar değiştirilemez.

---

## 2. Firestore konumu — `europe-west3` (Frankfurt) ✅ KESİN

**Karar: `europe-west3` — Frankfurt, Almanya.**

Proje sahibi 24 Eyl 2026'da netleştirdi: "Frankfurt merkezli olan olsun."

Gerekçe: Hedef müşteri Alman belediyeleri ve resmi kurumlar. "Verileriniz
Frankfurt'ta, Almanya sınırları içinde" demek satış ve AVV görüşmelerinde
somut bir avantaj. Ayrıca Cloud Functions da `europe-west3` olduğu için
veritabanı ve fonksiyonlar **aynı bölgede** → en düşük gecikme, bölgeler arası
trafik ücreti yok, en ucuz seçenek.

Bedeli: tek bölge, çok bölgeli `eur3`'e göre teorik olarak daha düşük
dayanıklılık (SLA %99,99 vs %99,999). Pilot ve ilk yıllar için fazlasıyla
yeterli.

⚠️ **Konum kalıcıdır.** Veritabanı oluşturulduktan sonra değiştirilemez;
yerinde dönüştürme yoktur. Tek yol aynı proje içinde ikinci veritabanı açıp
export/import ile taşımaktır (uygulama config değişikliği + kesinti).

Storage bucket'ı da `europe-west3`'te açılır ve onun konumu da kalıcıdır.

---

## 3. Parasal kupon — ilk sürümde KAPALI

**Karar: `organizations.features.cashVouchers` varsayılan `false`.**

Kod, ledger, imzalı kupon QR'ı, vezne tarama akışı **eksiksiz yazılır**; yalnızca
kurum bazındaki özellik bayrağı kapalı başlar. Pilotta sadece Entegrasyon Puanı
(IP) + hediye çeki / indirim ödülleri çalışır.

Gerekçe (CLAUDE.md Bölüm 10): gönüllülük karşılığı para, sığınmacıların
AsylbLG / Bürgergeld haklarını ve çalışma izni kurallarını etkileyebilir, "gizli
istihdam" olarak yorumlanabilir; vergi tarafında Ehrenamtspauschale sınırları
vardır. Hukuki görüş gelene kadar kapalı kalır, sonra tek bayrakla açılır.

---

## 4. Pilot — Berlin-Neukölln, demo içerik GEÇİCİ

**Karar: Bezirksamt Berlin-Neukölln.**

Demo aktiviteler: Hasenheide park temizliği, Seniorenbegleitung,
Deutsch-Sprachcafé, English conversation club, Tafel gıda dağıtımı vb.
+ 1 partner kafe + her rolden 1 test kullanıcısı.

### 🔴 Demo içerik kuralı (proje sahibinin talimatı, 24 Eyl 2026)

> "demo içerikleri de Firebase'e kur, koda değil… sonra sileceğiz, gerçek
> içerikler olacak"

Bağlayıcı sonuçlar:

1. **Hiçbir demo/örnek içerik koda yazılmaz.** Ne bileşenlerde sabit dizi, ne
   `constants.ts`, ne JSON fixture. Kod tamamen içerikten bağımsız kalır.
2. Demo içerik **yalnızca Firestore'a seed scriptiyle** yazılır
   (`scripts/seed.ts`).
3. Her demo belgesine `seed: true` işareti konur. Silme tek komutla ve
   **yanlışlıkla gerçek veriye dokunmadan** yapılabilsin diye.
4. `scripts/unseed.ts` yazılacak: `seed == true` olan her belgeyi siler.
   Gerçek içerik geldiğinde bu çalıştırılır ve demo iz bırakmadan kalkar.
5. Uygulama ekranlarında "demo", "örnek", "Faz 0" gibi geçici uyarı/afiş
   **yoktur** — arayüz baştan gerçek ürün gibi görünür.

---

## 5. Kod deposu — GitHub private

**Karar: GitHub'da private `ehrenweg` reposu**, `emrecanbhr21ecb-crypto` hesabı
altında. `.gitignore` ilk commit'ten önce kuruldu. CI: GitHub Actions
(lint + test + build + Firestore kuralları testi).

---

## 6. Otomatik uygulanan, sorulmayan teknik kararlar

Bunlar iş kuralı değil, teknik zorunluluk olduğu için sorulmadan uygulandı.
İtirazın varsa söyle, değiştiririm.

| Konu | Karar | Neden |
|---|---|---|
| Makine | macOS (Darwin 25.2) | CLAUDE.md Bölüm 16'daki `keystore.properties` örneği Linux yolu veriyordu; bizde `/Users/emrecanbuhur/ehrenweg-keys/...` olacak |
| `JAVA_HOME` | `/opt/homebrew/opt/openjdk@**21**` | firebase-tools 15 artık **JDK 21+** şart koşuyor; sistemde 17 varsayılandı. 21 zaten kuruluydu, kurulum gerekmedi |
| Cloud Functions bölgesi | `europe-west3` | CLAUDE.md Bölüm 1A — Firestore ile aynı bölge |
| **Functions Node sürümü** | **`nodejs24`** | ↓ aşağıya bak |
| React | **19.2** (CLAUDE.md 18 diyordu) | create-vite artık 19 veriyor; 18'e düşürmek gereksiz risk |
| Linter | **oxlint** (CLAUDE.md ESLint diyordu) | Vite varsayılanı; react-hooks kuralları var, kat kat hızlı. Prettier + Husky yine kuruldu |
| TypeScript | 6.0, `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | CLAUDE.md "strict" diyor; scaffold'da açık gelmiyordu, elle eklendi |

### Neden Node 20 değil, Node 24?

CLAUDE.md "Node 20" diyor ama o tarih geçmiş. `firebase-tools` 15.22.4'ün
kendi runtime tablosundan okundu:

| Runtime | Durum | Kapanma tarihi |
|---|---|---|
| nodejs20 | GA | **2026-10-30** ← bir ay sonra |
| nodejs22 | GA | 2028-10-31 |
| **nodejs24** | GA | 2028-10-31 |

`nodejs24` seçildi: en uzun destek **ve** geliştirme makinesindeki Node
v24.12.0 ile birebir aynı → emülatör ile üretim arasında sürüm farkı yok.

---

## Değişiklik günlüğü

- **2026-09-24** — İlk sürüm. Firestore `eur3`, parasal kupon kapalı, pilot
  Berlin-Neukölln, GitHub private repo, şahıs kimliği, `ehrenwegde@gmail.com`.
