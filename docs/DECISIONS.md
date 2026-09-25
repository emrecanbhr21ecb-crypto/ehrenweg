# Ehrenweg — Kararlar (DECISIONS)

Bu dosya, proje sahibinin verdiği bağlayıcı kararları tutar. Bir karar değişirse
burası güncellenir ve değişikliğin nedeni "Değişiklik günlüğü"ne yazılır.

Son güncelleme: 2026-09-25

---

## 1. Kimlik ve hesaplar

| Konu                                | Karar                                          | Not                                                                                                        |
| ----------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Uygulama adı                        | **Ehrenweg**                                   | Her dilde aynı, çevrilmez                                                                                  |
| Firebase / destek hesabı            | **ehrenwegde@gmail.com**                       | Firebase projeleri bu hesap altında açılır; CLI'ya eklendi ✅                                              |
| Destek e-postası                    | **ehrenwegde@gmail.com**                       | `support@ehrenweg.de` yerine; alan adı alınırsa yönlendirme kurulabilir                                    |
| **Play Console geliştirici hesabı** | **ehrenwegde@gmail.com**                       | Firebase ile AYNI hesap (proje sahibi 24 Eyl 2026'da netleştirdi)                                          |
| **Play Console hesabının ülkesi**   | **Türkiye**                                    | Proje sahibi 25 Eyl 2026'da netleştirdi. Hesap Türkiye'den açılacak; uygulama yine Almanya'da yayınlanacak |
| Tüzel kimlik                        | **Şahıs** (dernek/şirket değil)                | Play Console ve Apple Developer hesabı şahıs adına açılacak                                                |
| GitHub hesabı                       | `emrecanbhr21ecb-crypto`                       | Repo: **private** `ehrenweg`                                                                               |
| Android applicationId               | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) |                                                                                                            |
| iOS bundle ID                       | `de.ehrenweg.app` (dev: `de.ehrenweg.app.dev`) |                                                                                                            |

