# Ehrenweg — Hukukçuya sorulacaklar (LEGAL_OPEN_QUESTIONS)

> Bu uygulama bir avukat değildir. Aşağıdakiler **teknik olarak kısıtlanmış**
> konulardır; kesin cevap bir hukukçudan/danışmandan alınmalıdır. Her madde,
> cevap gelene kadar kodun hangi güvenli varsayımla çalıştığını da yazar.

Son güncelleme: 2026-09-24

---

## 1. Parasal kupon ve sosyal yardım etkileşimi 🔴 ENGELLEYİCİ

**Soru:** Gönüllülük karşılığı verilen parasal kupon, alıcının AsylbLG veya
Bürgergeld ödemelerinden mahsup edilir mi? Çalışma izni kısıtı olan bir
sığınmacı için "gizli istihdam" (Schwarzarbeit / verdeckte Beschäftigung) olarak
yorumlanma riski var mı? Ehrenamtspauschale (§ 3 Nr. 26a EStG, yıllık 840 €)
sınırı bu akışta uygulanabilir mi, kim beyan eder?

**Mevcut teknik varsayım:** `organizations.features.cashVouchers = false`
(varsayılan kapalı, kurum bazında). Pilotta yalnızca IP + hediye çeki/indirim.
Kod tarafı hazır, sadece bayrak kapalı. → `docs/DECISIONS.md` §3

---

## 2. "Ehrenweg" marka müsaitliği 🟡 YAYINDAN ÖNCE

**Soru:** "Ehrenweg" adı marka olarak müsait mi?

Kontrol edilecek yerler:

