# Ehrenweg × BazaltGo — Claude Code terminal prompt paketi

> Amaç: Ehrenweg'i BazaltGo'nun **çalışma mantığıyla** (algoritma, yoklama, pasaport,
> rozet/seviye, Firebase kuralları, ekran akışı) tamamlamak — ama **kopya değil**:
> hedef kitle göçmenler/mülteciler, marka Ehrenweg, renkler petrol yeşili + amber.
>
> **Kullanım:** Prompt'ları sırayla, her biri ayrı mesaj olarak `claude` terminaline yapıştır.
> Claude her prompt'un sonunda durur ve özet verir; "tamam, sıradakine geç" demeden
> bir sonrakini verme.
>
> Klasör varsayımı: iki proje yan yana — `~/.../ehrenweg` ve `~/.../bazaltgo`.
> Claude'u **ehrenweg klasöründe** başlat. BazaltGo yalnızca **okunur**, ona yazılmaz.

## Bugünkü durum (repodan çıkarıldı)

- Faz 0–5 bitti, Faz 6 kısmi. `ehrenweg-dev` / `ehrenweg-prod` projeleri açık.
- **Blaze yok** → Cloud Functions, push gönderimi, `aiTranslate` canlıda çalışmıyor.
- `docs/PROGRESS.md` tablosu eski (Faz 3–6'yı ⬜ gösteriyor) — B0'da düzeltilecek.
- Faz 7–9 (PDF pasaport, DSGVO, imzalı AAB, prod deploy) yapılmadı.

---

## B0 — Durum tespiti ve BazaltGo eşleştirmesi (kod yazma yok)

```
CLAUDE.md ve docs/PROGRESS.md'yi oku. Sonra ../bazaltgo klasörünü YALNIZCA OKUYARAK incele
(bulamazsan yolunu bana sor; o klasöre hiçbir şey yazma, commit atma).

Bana şunu çıkar ve docs/BAZALT_ESLESTIRME.md olarak kaydet:
1. BazaltGo'daki her özellik (App.tsx sekmeleri, components/*, services/*, server/*,
   firestore.rules'taki her koleksiyon) için bir satır: "BazaltGo'da nasıl çalışıyor →
   Ehrenweg'de karşılığı var mı (dosya yolu) → eksik/farklı/gereksiz".
2. Ehrenweg'de BİLEREK olmayacaklar: "Geçmiş çalışmalar / tamamlanan projeler" bölümü,
   motivasyon mektubu, AI sohbet, aiMatch (DECISIONS §12). Bunları "gereksiz" diye işaretle.
3. BazaltGo'nun algoritmalarını ayrı başlıkta özetle: seviye eşikleri, rozet hesabı (rozet.ts,
   badges.ts), öneri imzası (oneriImzasi.ts), yoklama kod rotasyonu + çevrimdışı kuyruk
   (attendanceQueue/attendanceSync), proje durumu (projeDurumu.ts), hatırlatıcı, karne.
   Her biri için "Ehrenweg'de aynı mantıkla mı, değilse neden" yaz.
4. docs/PROGRESS.md'deki faz tablosunu gerçek duruma göre düzelt (Faz 3-5 ✅, Faz 6 🟡).

Kod değiştirme. Sonunda 10 satırlık özet ver ve dur.
```

---

## B1 — Firebase'i tam anlamıyla kurmak (Blaze, Functions, App Check, sırlar, deploy)

```
Hedef: ehrenweg-dev ve ehrenweg-prod'da HER ŞEY gerçekten çalışsın — emülatörde değil, canlıda.

Önce kontrol et ve bana tablo halinde göster (firebase CLI ile, aktif hesap ehrenwegde@gmail.com
olmalı; değilse dur ve söyle):
- Firestore var mı, konumu ne, mod Native mi
- Storage açık mı, aynı bölgede mi
- Auth sağlayıcıları (E-posta/Şifre, Google)
- Fatura planı (Spark/Blaze)
- App Check kayıtları (web reCAPTCHA Enterprise, Android Play Integrity)
- Kayıtlı uygulamalar (web, android de.ehrenweg.app ve de.ehrenweg.app.dev) ve SHA parmak izleri
- Secret Manager'daki sırlar (yalnız ADLARINI listele, değer okuma)

Eksik olan konsol adımları için DUR ve bana tıklanacak yerleri adım adım yaz; "tamam" demeden devam etme.
Blaze geçişinden ÖNCE maliyet uyarısı ver ve 10–20 € bütçe uyarısı kurmamı söyle (CLAUDE.md §0.2).

Blaze açıldıktan sonra sırayla:
1. Sırlar: ANTHROPIC_API_KEY, VOUCHER_HMAC_SECRET, ATTENDANCE_HMAC_SECRET — komutu göster, değeri BEN yazarım.
2. functions: lint + test + build, sonra önce dev'e deploy: firestore:rules, firestore:indexes,
   storage, functions, hosting. Bölge europe-west3 olduğunu deploy çıktısından doğrula.
3. App Check'i functions tarafında enforce et, istemcide debug token akışını dev için kur.
4. scripts/grantAdmin.ts ile benim hesabıma platform_admin ver (e-postayı bana sor).
5. Dev'e seed yükleme seçeneği: scripts/seed.ts --project dev (prod'a ASLA seed yok).
6. Canlı duman testi: kayıt → e-posta doğrulama → kurum aktivite yayınla → başvuru →
   yoklama başlat (getCurrentCode gerçekten dönüyor mu) → submitScan → pasaporta düştü mü →
   IP arttı mı → sendAnnouncement push düştü mü. Her adımın sonucunu tabloya yaz.
7. Prod'a deploy YALNIZCA ben "prod'a çık" dersem.

docs/FIREBASE_KURULUM.md dosyası yaz: hangi ayar nerede, hangi komut, hangi sır nerede (değersiz).
PROGRESS.md güncelle, commit at (feat(infra): ...), dur.
```

---

## B2 — Firestore / Storage kurallarını BazaltGo olgunluğuna çıkarmak

```
../bazaltgo/firestore.rules ve storage.rules'ı satır satır oku (yalnızca oku). Oradaki her güvenlik
kalıbını çıkar: onlyChanges(...) ile alan kısıtı, beğeni değişiminin geçerliliği (likeDegisimiGecerliMi),
feedback'te alan + uzunluk sınırı, eski koleksiyonlar için kapalı kapı, sonda {document=**} catch-all,
kullanıcı profilinde herkese açık/özel ayrımı, push token koleksiyonu kuralı, storage'da dosya tipi ve
boyut sınırı.

Her kalıp için Ehrenweg'in firestore.rules / storage.rules'ında karşılığı var mı kontrol et, yoksa ekle.
Ehrenweg'e özgü olanları KORU (claim tabanlı orgs[orgId] yetkisi, ledger/vouchers/passportEntries'e
istemciden yazma yok).

Kurallar:
- Her yeni/değişen kural için tests/*.rules.test.ts'e en az bir izin + bir ret testi.
- Kullanıcı tarafından yazılan her metin alanına uzunluk sınırı, her belgeye hasOnly alan listesi.
- Storage: yalnız image/*, ≤5 MB, yol sahibine bağlı; aktivite kapak görseli yalnız kurum üyesi.
- Tüm kural testleri yeşil olmadan dev'e deploy etme. Yeşilse dev'e deploy et.

Sonunda "BazaltGo'da olup Ehrenweg'e alınan / bilerek alınmayan" tablosunu docs/BAZALT_ESLESTIRME.md'ye ekle,
commit at, dur.
```

---

## B3 — Tasarım sistemi: BazaltGo kalitesinde, Ehrenweg kimliğinde

```
Amaç: uygulama BazaltGo kadar derli toplu ve "bitmiş" görünsün ama kopyası olmasın.

1. ../bazaltgo'da tasarım dilini çıkar (yalnız oku): kart yapısı, köşe yarıçapları, gölge, boşluk ritmi,
   başlık hiyerarşisi, alt sekme çubuğu, ortadaki büyük buton (DooricButton), karşılama ekranı
   (WelcomeOverlay), boş durumlar, yükleniyor iskeletleri, framer-motion geçişleri, lucide ikon kullanımı,
   koyu/açık tema. Bunu docs/TASARIM.md'de "BazaltGo'dan alınan İLKE" olarak yaz — renk ve logo ALINMAZ.

2. Ehrenweg tasarım token'larını tek yerde topla: app/src/styles/theme.css + app/src/config/brand.ts.
   Palet: primary #0F766E (petrol yeşili), accent #F59E0B (amber — üstüne yalnız koyu metin),
   koyu zemin #0B1220. Bunlardan türet: yüzey 1/2/3, kenarlık, metin birincil/ikincil/soluk,
   başarı/uyarı/hata, kategori renkleri (categories koleksiyonundaki 10 kategori için birbirinden
   ayırt edilebilen, iki temada da AA kontrastlı renkler). Her rengin kontrastını script ile ölç
   (scripts/check-contrast.mjs), AA'yı geçmeyeni düzelt.

3. components/ui.tsx'i gerçek bir bileşen setine çevir: Button (primary/secondary/ghost/danger, boyutlar,
   loading), Card, ListItem, Chip/Badge, Tabs, Sheet (alttan açılan panel), Modal, EmptyState,
   Skeleton, Avatar, ProgressBar, StatTile, SectionHeader, Toast. Hepsi rtl: uyumlu, ekran okuyucu
   etiketli, dokunma alanı ≥44px, prefers-reduced-motion'a saygılı.

4. Ekranları tek tek bu bileşenlere geçir: Welcome, SignIn/SignUp, Home, Activities, ActivityDetail,
   Scan, Learn, Wallet, Profile, org/*, admin/*. Elle yazılmış renk/hex kalmasın
   (grep ile kontrol et, kalırsa listele).

5. Alt sekme çubuğu: HOME · ACTIVITIES · [ortada büyük SCAN] · LEARN · PROFILE; ORG/ADMIN yalnız
   rolü olana, profil menüsünden.

6. Playwright ile her ana ekranın açık + koyu ekran görüntüsünü docs/screenshots/ altına al
   (seed verisiyle). Önce/sonra karşılaştırmasını bana göster.

i18n: yeni metinlerin hepsi locales/de ve locales/en'e; check-i18n script'i geçmeli.
Commit (feat(design): ...), PROGRESS güncelle, dur.
```

---

## B4 — Ana ekran ve Aktiviteler (BazaltGo "Projeler" mantığı, göçmen odaklı)

```
BazaltGo'da HomePage.tsx, MatchedProjects.tsx, ProjectsPage.tsx, projeDurumu.ts, oneriImzasi.ts,
basvurular.ts, hatirlatici.ts mantığını oku (yalnız oku) ve Ehrenweg'e uyarla:

Ana ekran:
- Saate göre selamlama + hava durumu (var, tasarıma oturt).
- Duyuru slider'ı.
- "Sana uygun" — AI YOK; ilgi alanı + konuştuğu diller + şehir/mesafe + son başvuru yakınlığına
  göre deterministik puanlama (BazaltGo'daki öneri imzası mantığıyla: aynı girdiler → aynı sıra,
  yenilemede zıplamasın). Her kartın altında kısa gerekçe: "Weil du Deutsch lernst", "In deiner Nähe".
- "Yaklaşan başvurularım" ve "Bu ay" (saat/IP) kartı.
- "Tamamlanan projeler / geçmiş çalışmalar" bölümü EHRENWEG'DE YOK — ekleme. Biten aktiviteler
  ana ekranda ve listede görünmez; kullanıcının KENDİ katıldıkları yalnız pasaportta görünür.

Aktiviteler:
- Liste + harita, filtreler (kategori, tarih, mesafe, dil, online, "Leichte Sprache var").
- Sıralama: önce son başvurusu yaklaşanlar, sonra başlangıç tarihi; geçmiş tarihli olanlar listeden
  düşer (BazaltGo projeDurumu mantığı, saat dilimi Europe/Berlin).
- Kart üzerinde durum etiketi: "Bewerbung bis …", "Plätze frei: n", "Online".
- Başvuru takibi BazaltGo gibi: başvurdum → sonuç (kabul/red/cevap yok) → katıldım/katılmadım;
  kullanıcı "cevap gelmedi" işaretleyebilsin.
- Hatırlatıcı: son başvurudan 1 gün önce + etkinlikten 2 saat önce yerel bildirim; takvime ekle.

Testler: öneri puanlama, sıralama, durum hesabı için Vitest (DST geçişli tarihler dahil).
Commit, PROGRESS, dur.
```

---

## B5 — Akademi → "Wissen" bilgi paylaşım akışı (göçmenlere yönelik)

```
BazaltGo'nun AcademyPage.tsx'ini oku (yalnız oku): admin'in yayınladığı gönderi akışı, kategori filtresi,
çoklu görsel, video linki, beğeni (likes dizisi, kural onlyChanges(['likes'])).

Ehrenweg'deki Learn sekmesini iki bölmeli yap:
  [Wissen]  — bilgi paylaşımı akışı (YENİ)
  [Kurse]   — mevcut eğitim/trainer oturumları (Learn.tsx'teki training listesi, korunur)

Wissen:
- Koleksiyon: knowledgePosts/{id}: orgId?, authorUid, title:{de,en}, body:{de,en}, simpleBody:{de,en}
  (Leichte Sprache), categoryId, imageURLs[], videoURL?, sourceURL (resmi kaynak ZORUNLU),
  sourceName, lastReviewedAt, city? (boşsa tüm Almanya), likes: uid[], status: draft|published,
  createdAt. docs/DATA_MODEL.md'ye ekle.
- Kategoriler: Behörden & Anmeldung, Deutsch lernen, Arbeit & Ausbildung, Wohnen, Gesundheit,
  Kita & Schule, Geld & Konto, Notfall & Hilfe, Freizeit & Ehrenamt. locales'e DE/EN.
- Yazma: yalnız platform_admin ve doğrulanmış kurumun org_admin/org_staff'ı. Kurum gönderisi
  platform_admin onayıyla yayına girer (pending_review). Kullanıcı yalnız beğeni ekler/çıkarır
  (kendi uid'i, tek seferde bir eleman — BazaltGo kuralı gibi).
- Her gönderinin altında sabit uyarı: "Allgemeine Information, keine Rechtsberatung" + kaynak linki +
  "zuletzt geprüft am …". 12 aydan eski gönderide "bitte prüfen" etiketi.
- Şehir filtresi: kullanıcının şehrine ait + genel gönderiler.
- Leichte Sprache anahtarı (ActivityDetail'deki gibi); aiTranslate ile DE→EN ve Leichte Sprache
  önerisi kurum formunda (öneri, kayıt kararı kurumda).
- Seed: dev için 8 örnek gönderi (Anmeldung beim Bürgeramt, Integrationskurs, Tafel, Notrufnummern
  vb.), gerçek resmi kaynak URL'leriyle — URL'leri uydurma, emin değilsen alanı boş bırakıp bana listele.

Kural testleri (izin/ret), arayüz testleri, i18n kontrolü. Commit, PROGRESS, dur.
```

---

## B6 — QR yoklama: BazaltGo akışıyla birebir, canlıda uçtan uca

```
../bazaltgo'da AttendanceQRPanel.tsx, AttendanceScanner.tsx, attendanceQueue.ts, attendanceSync.ts,
qr.ts ve yoklamaOturumlari/yoklamaKodlari/cevrimdisiYoklamalar kurallarını oku (yalnız oku).
Ehrenweg'in mevcut yoklamasını (pages/Scan.tsx, org/AttendanceSession.tsx, org/LateScans.tsx,
lib/attendance.ts, lib/scanQueue.ts, functions/src/attendance.ts) bununla karşılaştır.

Eksikleri tamamla:
- Tam ekran dönen QR (rotationSeconds, varsayılan 30), geri sayım halkası, canlı katılımcı sayacı,
  6 haneli manuel kod, ekran kararmasını engelle (Capacitor KeepAwake veya eşdeğeri).
- Tarama hata kodları: wrong-code / expired / inactive / activity-missing / geo-too-far /
  foreign-qr (EHRENWEG:ATT: ön eki yoksa). Hepsinin DE/EN, suçlayıcı olmayan mesajı.
- Çevrimdışı: tarama kuyruğa, bağlantı gelince gönder, kuyruk göstergesi; süresi geçmişse
  offline_late → personel elle onaylar. Uygulama kapanıp açılsa da kuyruk kaybolmasın.
- Aynı kişinin ikinci taraması: hata değil, "schon eingecheckt" bilgisi.
- GPS kontrolü opsiyonel, kurum açar.

İki cihaz/ iki tarayıcı ile DEV projesinde canlı test et (emülatör değil): yoklama → pasaport →
IP → seviye/rozet. Sonucu ekran görüntüleriyle docs/screenshots/yoklama/ altına koy.
Functions birim testleri + kural testleri. Commit, PROGRESS, dur.
```

---

## B7 — Integrationspass: BazaltGo "PassportBook" mantığıyla pasaport

```
../bazaltgo'da PassportBook.tsx, BadgesPanel.tsx, CertificateModal.tsx, karne.ts, pdf.ts, belge.ts,
rozet.ts, rozetGorsel.ts, server/sertifikaDogrula.ts ve server/karneTanitimi.ts'i oku (yalnız oku).

Ehrenweg Profile'ında Integrationspass'i şöyle yap:
1. Pasaport defteri görünümü: kapak (Ehrenweg logosu, ad, seviye, üyelik tarihi), sayfa sayfa
   kaydırılan "damga" sayfaları — her passportEntry bir damga: kurum adı + logosu, aktivite,
   kategori rengi, tarih, saat, kazanılan IP. Damga tasarımı kategori rengine göre, BazaltGo'nun
   defter hissi ama Ehrenweg renkleriyle.
2. Seviye halkası (LevelRing) + bir sonraki seviyeye kalan: "Noch 2 Einsätze und 6 Stunden bis Mentor:in".
3. Rozetler paneli: kazanılan renkli, kazanılmayan gri + nasıl kazanılır açıklaması (kilit değil, yol).
   Rozet hesabı tek yerde (functions tarafında), istemci yalnız gösterir.
4. Beceriler ve diller: passportEntries.skillsGained'den otomatik birikir.
5. PDF pasaport (passportPdf function): DE veya EN, "Ehrenweg Integrationspass", katılım tablosu,
   toplam saat, beceriler, doğrulama QR'ı → https://ehrenweg.de/verify/{id} (alan adı yoksa
   Hosting'in varsayılan alanı; brand.ts'ten gelsin).
6. Doğrulama sayfası (Hosting'de herkese açık, giriş gerektirmez): yalnız ad baş harfi + soyad
   baş harfi, seviye, toplam saat, katılım sayısı, oluşturma tarihi — başka kişisel veri YOK.
   Kullanıcı pasaportunu iptal edebilsin (link geçersizleşir).
7. Paylaşılabilir karne görseli (kare, sosyal medya için) — kişisel veri seçimi kullanıcıda.
8. Katılım belgesi (certificates): tek aktivite için PDF, kurumun adıyla.

Testler: rozet/seviye hesabı (eşik sınırları), PDF üretimi (sahte veriyle), doğrulama
sayfasının kişisel veri sızdırmadığını kontrol eden test. Commit, PROGRESS, dur.
```

---

## B8 — Profil, ilgi alanları, karşılama akışı

```
BazaltGo'da ProfilePage.tsx, InterestsModal.tsx, WelcomeOverlay.tsx, acilisKarsilamasi.ts,
karsilama.ts, sozler.ts'i oku (yalnız oku).

Ehrenweg'e uyarla:
- Profil üst kartı: avatar, ad, şehir, seviye, 3 istatistik (Einsätze / Stunden / IP).
- İlgi alanları ve diller düzenleme: alttan açılan sheet, çip seçimi (BazaltGo InterestsModal mantığı).
- İlk açılışta kısa karşılama (3 kart), sonra bir daha gösterme; ayarlardan tekrar açılabilsin.
- "Günün sözü" yerine "Wort des Tages": her gün bir Almanca kelime + İngilizce karşılığı + örnek cümle
  (göçmenler için dil öğrenme dokunuşu). Havuz Firestore'da (config/wordOfDay), admin düzenler;
  seçim günün tarihinden deterministik.
- Ayarlar: dil, tema, bildirimler, analitik rızası, verilerimi indir, hesabımı sil, Impressum, gizlilik.

Commit, PROGRESS, dur.
```

---

## B9 — Kurum paneli ve admin analitiği (BazaltGo AnalyticsPanel mantığı)

```
BazaltGo'da AdminPanel.tsx, AnalyticsPanel.tsx, ProjectUploader.tsx, analizBelgesi.ts'i oku (yalnız oku).

Kurum paneli:
- Aktivite oluşturma sihirbazı (adım adım: temel bilgi → yer/zaman → kapasite/başvuru → ödül → önizleme),
  link'ten başlık/görsel/açıklama doldurma (AI'sız HTML meta okuma, BazaltGo server/kapakGorseli mantığı,
  SSRF korumalı — urlGuard benzeri).
- Analitik: başvuru → kabul → katılım hunisi, no-show oranı, kategori dağılımı, en çok katılım alan
  aktiviteler, aylık saat grafiği, dönem seçimi. Kişisel veri değil, toplu sayılar.
- PDF/CSV rapor (orgMonthlyReport).

Platform admin:
- Kurum doğrulama kuyruğu, aktivite + Wissen gönderisi moderasyonu, trainer başvuruları,
  kullanıcı arama/rol, puan kuralları editörü (config/scoring, sürümlü), şüpheli işlem panosu, auditLog.

Grafikler için tek kütüphane seç (öneri: recharts), tasarım token'larıyla renklendir.
Testler, commit, PROGRESS, dur.
```

---

## B10 — Bildirimler canlıda + DSGVO

```
1. Push: sendAnnouncement, deadlineReminders, monthlySummary dev'de canlı çalışsın; Android kanalları
   "Ehrenweg – Aktivitäten" / "Ehrenweg – Activities". Bildirime dokununca ilgili ekrana deep link.
   Kendi telefonumda test adımlarını yaz, ben deneyeyim.
2. DSGVO:
   - exportMyData: tüm kişisel verim JSON + okunur PDF, indirilebilir.
   - deleteMyAccount: 30 gün bekleme (vazgeçilebilir), sonra tüm kişisel veri + Storage dosyaları silinir,
     ledger kayıtları anonimleşir (silinmez). Bunu kanıtlayan entegrasyon testi.
   - Rıza ekranları DE/EN, Impressum, Datenschutzerklärung (taslak, "hukukçu onayı bekliyor" başlıklı).
   - 16 yaş altı engeli.
3. docs/PRIVACY.md ve LEGAL_OPEN_QUESTIONS.md güncelle.
Commit, PROGRESS, dur.
```

---

## B11 — Android (ve sonra iOS) yayın hazırlığı

```
CLAUDE.md Bölüm 16'yı uygula:
- Ehrenweg ikon/splash tek SVG'den (@capacitor/assets), adaptive icon.
- dev/prod flavor'ları, izin metinleri DE/EN.
- Keystore: komutu göster, dname için adı/şehri bana sor, şifreyi ben yazarım; proje klasörü dışında.
- SHA-1/SHA-256'ları Firebase'e ekle, google-services.json'u flavor klasörlerine koy.
- App Links (assetlinks.json Hosting'den).
- bundleProdRelease → imzalı AAB. Play Console adımlarını ve Veri güvenliği formu taslağını
  docs/store/ altına yaz. Yüklemeyi BEN yaparım.
- Keystore'u iki ayrı yere yedeklediğimi teyit etmeden bu adımı bitti sayma.
Commit, PROGRESS, dur.
```

---

## B12 — Son denetim ve prod'a çıkış

```
1. docs/BAZALT_ESLESTIRME.md'deki her satırı tekrar kontrol et: hepsi "var" veya "bilerek yok" olmalı.
2. Güvenlik: tüm kural testleri, App Check enforce, istemcide sır yok (grep), rate limit, HMAC sırları.
3. Erişilebilirlik: axe ile her ana ekran, büyük yazı, ekran okuyucu etiketleri, kontrast raporu.
4. Performans: bundle boyutu, tembel yükleme, Lighthouse PWA skoru.
5. e2e: kayıt → başvuru → yoklama → pasaport → ödül → kupon kullanımı (Playwright).
6. Rapor: docs/DENETIM.md — bulgu, önem, durum.
7. Ben "prod'a çık" dersem: kurallar + indexler + functions + hosting prod'a; Crashlytics rızalı.
PROGRESS'i son haline getir, commit, dur.
```

---

## Her prompt'un başına eklenebilecek kısa hatırlatma (isteğe bağlı)

```
Kurallar: CLAUDE.md geçerli. ../bazaltgo yalnızca okunur. Kopyalama değil, mantığı uyarlama —
BazaltGo adı, logosu, indigo rengi, Türkçe metinleri Ehrenweg'e girmez. Arayüz metni DE+EN i18n'de.
Para/geri dönüşsüz işlemde (Blaze, prod yazma, mağaza) önce sor. Bitince özet ver ve dur.
```
