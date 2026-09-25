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
