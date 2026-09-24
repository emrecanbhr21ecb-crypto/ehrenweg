# Ehrenweg — Kararlar (DECISIONS)

Bu dosya, proje sahibinin verdiği bağlayıcı kararları tutar. Bir karar değişirse
burası güncellenir ve değişikliğin nedeni "Değişiklik günlüğü"ne yazılır.

Son güncelleme: 2026-09-24

---

## 1. Kimlik ve hesaplar

| Konu | Karar | Not |
|---|---|---|
| Uygulama adı | **Ehrenweg** | Her dilde aynı, çevrilmez |
| Firebase / destek hesabı | **ehrenwegde@gmail.com** | Firebase projeleri bu hesap altında açılır |
| Destek e-postası | **ehrenwegde@gmail.com** | `support@ehrenweg.de` yerine; alan adı alınırsa yönlendirme kurulabilir |
| Tüzel kimlik | **Şahıs** (dernek/şirket değil) | Play Console ve Apple Developer hesabı şahıs adına açılacak |
| GitHub hesabı | `emrecanbhr21ecb-crypto` | Repo: **private** `ehrenweg` |
| Android applicationId | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) | |
| iOS bundle ID | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) | |

**AÇIK:** İmza anahtarındaki (`keytool -dname`) tam yasal ad ve şehir henüz
verilmedi. Keystore üretilmeden önce sorulacak — anahtar üretildikten sonra
bu alanlar değiştirilemez.

---

## 2. Firestore konumu — `eur3` (çok bölgeli AB)

**Karar: `eur3`.**

Gerekçe: Proje sahibi "önce `europe-west3` yapalım, sonradan `eur3`'e
çevirebiliyorsak; çevrilemiyorsa doğrudan `eur3`" dedi. Firestore veritabanının
konumu **oluşturulduktan sonra değiştirilemez**; yerinde dönüştürme yoktur. Tek
yol aynı proje içinde ikinci bir veritabanı açıp export/import ile taşımaktır
(uygulama config değişikliği + kesinti). Dolayısıyla koşul sağlanmadığı için
`eur3` seçildi.

Bilinen bedeli:
- `eur3` verileri **Belçika (europe-west1) + Hollanda (europe-west4)** üzerinde
  tutar — AB içinde, ama **Almanya'da değil**. Alman belediyelerine sunumda
  "veriler Frankfurt'ta" argümanı kullanılamaz.
- Cloud Functions `europe-west3` (Frankfurt) kalıyor → küçük bir bölgeler arası
  gecikme (AB içi, birkaç ms).
- Çok bölgeli depolama tek bölgeden pahalıdır; karşılığında daha yüksek SLA.

**Bu karar Firestore veritabanı konsolda oluşturulmadan hemen önce son kez
teyit edilecek.** O ana kadar `europe-west3`'e dönmek serbesttir.

Storage bucket'ı da aynı/uyumlu bölgede açılır ve onun konumu da kalıcıdır.

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

## 4. Pilot — Berlin-Neukölln

**Karar: Bezirksamt Berlin-Neukölln.**

Seed verisi, demo aktiviteleri ve mağaza ekran görüntüleri buna göre üretilir:
Hasenheide park temizliği, Seniorenbegleitung, Deutsch-Sprachcafé, English
conversation club, Tafel gıda dağıtımı vb. + 1 partner kafe + her rolden 1 test
kullanıcısı.

Not: Bu, **kod içinde sabit değil, yalnızca seed verisidir.** Gerçek pilot kurum
değişirse tek script değişir.

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
| `JAVA_HOME` | `/opt/homebrew/opt/openjdk@17` | Sistemde ayarlı değildi; Firebase emülatörleri (Firestore/Storage) JDK ister |
| Cloud Functions bölgesi | `europe-west3` | CLAUDE.md Bölüm 1A |

**AÇIK:** Cloud Functions Node çalışma zamanı. CLAUDE.md Node 20 diyor; Node 20
LTS bakım desteği 2026'da bitti. Kurulu `firebase-tools`'un varsayılanına
bakılıp en güncel desteklenen LTS seçilecek ve burada not edilecek.

---

## Değişiklik günlüğü

- **2026-09-24** — İlk sürüm. Firestore `eur3`, parasal kupon kapalı, pilot
  Berlin-Neukölln, GitHub private repo, şahıs kimliği, `ehrenwegde@gmail.com`.