- DPMA (Almanya) marka arama — https://register.dpma.de/DPMAregister/marke/einsteiger
- EUIPO (AB) eSearch — https://euipo.europa.eu/eSearch/
- Google Play mağaza araması (aynı adla uygulama var mı)
- Apple App Store araması
- Alan adı: `ehrenweg.de` (DENIC whois — https://www.denic.de/webwhois/)

**Mevcut teknik varsayım:** Ad tek kaynaktan geliyor
(`app/src/config/brand.ts` + native kimlikler). Ad değişirse yalnız o dosya ve
`applicationId`/`bundleId` değişir.

---

## 3. Yaş sınırı ve ebeveyn onayı 🟡

**Soru:** DSGVO Art. 8 uyarınca Almanya'da dijital hizmet rızası için yaş sınırı 16. 16–18 yaş arası gönüllülük aktivitelerine katılım için ebeveyn onayı
gerekiyor mu? Gerekiyorsa uygulama içinde mi toplanmalı, kurum mu almalı?

**Mevcut teknik varsayım:** Kayıtta 16 yaş altı engellenir. 16–18 için ek onay
akışı **yok**, sonraki sürüme bırakıldı. Kurum, aktivite bazında
"Ebeveyn onayı gerekli" işareti koyabilir (bilgilendirme amaçlı).

---

## 4. Erweitertes Führungszeugnis (genişletilmiş sabıka kaydı)

**Soru:** Yaşlı bakımı, çocuk ve gençlerle çalışma içeren aktivitelerde
genişletilmiş sabıka kaydı zorunluluğu (§ 72a SGB VIII) kimin sorumluluğunda?
Platform, kurumun "kontrol edildi" beyanını tutmakla yükümlülükten kurtulur mu?

**Mevcut teknik varsayım:** Uygulama belgeyi **saklamaz**. Yalnızca kurumun
`checkedFuehrungszeugnis: true` beyanını ve kim/ne zaman işaretlediğini
`auditLog`'a yazar.

---

## 5. Veri yerleşimi ve işleyen sözleşmesi (AVV)

**Soru:** Firestore `eur3` (Belçika + Hollanda) Alman kamu kurumları için yeterli
mi, yoksa belediye sözleşmeleri "Almanya içi" mi şart koşar? Google ile
Auftragsverarbeitungsvertrag (AVV / DPA) imzalanması gerekir mi, Firebase'in
standart DPA'sı yeterli mi?

**Mevcut teknik varsayım:** Firestore `eur3`, Cloud Functions `europe-west3`,
Storage AB bölgesi. → `docs/DECISIONS.md` §2. Eğer "Almanya içi" şartı çıkarsa
Firestore konumu değiştirilemez, veritabanı yeniden kurulup taşınır.

---

## 6. Özel kategori veri riski (DSGVO Art. 9)

**Soru:** Kullanıcının **konuştuğu diller** ve **katıldığı aktivite kategorileri**
dolaylı olarak uyruk/etnik köken/din çıkarımına izin verir mi (ör. sadece
Arapça + cami temizliği)? Bu, Art. 9 özel kategori sayılır mı?

**Mevcut teknik varsayım:** Uyruk, oturum/ikamet statüsü, din, etnik köken,
sağlık **hiç toplanmaz**. Dil ve kategori toplanır ama profil görünürlüğü
kullanıcı denetiminde olacak (Faz 1'de ayar). Kurum, kendi aktivitesine
katılanlar dışındaki kullanıcıları göremez.

---

## 7. Hesap silme vs. muhasebe saklama yükümlülüğü

**Soru:** Kullanıcı hesabını silince `ledger` kayıtları (kuruma ait harcama)
anonimleştirilip saklanabilir mi, yoksa silinmeli mi? Alman ticaret/vergi
hukukunda saklama süresi (§ 147 AO, 10 yıl) kamu kurumu bütçesi için de geçerli
mi?

**Mevcut teknik varsayım:** Hesap silinince kişisel veri 30 gün içinde silinir;
`ledger` satırları **silinmez, `uid` anonim bir takma değerle değiştirilir**.
Kullanıcı bu davranışı silme ekranında açıkça görür.

---

## 8. Impressum ve sorumluluk

**Soru:** Şahıs olarak yayınlanan bir uygulamada Impressum (§ 5 DDG/TMG) ne
içermeli? Ev adresi zorunlu mu, posta kutusu yeterli mi? Kurumların yayınladığı
aktivitelerden doğan zararda platformun sorumluluğu ne?

**Mevcut teknik varsayım:** Impressum ve Datenschutzerklärung sayfaları DE/EN
olarak Faz 7'de eklenecek; içerik proje sahibinden gelecek.

---

## 9. Parasal kupon — Faz 4'te kodlandı, KAPALI duruyor

Faz 4 ile ödül ve kupon sistemi çalışır hâle geldi. `cash_voucher` türü
**kodda var ama hiçbir kurumda açık değil**: `organizations.features.cashVouchers`
varsayılan `false` ve yalnız platform admin açabiliyor. Firestore kuralı da
kurumun bayrağını okuyup doğruluyor — arayüzden gizlemek tek başına yeterli
sayılmadı.

Aşağıdaki sorular cevaplanmadan bu bayrak **hiçbir kurumda açılmamalı.**

### 9.1 Sosyal yardım ve oturum durumu

**Soru:** Bir sığınmacı ya da Bürgergeld alan kişi gönüllülük karşılığı
para/hediye kuponu aldığında bu gelir sayılır mı? AsylbLG § 7 ve SGB II § 11a
kapsamında mahsup edilir mi? Aylık hangi tutara kadar mahsup dışıdır?

**Neden kritik:** Kullanıcıya 50 € kupon verip sosyal yardımından 50 € kesilmesine
yol açarsak net zarar veririz. Hedef kitle için bu, uygulamayı bırakmaktan çok
daha ağır bir sonuç.

**Mevcut teknik varsayım:** Parasal kupon kapalı. Açık olan tek şey IP (parasal
karşılığı olmayan puan), hediye kuponu ve indirim. Hediye kuponu bile bir
belediye bütçesinden çıktığı için aynı soruya tabi olabilir — cevap ona da lazım.

### 9.2 Gizli istihdam (Scheinselbstständigkeit / verdeckte Beschäftigung)

**Soru:** Düzenli olarak QR ile yoklama alınan, saati kaydedilen ve karşılığında
ödeme yapılan bir gönüllülük ilişkisi iş ilişkisi sayılır mı? Saat kaydı tutmak
bu riski artırıyor mu?

**Neden kritik:** Uygulama tam olarak bunu yapıyor — saat tutuyor, katılım
kanıtlıyor, ödül veriyor. Yapı, bir iş ilişkisinin kanıt zincirine benziyor.

**Mevcut teknik varsayım:** Saat kaydı **pasaport ve referans** amaçlı tutuluyor,
ücret hesabı için değil. IP ödülü saate değil katılıma bağlı ve kurumun ilan
ettiği sabit bir değer. Yine de "saat × tutar" ilişkisi kurulabilecek her yerden
kaçınıldı.

### 9.3 Ehrenamtspauschale sınırı

**Soru:** § 3 Nr. 26a EStG kapsamındaki yıllık 840 € sınırı bu ödüller için
geçerli mi? Sınır aşılırsa kim beyan ediyor — kurum mu, kişi mi, platform mu?
Platformun bildirim yükümlülüğü var mı?

**Mevcut teknik varsayım:** Kişi başı aylık üst sınır kurum tarafından şablonda
belirleniyor (`maxPerUserPerMonth`) ama **yıllık toplam takibi YOK**. Gerekirse
`ledger` üzerinden hesaplanabilir — defter bu yüzden değişmez tutuluyor.

### 9.4 Çalışma izni

**Soru:** Çalışma izni olmayan ya da kısıtlı olan bir kişinin para/kupon
karşılığı gönüllülük yapması yabancılar hukuku açısından sorun yaratır mı?

**Mevcut teknik varsayım:** Uygulama oturum/çalışma izni durumunu **hiç
sormuyor ve saklamıyor** (Bölüm 10, DSGVO Art. 9 riski). Yani bu kontrolü
uygulama yapamaz; kurumun kendi süreciyle yapması gerekir. Pilot kuruma bu
açıkça söylenmeli.

### 9.5 Kim ödüyor, kim sorumlu

**Soru:** Uygulama ödeme yapmıyor, yalnız "vezne şu tutarı ödedi" kaydını
tutuyor. Bu kayıt hukuki olarak ne ifade ediyor? Ödeme yapılmadığı hâlde
"ödendi" işaretlenirse sorumluluk kimde? Platform ödeme hizmeti sağlayıcısı
(ZAG) sayılır mı?

**Mevcut teknik varsayım:** Platform hiçbir para akışına dokunmuyor; bakiye
tutmuyor, transfer yapmıyor. Kupon bir **ödeme aracı değil, bir kayıt.** Vezne
ekranında bu açıkça yazıyor. Yine de ZAG kapsamı dışında olduğumuzun
teyit edilmesi gerekiyor.

### 9.6 Mutabakat ve saklama

**Soru:** Aylık mutabakat raporu (CSV/PDF) kamu kurumu muhasebesi için yeterli
bir belge mi? Hangi alanlar zorunlu? Ne kadar süre saklanmalı?

**Mevcut teknik varsayım:** Rapor ay bazında verilen/kullanılan/süresi dolan
kupon sayısı ve tutarını, kalan bütçeyi içeriyor. `ledger` değişmez ve
silinmiyor, yani rapor her zaman yeniden üretilebilir.
