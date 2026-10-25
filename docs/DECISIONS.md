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

**ÇÖZÜLDÜ (26 Eki 2026, Faz 8 başında):** İmza anahtarındaki `keytool -dname`:
`CN=Ehrenweg, O=Emre Can Buhur, L=Diyarbakır, C=TR`. Ülke kodu hesabın
ülkesine göre **`C=TR`** (CLAUDE.md Bölüm 16.1'deki örnek `C=DE` diyor; hesap
Türkiye'den açıldığı için tutarlılık adına TR). `L=` ve `O=` alanları
sertifikanın görünmeyen teknik içeriği — Play Store'da, uygulamada hiçbir
yerde gösterilmez; Play Console'un herkese görünen "geliştirici adı" AYRI bir
alan ve P13'te (Play'e yükleme) ayrıca kararlaştırılacak.

**AÇIK (P13'e ertelendi):** Play Console geliştirici hesabı **Şahıs** kalacak
(kimlik doğrulaması Emre Can Buhur adına), ama mağazada görünen "Geliştirici
adı" metni gerçek ada değil Ehrenweg/entegrasyon temalı bir isme çekilecek —
tam metin P13'te netleşir. Play Store uygulama listeleme başlığı da marka +
kısa alt başlık olacak (örn. "Ehrenweg – Ehrenamt & Integration"), ad tek
başına "göçmen entegrasyonu" gibi bir şeye DEĞİŞMEYECEK (CLAUDE.md Bölüm 1A:
ad her dilde aynı kalır).

**Diyarbakır merkezli bir şirket aracılığıyla yayınlama fikri
DEĞERLENDİRİLDİ, Faz 8 başında vazgeçildi:** Şahıs hesabından farkı yok —
ikisi de "Türkiye" kökenli görünüyor (yukarıdaki "iki sonuç" notu), şirket
hesabı ayrıca daha fazla evrak (vergi no, bazen D-U-N-S) istiyor ve
Ehrenweg'le ilgisiz bir şirketin adı mağazada görünmesi güven açısından daha
sorgulanabilir olabilirdi. Şahıs kararı (Bölüm 1) korundu.

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

## 12. AI'dan beş uçtan dördü KALDIRILDI (Faz 6)

**Karar tarihi:** 26 Eylül 2026 · **Durum:** kalıcı · **Karar:** proje sahibi

CLAUDE.md Bölüm 12 beş AI ucu istiyor. Proje sahibiyle yapılan
değerlendirmede **yalnız `aiTranslate` bırakıldı**, diğer dördü kaldırıldı.

### Neden kaldırıldılar

| Uç                   | Gerekçe                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiMatch`            | Bir ilçede 12 aktivite var. Onu sıralamak için modele gerek yok: ilgi alanı + dil + online puanlaması anında çalışıyor, bedava ve "bu öneri neden geldi" sorusunun cevabı belli. AI'nın anlamı beş şehir, üç yüz aktivite olduğunda başlar.                                                                                                                                                                                            |
| `parseLink`          | İşe yarayan kısmı (`og:title`, `og:image` etiketleri) zaten AI istemiyordu; model yalnız etiket yoksa devreye giriyordu. Kenar durumun kenarı.                                                                                                                                                                                                                                                                                         |
| `aiDraftApplication` | Küçük fayda, buna karşılık herkesin aynı taslağı gönderme riski — başvuru mesajı alanı o zaman bilgi taşımaz olur.                                                                                                                                                                                                                                                                                                                     |
| `aiChat`             | **En riskli ve en az değerli olan.** Sistem talimatının neredeyse tamamı "şunu cevaplama" listesiydi: oturum izni, sosyal yardım, aile birleşimi, çalışma izni, sağlık, vergi. Bunları çıkarınca geriye "uygulamayı nasıl kullanırım" kalıyor ve onu iyi bir arayüz zaten cevaplamalı. Buna karşılık yanlış bir cevabın bedelini biz değil KULLANICI ödüyor: reddedilen başvuru, kesilen yardım, kaçırılan süre. Dar fayda, ağır risk. |

`docs/AI_ASSISTANT.md` ve `functions/src/common/aiPrompt.ts` bu kararla
birlikte silindi.

### Neden `aiTranslate` kaldı

Bir belediye çalışanı her aktivite için Almanca **+** İngilizce **+** Leichte
Sprache yazmaz. Yazmayınca o alanlar boş kalır — ve **Leichte Sprache tam
olarak hedef kitlenin en çok ihtiyaç duyduğu şey.** A2 seviyesinde Almanca
bilen biri için "Wir sammeln Müll. Du brauchst nichts mitbringen." ile normal
Almanca arasında dağlar kadar fark var.

Seed verisindeki kolay dil özetlerini elle yazdım; gerçek kurumlar
yazmayacak. Burada AI süs değil, **erişilebilirlik aracı**.

(Çeviriyi DeepL de yapardı; Leichte Sprache'yi yapmaz. Değerli olan kısım o.)

**Nerede:** kurum aktivite formunda, Almanca açıklamanın altında iki düğme —
"Übersetzen lassen" ve "Leichte Sprache vorschlagen".

🔒 **Öneri asla doğrudan kaydedilmez.** Kutuda gösterilir, kurum
"Übernehmen" derse forma yazılır. Bölüm 12 bunu şart koşuyor: makinenin
ürettiği metin, kurumun onaylamadığı hâliyle katılımcıya gitmemeli.

### Neden Blaze'siz çalıştırılamıyor

Faz 2–5'te tekrar eden örüntü — "sunucu yoksa işi istemciye al, güvenliği
`firestore.rules`'a yık" — burada UYGULANAMAZ:

> Bir SIRRI Firestore kuralıyla koruyamazsınız.

Anthropic anahtarı istemciye konsaydı, APK'yı indiren herkes çıkarabilirdi.
Sonucu yalnız fatura değil; anahtar bizim adımıza başka şeyler için de
kullanılırdı. `app/src/lib/ai.ts` bayrak kapalıyken ağa HİÇ çıkmadan
`unavailable` döner, arayüz sebebini açıkça yazar.

⚠️ **Blaze kararı AI kararından bağımsız.** AI tamamen atılsa bile push
gönderimi, zamanlanmış işler (no-show, süre dolumu, aylık özet), HMAC'li QR
ve bonus hesabı hâlâ sunucu istiyor.

### Push'un yarısı çalışıyor

- **Alma tarafı** (izin, FCM jetonu, kayıt) → bugün çalışıyor. Jetonlar
  şimdiden toplanıyor ki Blaze açıldığı gün mevcut kullanıcılara da
  ulaşılabilsin.
- **Gönderme tarafı** (`sendAnnouncement`, `deadlineReminders`,
  `monthlySummary`) → yazıldı, dağıtılmadı.

Duyurular Firestore'a yazılıyor ve uygulamada anında görünüyor; yalnız
telefona push düşmüyor. Kurum panelinde her duyurunun yanında "Push noch
nicht gesendet" yazıyor. `pushSent` bayrağını istemci YAZAMAZ (testli).

### Hava durumu

Open-Meteo: anahtar istemiyor, ücretsiz, ticari kullanımda serbest.
Koordinat **iki ondalığa yuvarlanıyor** (~1 km) ve konum izni İSTENMİYOR —
profildeki ya da seçilmiş şehir kullanılıyor.

### Duyuru slider'ı otomatik dönmüyor

Bilinçli: otomatik karusel erişilebilirlik açısından kötü (ekran okuyucu ve
motor güçlüğü olan kullanıcı yakalayamaz) ve genelde kimse okumuyor.

---

## 13. DSGVO hesap silme/dışa aktarma ve PDF doğrulama sunucusuz nasıl çalıştı (Faz 7)

**Karar tarihi:** 26 Eylül 2026 · **Durum:** Blaze açılana kadar kalıcı

CLAUDE.md Bölüm 12 bunu `exportMyData`/`deleteMyAccount` Cloud Function'larına
veriyor. Blaze kapalı, aynı örüntü tekrarlandı: iş istemciye, güvenlik
`firestore.rules`'a. Mantık `app/src/lib/privacy.ts`te.

### "Ledger anonimleşiyor" aslında hiç yazma gerektirmedi

Bölüm 15 Faz 7 bitti ölçütü: "Hesap silme tüm izleri kaldırıyor, ledger
anonimleşiyor." İlk bakışta bu, `ledger`/`passportEntries`'e bir
anonimleştirme YAZMASI gerektirir gibi görünüyor. Değil: bu iki koleksiyon
Bölüm 5 şemasında **hiçbir zaman** ad/e-posta/foto taşımadı, yalnız `uid`
referansı var. `users/{uid}` silinince o `uid` zaten hiçbir profile
çözülemeyen bir işaretçiye düşüyor — Bölüm 10'daki "anonimleştirilir,
silinmez" şartı buradan, ekstra bir satır yazmadan sağlanıyor.
`docs/PRIVACY.md`'de tablo hâlinde.

### Dört yerde gerçek bir ad/foto kopyası vardı — dar kurallarla temizlendi

Kurum personeli `users` koleksiyonunu okuyamadığı için (Bölüm 10 veri
minimizasyonu), dört akış kimlik bilgisini KENDİ belgesine kopyalamıştı:

| Belge                                 | Alan                           | Neden kopyalanmıştı                                       |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `attendanceRecords`                   | `displayName`                  | Kurum personeli canlı yoklama listesinde isim görsün diye |
| `activities/{id}/applicants/{uid}`    | `applicantName`                | Kurum başvuran listesinde isim görsün diye                |
| `vouchers`                            | `holderName`, `holderPhotoURL` | Vezne/partner kimlik eşleştirmesi (Bölüm 7.4)             |
| `organizations/{orgId}/members/{uid}` | `displayName`, `email`         | Kurum ekip listesi                                        |

Her biri için `firestore.rules`'a dar bir "kendi kaydını boşalt" kuralı
eklendi — tıpkı Faz 2–6'daki diğer sapmalarda olduğu gibi: yalnız TEK alan,
yalnız SAHİBİ, yalnız BOŞ değere. `onlyFields([...])` diğer her alanı
(durum, tutar, tarih) kilitli tutuyor — bir kullanıcı "adımı sil" derken
yanlışlıkla (ya da kötü niyetle) bir kuponun tutarını ya da bir başvurunun
durumunu değiştiremiyor. `vouchers` ve `applicants`/`attendanceRecords`
BELGESİ silinmiyor, yalnız o tek alan — finansal/kontenjan geçmişi bozulmasın
diye (tıpkı `ledger`'ın asla silinmemesi gibi).

`users/{uid}` belgesinin kendisi ise tam SİLİNİYOR (`allow delete:
if isSelf(userId);`) — bu, Faz 2–6'daki "stats alanı asla silinemez/yazılamaz"
kilidinden FARKLI bir karar: profil GDPR Art. 17'nin asıl hedefi, o yüzden
tam silme burada doğru seçim. Aşağıdaki `get()` çağrıları buna dayanıyordu,
hepsi önce `exists()` kontrolü yapıyor (silinmiş bir kullanıcıya rastgele bir
yazma denemesi sessizce reddedilsin, rules motoru çökmesin diye):
`approvedTrainer()`, `notRestricted()`. `userDocRef(uid).update(...)` ile puan
yazan akış (kurum geç bir yoklamayı onaylarken) silinmiş bir hesapta
NOT_FOUND alır — nadir, yakalanıp loglanan bir uç durum, çözümsüz bırakıldı.

### `verifications/{token}` — kişisel veriyi en aza indiren doğrulama sayfası

PDF pasaporttaki QR, bir Ehrenweg hesabı OLMAYAN bir işvereni
`https://ehrenweg.de/verify/{id}`'e götürür (Bölüm 1A). Bu sayfa
`App.tsx`'teki `PUBLIC_PATHS`'e eklendi — oturum durumu ne olursa olsun
(hatta "yükleniyor" ekranından bile ÖNCE) açılıyor.

Belge kimliği `uid` DEĞİL, istemcide üretilen 128 bit rastgele bir token —
`allow list: if false` ile birleşince kimse koleksiyonu tarayamıyor, yalnız
elindeki bağlantıyla tek belgeye ulaşılabiliyor. İçerik PDF'in TAMAMI değil,
özet: ad, seviye, toplam saat, katılım sayısı. Beceri listesi, katılım
geçmişi ve fotoğraf yalnız PDF'in kendisinde — Bölüm 9 "kişisel veriyi en az
düzeyde tutsun" şartı burada "sayfanın PDF'den daha az göstermesi" olarak
uygulandı.

Sahtecilik engeli her zamanki desen: `create` kuralı yazılan `level`/`hours`/
`activitiesCompleted` değerlerini `get()` ile kullanıcının GERÇEK
`users/{uid}.stats`'ıyla birebir karşılaştırıyor. Kendine sahte bir "Seviye
5" belgesi yazılamaz.

Belge bir ANLIK GÖRÜNTÜ — `allow update, delete: if false`. Hesap silinse
bile üretilmiş bir doğrulama sayfası yaşamaya devam eder; bu bilinçli,
basılı/paylaşılmış bir PDF'in doğrulaması sonradan "belge bulunamadı"
göstermemeli.

### PDF ve karne görseli — yine kütüphane YOK

`lib/reconciliation.ts`teki Faz 4 kararının (window.print(), 300 kB'lık bir
PDF kütüphanesi hedef kitlenin verisine ödettiği gereksiz bedel) aynısı
tekrarlandı. Yeni olan: `styles/theme.css`'e `.print-area` izolasyon kuralı
eklendi (`visibility:hidden` + tek blok `visibility:visible`) — Faz 4'teki
`window.print()` çağrısı AppShell'in üst başlığını ve alt menüsünü de
yazdırıyordu (küçük bir kusur, Reconciliation ekranında düzeltilmedi, burada
not düşüldü). Karne görseli `<canvas>` + `navigator.share` ile: `@capacitor/share`
eklenmedi, Capacitor'ın WebView'ı Web Share API'yi zaten native paylaşım
sayfasına yönlendiriyor.

### Bulunan ama Faz 7'nin konusu OLMAYAN bir regresyon: App.tsx

Bu fazın `/verify/:id` rotasını eklemek için `App.tsx`'i incelerken, `8162120`
("refactor(ai): beş AI ucundan dördü kaldırıldı") commit'inin **kazara** tüm
oturum kapısını (signedOut → /welcome, e-posta doğrulama, profil kurulumu) VE
`/admin` rotasının `isAdmin` korumasını sildiği görüldü — AI temizliğiyle
hiçbir ilgisi yok, muhtemelen dosya o commit'te baştan yazılırken eski mantık
unutuldu. Sonuç: gerçek kullanıcılar kayıt/giriş ekranına hiç ulaşamıyordu
(demo APK bunu hiç göstermedi çünkü otomatik girişle açılıyor) ve giriş yapmış
HERHANGİ bir katılımcı adres çubuğuna `/admin` yazarak yönetim panelinin
arayüzünü görebiliyordu (veri `firestore.rules`teki `isAdmin()` ile korunuyordu,
yalnız arayüz sızıyordu). Faz 7 kapsamında, bulunduğu anda düzeltildi.

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
- **2026-09-26 (Faz 6)** — Bildirimler, duyurular, ana ekran, AI iskeleti.
  Bölüm 12'deki kısıt bu sırada netleşti: AI Blaze'siz çalıştırılamaz.
  Kural testleri 126/126; AI için 8 sahte yanıtlı test (gerçek API
  çağrılmıyor).
- **2026-09-26 (Faz 6 revizyonu)** — Proje sahibinin kararıyla AI uçlarından
  dördü kaldırıldı; yalnız `aiTranslate` kaldı ve kurum formuna bağlandı.
  Gerekçeler Bölüm 12'de.
- **2026-10-24 (Faz 7)** — Kurum analitiği + PDF rapor, platform admin
  paneline sistem istatistiği/şüpheli işlem panosu/audit log/puan kuralları
  editörü, Integrationspass PDF + `/verify/{id}` doğrulama sayfası,
  paylaşılabilir karne görseli, DSGVO (`exportMyData`/`deleteMyAccount`
  istemci karşılığı, rıza Faz 6'dan beri açık). Bölüm 13'teki sapmalar bu
  sırada verildi. Yol boyunca `App.tsx`'teki oturum kapısını sıfırlayan
  eski bir regresyon bulundu ve düzeltildi (Bölüm 13 sonu). Kural testleri
  **145/145 yeşil** (19'u bu fazın DSGVO/doğrulama saldırı senaryoları,
  `tests/privacy.rules.test.ts`).