**AÇIK (P11 / Faz 8'e ertelendi, 25 Eyl 2026):** İmza anahtarındaki
(`keytool -dname`) tam yasal ad ve şehir. Proje sahibi "keystore üretilirken
sorarsın" dedi — anahtar zaten o fazda üretiliyor, şimdi üretmenin faydası yok.
Anahtar üretildikten sonra bu alanlar **değiştirilemez** (10.000 gün geçerli).
Ülke kodu hesabın ülkesine göre **`C=TR`** olacak (CLAUDE.md Bölüm 16.1'deki
örnek `C=DE` diyor; hesap Türkiye'den açıldığı için tutarlılık adına TR).

### ⚠️ Türkiye'den açılan hesabın iki sonucu (P13'te ele alınacak)

1. **Geliştirici adresi mağazada görünür.** Google Play, tüketici uygulamalarında
   geliştiricinin ülke/adres bilgisini uygulama sayfasında gösterir. Alman
   belediyelerine sunulan bir uygulamada "Türkiye" adresi güven açısından
   sorulabilir. Çözüm zor değil — kurum sayfasında pilot belediyeyi ve doğrulanmış
   kurumları öne çıkarmak yeterli — ama pilot görüşmesinde sürpriz olmasın diye
   buraya yazıldı.
2. **Şahıs hesabı = kapalı test şartı.** Kasım 2023'ten sonra açılan **şahıs**
   Play Console hesapları, üretime çıkmadan önce **en az 12 test kullanıcısıyla
   14 gün kesintisiz kapalı test** yapmak zorunda. Bu ülkeden bağımsız bir kural
   ama takvimi etkiler: P13'te iç test kanalına yükledikten sonra üretime geçiş
   iki hafta bekler. Pilot planlanırken bu süre hesaba katılmalı.

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

- 1 partner kafe + her rolden 1 test kullanıcısı.

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

## 6. Alan adı — `ehrenweg.de` PİLOT SONRASI alınacak

**Karar (25 Eyl 2026): şimdilik alan adı alınmıyor.** Pilot oturduktan sonra
değerlendirilecek. Bu bir "sonra bakarız" değil, bilinçli erteleme.

Gerekçe: alan adı üç yerde gerekiyor ve üçünün de bedava karşılığı var —

| Nerede gerekiyor                                           | Alan adı olmadan                               | Not                                             |
| ---------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Play Console gizlilik politikası URL'si (**zorunlu alan**) | `https://ehrenweg-prod.web.app/privacy`        | Firebase Hosting her projeye bedava veriyor     |
| App Links (linke tıklayınca uygulama açılsın)              | `https://ehrenweg-prod.web.app/a/{activityId}` | `assetlinks.json` bu adresten de yayınlanabilir |
| PDF pasaport doğrulama QR'ı                                | `https://ehrenweg-prod.web.app/verify/{id}`    |                                                 |

Yani teknik hiçbir şey alan adı yüzünden beklemiyor. Tek kayıp kurumsal
görünüm: bir belediyeye `.web.app` adresi vermek zayıf durur. O yüzden pilot
ciddiye binince alınacak.

**Kod tarafındaki karşılığı (bağlayıcı):** hiçbir adres koda gömülmez. Tüm
URL'ler `app/src/config/brand.ts` içinde tek kaynaktan gelir. Alan adı
alındığında yalnız o dosya + `assetlinks.json` + Play Console alanı değişir.
`.env` dosyalarında `VITE_PUBLIC_BASE_URL` olarak tutulur ki dev/prod ayrışsın.

**Bağlı açık madde:** "Ehrenweg" adının DPMA (Almanya) ve EUIPO (AB) marka
kayıtlarındaki durumu kontrol edilmedi. Alan adı alınmadan önce bakılmalı —
ad kullanılamaz çıkarsa alan adı da boşa gider.
Bkz. `docs/LEGAL_OPEN_QUESTIONS.md`.

---

## 7. Otomatik uygulanan, sorulmayan teknik kararlar

Bunlar iş kuralı değil, teknik zorunluluk olduğu için sorulmadan uygulandı.
İtirazın varsa söyle, değiştiririm.

| Konu                      | Karar                                                                           | Neden                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Makine                    | macOS (Darwin 25.2)                                                             | CLAUDE.md Bölüm 16'daki `keystore.properties` örneği Linux yolu veriyordu; bizde `/Users/emrecanbuhur/ehrenweg-keys/...` olacak |
| `JAVA_HOME`               | `/opt/homebrew/opt/openjdk@**21**`                                              | firebase-tools 15 artık **JDK 21+** şart koşuyor; sistemde 17 varsayılandı. 21 zaten kuruluydu, kurulum gerekmedi               |
| Cloud Functions bölgesi   | `europe-west3`                                                                  | CLAUDE.md Bölüm 1A — Firestore ile aynı bölge                                                                                   |
| **Functions Node sürümü** | **`nodejs24`**                                                                  | ↓ aşağıya bak                                                                                                                   |
| React                     | **19.2** (CLAUDE.md 18 diyordu)                                                 | create-vite artık 19 veriyor; 18'e düşürmek gereksiz risk                                                                       |
| Linter                    | **oxlint** (CLAUDE.md ESLint diyordu)                                           | Vite varsayılanı; react-hooks kuralları var, kat kat hızlı. Prettier + Husky yine kuruldu                                       |
| TypeScript                | 6.0, `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | CLAUDE.md "strict" diyor; scaffold'da açık gelmiyordu, elle eklendi                                                             |

### Neden Node 20 değil, Node 24?

CLAUDE.md "Node 20" diyor ama o tarih geçmiş. `firebase-tools` 15.22.4'ün
kendi runtime tablosundan okundu:

| Runtime      | Durum | Kapanma tarihi                |
| ------------ | ----- | ----------------------------- |
| nodejs20     | GA    | **2026-10-30** ← bir ay sonra |
| nodejs22     | GA    | 2028-10-31                    |
| **nodejs24** | GA    | 2028-10-31                    |

`nodejs24` seçildi: en uzun destek **ve** geliştirme makinesindeki Node
v24.12.0 ile birebir aynı → emülatör ile üretim arasında sürüm farkı yok.

---

## Değişiklik günlüğü

- **2026-09-24** — İlk sürüm. Firestore `europe-west3`, parasal kupon kapalı,
  pilot Berlin-Neukölln, GitHub private repo, şahıs kimliği,
  `ehrenwegde@gmail.com`.
  _(Not: bu satır ilk yazımda sehven `eur3` diyordu; Bölüm 2'deki karar
  `europe-west3`'tür, 25 Eyl 2026'da düzeltildi.)_
- **2026-09-25** — P00 tamamlandı. Bölüm 17'de açık kalan son iki soru
  cevaplandı: **alan adı pilot sonrası** (Bölüm 6, yeni), **Play Console hesabı
  Türkiye'den** açılacak (Bölüm 1). Keystore'daki tam yasal ad ve şehir bilinçli
  olarak P11'e (Faz 8) ertelendi; ülke kodu `C=TR` olacak.

---

## 7. Profil belgesini Cloud Function değil İSTEMCİ oluşturuyor (25 Eyl 2026)

**Karar:** `users/{uid}` belgesi, CLAUDE.md'nin öngördüğü `onUserCreate` Cloud
Function'ı yerine istemci tarafından oluşturuluyor.

**Neden:** Cloud Functions **Blaze planı** gerektiriyor. Proje sahibi 25 Eyl
2026'da Blaze'i açmama kararı aldı (açılış için istenen tutar ~1.500 TL).
Blaze olmadan tek bir fonksiyon bile dağıtılamıyor; profil belgesi sunucudan
oluşturulamadığı için kayıt akışı tamamen tıkanıyordu.

**Riski nasıl kapattık:** Güvenlik `firestore.rules`'a yıkıldı. `users` create
kuralı yalnız şu belgeye izin veriyor:

- yalnızca kendi `uid`'si (`isSelf`),
- alan listesi sabit — şemada olmayan tek bir alan bile yazmayı reddettirir,
- `stats` **birebir sıfır** olmak zorunda (ip, hours, activitiesCompleted,
  noShows, categoriesCount = 0; level = 1),
- `trainerStatus == 'none'`, `roleDisplay == 'participant'`,
- `email` token'daki e-postayla aynı olmalı,
- `orgId` hiç gönderilemez.

`tests/firestore.rules.test.ts` içinde 10 yeni test bunu kanıtlıyor: kullanıcı
kendine 9999 puan veremiyor, 5. seviyede başlayamıyor, kendini onaylı eğitmen
veya admin yapamıyor, kuruma üye olarak doğamıyor, başkasının e-postasını
yazamıyor, başkasının uid'sine belge açamıyor.

**Blaze açıldığında ne olacak:** `allow create` tekrar `if false` olur ve
`lib/userProfile.ts` içindeki `ensureUserProfile` bir blocking function'a
(`beforeUserCreated`) taşınır. İki yer de o işaretle yorumlandı.

---

## 8. Kurum rolü claim yerine üyelik belgesinden de okunuyor (Faz 2)

**Karar tarihi:** 25 Eylül 2026 · **Durum:** geçici, Blaze'e bağlı

**CLAUDE.md ne diyor:** Bölüm 14 — "Kurum yetkisi:
`request.auth.token.orgs[orgId] in ['org_admin','org_staff']` (claim'e
kurum-rol haritası koy)." Bölüm 4 — claim'leri yalnızca Cloud Function
değiştirebilir.

**Neden sapıldı:** İkisi birlikte, Blaze kapalıyken, kurum özelliğini
tamamen imkânsız kılıyor. Claim'i yalnız sunucu yazabilir; sunucu
(Cloud Functions) Blaze istiyor; Blaze açık değil. Yani hiçbir kullanıcı
hiçbir kurumda hiçbir zaman yetki kazanamazdı — Faz 2'nin tamamı ölü
doğardı.

**Ne yapıldı:** `firestore.rules` içindeki `orgRole(orgId)` **önce claim'e**
bakıyor, orada kayıt yoksa `organizations/{orgId}/members/{uid}` belgesine
düşüyor:

```
function orgRole(orgId) {
  return orgs().keys().hasAny([orgId]) ? orgs()[orgId] : memberRole(orgId);
}
```

Ternary kısa devre yaptığı için claim varsa üyelik belgesi hiç okunmaz —
Blaze geldiğinde ek okuma maliyeti de kendiliğinden sıfırlanır.

**Neden güvenlik eşdeğer:** Üyelik belgesini yazabilen üç taraf var ve
üçü de yetki zincirinin dışına çıkamıyor:

1. mevcut bir `org_admin` (zaten o kurumda tam yetkili),
2. `platform_admin`,
3. kurumu **başvuru anında** açan kişi — yalnız kendi adına, yalnız
   `status == 'pending'` olan kurumda, `getAfter()` ile aynı commit
   doğrulanarak. O kurum `verified: false` olduğu için hiçbir şey
   yayınlayamaz; doğrulama yine platform admin'den geçer.

Yani kullanıcının kendi kendine yetki üretebileceği bir yol yok. Rastgele
bir kişi başkasının kurumuna kendini ekleyemez; eklediği kendi kurumu da
admin onayına kadar işlevsizdir.

**Aynı gerekçeyle Faz 2'de istemciye açılanlar** (hepsi kuralla sınırlı):

| İş                 | Kural nasıl koruyor                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Kurum başvurusu    | `verified == false`, `status == 'pending'`, `appliedBy == uid`, bütçe alanı yasak                 |
| Aktivite oluşturma | yalnız `org_staff`+, her zaman `draft`, `stats` sıfır, IP ≤ 60                                    |
| Durum geçişi       | geçiş tablosu kuralda; `draft → published` YOK, yayın yalnız admin ve yalnız doğrulanmış kurumda  |
| Başvuru            | aktivite `get()` ile okunup kontenjan, son başvuru tarihi ve durum doğrulanıyor                   |
| Kontenjan sayacı   | yalnız ±1, `getAfter()` ile aynı commit'teki kendi başvurusu kanıtlanarak; `attendees` dokunulmaz |
| Kabul/red          | yalnız o kurumun personeli, yalnız `applied → accepted/rejected`                                  |

**Blaze açıldığında ne olacak:** `app/src/lib/backend.ts` içindeki
`CLOUD_FUNCTIONS_ENABLED` `true` yapılır (fonksiyonlar
`functions/src/activities.ts` ve `organizations.ts` içinde yazılı ve
derleniyor), kuraldaki istemci `allow create/update` blokları `if false`
olur, `memberRole` düşüşü fazlalık olarak kalır.

---

## 9. Yoklama sunucusuz nasıl güvenli oldu (Faz 3)

**Karar tarihi:** 25–26 Eylül 2026 · **Durum:** geçici, Blaze'e bağlı

Faz 3'ün tamamı bir sunucu varsayıyor: HMAC'li dönen QR, `onAttendanceConfirmed`
tetikleyicisi, `markNoShows` zamanlayıcısı. Blaze kapalı, üçü de yok. Üç ayrı
sorunu ayrı ayrı çözmek gerekti.

### 9.1 QR nasıl imzalanıyor

**Sorun:** `ATTENDANCE_HMAC_SECRET`'ı istemciye koymak çözüm değil — paketten
çıkarılır ve herkes etkinliğe hiç gitmeden geçerli QR üretir.

**Çözüm:** İmza _hesaplanmıyor_, _saklanıyor._

1. Kurum cihazı her turda `crypto.getRandomValues` ile tahmin edilemez bir
   `nonce` üretip `attendanceSessions/{id}/codes/current` belgesine yazıyor.
2. O belge **hiçbir istemciye okunmuyor** (`allow read: if false`) — admin
   dahil. Testle kanıtlı.
3. Katılımcı taradığı `nonce`'u kaydına yazıyor; **kural** belgeyi `get()` ile
   okuyup karşılaştırıyor. Firestore kuralları okuma izinlerine tabi değildir,
   yani "kimse okuyamaz ama doğrulama yine sunucuda yapılır" mümkün oluyor.

Sonuç HMAC'lisiyle aynı: kod tahmin edilemez, uzaktan okunamaz, 30 saniyede
ölür, ekran görüntüsü işe yaramaz. 6 haneli manuel kod da aynı okunamayan
belgede duruyor — oturum belgesinde olsaydı katılımcı okuyup evinden yoklama
verebilirdi (bu yüzden Bölüm 5'teki `manualCode` alanı oturum belgesinde
DEĞİL).

### 9.2 Puanı kim yazıyor

**Sorun:** `onAttendanceConfirmed` yok. Katılımcıya yazdırmak yasak (Bölüm 5:
"Kullanıcı bunu ASLA doğrudan yazamaz").

**Çözüm:** Puanı **kurum personelinin cihazı** yazıyor — zaten yoklama
ekranında canlı listeyi izleyen taraf o. Yetki kuralla iğne deliğine
sıkıştırıldı:

| Kısıt                         | Nasıl                                          |
| ----------------------------- | ---------------------------------------------- |
| Kişi başı bir kez             | girdi kimliği `{activityId}_{uid}` sabit       |
| İlan edilenden fazla puan yok | `ipAwarded == activity.rewards.ip`             |
| Saat uydurulamaz              | `hours == activity.hoursCredited`              |
| Dayanaksız puan yok           | o kişinin `confirmed` yoklama kaydı ŞART       |
| Sayaç deltası birebir         | `getAfter()` ile aynı commit'teki girdiden     |
| Seviye şişirilemez            | `allowedLevel()` eşik tablosu kuralda          |
| Defter ayrışamaz              | ledger tutarı girdiyle aynı olmak zorunda      |
| Geçmiş değişmez               | pasaport girdisinde `update, delete: if false` |

Kötü niyetli bir kurum bile ancak kendi aktivitesinin ilan ettiği puanı, kişi
başı bir kez verebiliyor — gerçek tasarımda da sahip olduğu güç bu kadar.

**Kurum `users` belgesini okuyamadığı için** (veri minimizasyonu) yeni seviyeyi
hesaplayacak eski toplamlara ihtiyacı var. Bu yüzden tarama kaydına bir
`statsSnapshot` kopyalanıyor ve kural onu `get(users/{uid}).stats` ile
karşılaştırıyor — uydurulamıyor. Sayaçlar `increment()` ile yazılıyor ki araya
giren başka bir puan ezilmesin.

**Bonuslar bu yolda UYGULANMIYOR.** "Yeni kategoride ilk katılım +15" ve "aynı
ay 4+ katılım +25" kullanıcının tüm kurumlardaki geçmişini okumayı gerektiriyor;
kural bunu doğrulayamaz, yani kurum bonusu uydurup puan şişirebilirdi. Bonuslar
`functions/src/attendance.ts` içinde yazılı ve Blaze açıldığı gün devreye
girecek. Bugün herkes temel puanı alıyor.

### 9.3 No-show cezası ve kısıt

`markNoShows` zamanlayıcısı yerine kurum personeli "gelmeyenleri işaretle"
diyor. Kural cezayı doğruluyor: aktivite bu kurumun olmalı, BİTMİŞ olmalı,
kişinin KABUL EDİLMİŞ başvurusu olmalı.

Kısıtın bitiş tarihi saklanmıyor, **başlangıcı** saklanıyor. `lastNoShowAt ==
request.time` şartı damgayı uydurulamaz kılıyor; kural kısıtı
`consecutiveNoShows >= 3 && şimdi < lastNoShowAt + 14 gün` olarak kendisi
hesaplıyor. Bitiş damgası yazılsaydı, onu yazan istemcinin doğru hesapladığına
güvenmek gerekirdi.

Bakiyesi cezadan azsa kural `ip >= 0` şartında reddediyor; bu durumda istemci
puan kesmeden yalnız sayacı artırıyor. Hiçbir şeyi olmayandan puan kesmenin
anlamı yok.

### 9.4 Kanıt fotoğrafı

Storage Blaze istiyor. "Katıldım ama yoklama alınmadı" iddiasının fotoğrafı bu
yüzden istemcide 800 piksele küçültülüp JPEG olarak **belgeye** data URL
şeklinde yazılıyor (kural 500 kB ile sınırlıyor, Firestore sınırı 1 MB).
Blaze açılınca alan Storage yoluna döner.

### Blaze açıldığında

`app/src/lib/backend.ts` → `CLOUD_FUNCTIONS_ENABLED = true`. Kuraldaki istemci
yazma izinleri `if false` olur. QR yükü biçimi DEĞİŞMEZ — okuyucu kodu aynı
kalır. Sır kurulumu:

```
firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-dev
firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-prod
```

---

## 10. Para akışı sunucusuz nasıl güvenli oldu (Faz 4)

**Karar tarihi:** 26 Eylül 2026 · **Durum:** geçici, Blaze'e bağlı

CLAUDE.md Bölüm 7.2 tek cümlede kesiyor: **"Kupon verme yalnızca sunucu
tarafında."** Blaze kapalı, sunucu yok. Bu bölüm o cümleyi nasıl
karşıladığımızı ve neyi karşılayamadığımızı anlatıyor.

### 10.1 Kuponu kim basıyor

Kuponu kullanıcının cihazı basıyor — ama **tek bir alanı bile serbest
değil.** `firestore.rules` aşağıdakilerin HEPSİNİ aynı commit'te zorluyor;
biri tutmazsa commit tamamen düşüyor:

| Kısıt                            | Nasıl                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Değer/tür/süre/fiyat uydurulamaz | hepsi şablondan `get()` ile doğrulanıyor                                      |
| Bütçe aşılamaz                   | `spentCents + valueCents <= totalBudgetCents`, commit anındaki gerçek değerle |
| Bütçe atlanamaz                  | `getAfter` ile şablon sayacının arttığı kanıtlanıyor                          |
| Puan ödenmeden alınamaz          | `getAfter(users).stats.ip == get(users).stats.ip - costIp`                    |
| Puan eksiye inemez               | `stats.ip >= 0`                                                               |
| Aylık sınır aşılamaz             | `holders/{uid}` sayacı, dönem damgası `request.time`                          |
| Defter ayrışamaz                 | `ip_spend` ve `voucher_issue` tutarları kuponla birebir                       |

Son iki satır **testin yakaladığı gerçek bir açıktan** doğdu: ilk yazdığım
kuralda kupon `create` yalnız kendi şeklini doğruluyordu, yani kullanıcı
bütçeye ve puanına hiç dokunmadan kendine kupon basabiliyordu. Test
("IP düşmeden kupon basılamaz") geçmedi ve kural `budgetCommitted()` +
`ipPaid()` ile kapatıldı. Bu, testleri neden bu fazın parçası saydığımızın
somut kanıtı.

### 10.2 60 saniyelik kupon QR'ı

Faz 3'teki yoklama QR'ıyla aynı numara: **imza hesaplanmıyor, saklanıyor.**

Kupon sahibinin cihazı rastgele bir nonce üretip `vouchers/{id}/qr/current`
belgesine yazıyor; o belge **hiçbir istemciye okunmuyor** (vezne ve admin
dahil, testli). Vezne taradığı nonce'u kupona yazıyor, karşılaştırmayı kural
yapıyor.

Kritik ayrıntı: token'ı kullanıcı kendi yazıyor ama kural ömrünü
`request.time < expiresAt <= request.time + 90 sn` aralığına hapsediyor.
Yani uzun ömürlü bir token üretip ekran görüntüsünü paylaşmak mümkün değil.

⚠️ Aralık kullanıldı, eşitlik değil: `expiresAt == request.time + 60 sn`
yazmıştım, ağ gecikmesi ve saat kayması yüzünden hiçbir zaman tutmazdı.
90 sn üst sınır 60 sn hedefi + makul kayma payı.

### 10.3 Bonuslar ve zamanlayıcılar

- `expireVouchers` günlük zamanlayıcı yok → süre dolumu **görüntüleme
  anında** hesaplanıyor (`effectiveVoucherStatus`) ve kurum paneli elle
  işaretleyebiliyor. Kural zaten süresi geçmiş kuponu kullandırmıyor, yani
  işaret gecikmesi güvenlik sorunu değil, yalnız rapor kozmetiği.
- "Olağan dışı onay oranı için admin uyarısı" (Bölüm 7.5) için zamanlanmış
  analiz yok; admin panelindeki **defter kontrolü** manuel karşılığı.

### 10.4 PDF raporu

PDF kütüphanesi eklenmedi. Mutabakat raporu CSV olarak iniyor, PDF için
tarayıcının yazdırma penceresi kullanılıyor (telefon ve masaüstü ikisi de
"PDF olarak kaydet" veriyor). 300 kB'lık bir kütüphaneyi pakete koymak,
hedef kitlenin mobil verisine ödettiğimiz gereksiz bir bedel olurdu.

CSV **noktalı virgülle** ayrılıyor ve BOM ile başlıyor: Alman Excel'i
virgülü ondalık ayırıcı sayıyor ve BOM olmadan UTF-8'i tanımıyor. Rapor bir
belediye muhasebesine gidecek; orada açılamayan dosya işe yaramaz.

### 10.5 Parasal kupon kapalı

`cash_voucher` kodda var, hiçbir kurumda açık değil.
`organizations.features.cashVouchers` varsayılan `false` ve yalnız platform
admin açabiliyor (kurum yöneticisi kendi kurumunda AÇAMIYOR — testli).
Gerekçe ve cevaplanması gereken altı hukuki soru:
`docs/LEGAL_OPEN_QUESTIONS.md` §9.

### Blaze açıldığında

`app/src/lib/backend.ts` → `CLOUD_FUNCTIONS_ENABLED = true`.
`functions/src/rewards.ts` içindeki `buyReward`, `getVoucherQr`,
`redeemVoucher`, `revokeVoucher`, `expireVouchers` devreye girer; kuraldaki
istemci yazma izinleri `if false` olur. QR yükü biçimi DEĞİŞMEZ.

```
firebase functions:secrets:set VOUCHER_HMAC_SECRET --project ehrenweg-prod
```

---

## 11. Eğitmen yetkisi claim yerine `trainerStatus`'tan (Faz 5)

**Karar tarihi:** 26 Eylül 2026 · **Durum:** geçici, Blaze'e bağlı

Bölüm 8 eğitmen onayını `setTrainerRole` fonksiyonuna ve `trainer` custom
claim'ine bağlıyor. Blaze kapalı → claim yazılamıyor → hiç kimse eğitmen
olamazdı.

Faz 2'deki kurum rolü çözümünün (§8) aynısı uygulandı: `firestore.rules`
içindeki `isTrainer()` önce claim'e bakıyor, bulamazsa
`users/{uid}.trainerStatus == 'approved'` alanına düşüyor.

**Neden güvenli:** `trainerStatus` kullanıcının kendi düzenleyebildiği alan
listesinde YOK. Yalnız platform admin yazabiliyor ve bunun için ayrı bir
kural dalı var (`onlyFields(['trainerStatus','roleDisplay'])`). Test:
"kullanıcı kendini eğitmen YAPAMAZ".

**Yan kararlar:**

- Dil belgesi (B2+) Storage yerine belgede data URL — Storage Blaze istiyor.
  Bölüm 8'in "yalnız admin ve sahibi görebilsin" şartı korunuyor:
  `trainerApplications/{uid}` yalnız sahibi ve admin tarafından okunabiliyor.
- Eğitmen çarpanı (×1.5, Bölüm 6) kuralda: pasaport girdisi ya aktivitenin
  ilan ettiği IP'yi ya da `trainerUid == uid` ise onun 1,5 katını taşıyabilir.
  Başka hiçbir değer geçmiyor.
- Yorumlar **silinmiyor, gizleniyor**. Silme, kötü geri bildirimi yok etmenin
  kolay yolu olurdu; gizleme en azından kurum panelinde izini bırakıyor.
- Yorum yazma hakkı pasaport girdisine bağlı — gitmeyen biri puan veremiyor.

⚠️ `{path=**}/feedback/{uid}` collection group kuralı **sıfır segmenti de
eşliyor**, yani kök seviyedeki `feedback` koleksiyonunu (platforma yazılan
geri bildirim, admin'e özel) da kapsıyordu. `trainerUid` alanı şartı
eklenerek ayrıldı. Wildcard collection group kurallarında bu tuzağa dikkat.

---

## Değişiklik günlüğü (devam)

- **2026-09-25 (akşam)** — Faz 1 kodlandı: auth (e-posta/şifre + Google),
  e-posta doğrulama, onboarding, profil kurulumu ve düzenleme, Integrationspass
  iskeleti, DE/EN tam çeviri. Bölüm 7'deki sapma bu sırada verildi.
  Firestore veritabanları **iki projede de `europe-west3`** olarak kuruldu.
- **2026-09-25 (gece)** — Faz 2 kodlandı: kurum başvurusu ve doğrulama
  kuyruğu, kurum ekibi, aktivite oluşturma/moderasyon akışı, katılımcı
  liste+harita+detay, başvuru/geri çekme, Başvurularım, seed verisi.
  Bölüm 8'deki sapma bu sırada verildi. Harita için **Leaflet + OpenStreetMap**
  seçildi (anahtar yok, faturalandırma yok, kullanıcı izleme yok).
  Kapak görseli şimdilik **bağlantı** olarak giriliyor — dosya yükleme
  Storage, Storage da Blaze istiyor.
  Proje sahibinin talimatıyla bu fazda **otomatik test yazılmadı**
  (kural testleri ve Playwright e2e atlandı); hedef yatırımcıya
  gösterilebilir dolu bir uygulama.
- **2026-09-26** — Faz 3 kodlandı: dönen QR'lı yoklama, manuel kod, çevrimdışı
  kuyruk, opsiyonel GPS, geç onay, pasaport/IP/seviye/rozet, no-show cezası,
  fotoğraflı katılım iddiası. Bölüm 9'daki üç sapma bu sırada verildi.
  Kural testleri **81/81 yeşil** (21'i Faz 3'ün saldırı senaryoları).
- **2026-09-26 (Faz 4)** — Cüzdan: ödül şablonları, bütçe, IP ile ödül alma,
  60 sn imzalı kupon QR'ı, vezne ekranı, mutabakat raporu, defter tutarlılık
  kontrolü. Bölüm 10'daki sapmalar bu sırada verildi. Kural testi
  **104/104 yeşil**; biri gerçek bir "bedava kupon" açığını yakaladı ve
  kural düzeltildi.
- **2026-09-26 (Faz 5)** — Eğitmen yolu: şart çubukları, başvuru, admin
  kuyruğu, kurs önerme, ×1.5 IP çarpanı, 1–5 yıldız geri bildirim, Learn
  ekranı. Bölüm 11'deki sapma bu sırada verildi. Kural testleri 117/117.
