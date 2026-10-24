# Ehrenweg — Veri saklama tablosu (PRIVACY.md)

> Bu dosya kod tarafının **gerçekte ne yaptığının** kaydıdır — hukuki metin
> değildir (bkz. `docs/LEGAL_OPEN_QUESTIONS.md`). Play Store "Veri güvenliği"
> formunun ve uygulama içi Datenschutzerklärung'un (`app/src/locales/*/legal.json`
> `privacy` bölümü) kaynağıdır. CLAUDE.md Bölüm 10 ve Faz 7 prompt item 5.

Son güncelleme: 2026-09-26 (Faz 7).

## Hangi veri, neden, nerede, ne kadar

| Veri                                                            | Neden toplanıyor                                                       | Nerede (koleksiyon)                   | Saklama süresi                                                                                  | Hesap silindiğinde                                                                                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ad, e-posta, foto, şehir, bio, dil, beceri, ilgi alanı          | Profil, eşleştirme, kurumla iletişim                                   | `users/{uid}`                         | Hesap aktif olduğu sürece                                                                       | **Belge tamamen silinir**                                                                                                                                   |
| Bildirim tercihi, push jetonu                                   | Duyuru/hatırlatma göndermek                                            | `users/{uid}/private/settings`        | Hesap aktif olduğu sürece                                                                       | **Belge tamamen silinir**                                                                                                                                   |
| Katılım geçmişi (aktivite, saat, puan, beceri)                  | Integrationspass, referans                                             | `passportEntries`                     | Süresiz (CLAUDE.md Bölüm 10: muhasebe/kanıt niteliğinde)                                        | **Kalır** — ama hiçbir ad/e-posta/foto taşımıyor; `uid` artık hiçbir profile çözülmeyen bir işaretçi (bkz. aşağıdaki not)                                   |
| Puan/para hareketi                                              | Değişmez muhasebe defteri (Bölüm 7.3)                                  | `ledger`                              | Süresiz, yasal saklama yükümlülüğü olabilir (§147 AO sorusu açık, bkz. LEGAL_OPEN_QUESTIONS §7) | **Kalır, anonimleşir** — aynı sebep: hiç PII içermiyor                                                                                                      |
| Kupon (hediye/indirim), kimlik eşleştirme adı+fotoğrafı         | Vezne/partner ekranında "bu kişi mi" kontrolü                          | `vouchers`                            | Kuponun kendisi süresiz (defter kaydı)                                                          | Belge **kalır** (finansal kayıt), `holderName`/`holderPhotoURL` **boşaltılır**                                                                              |
| Yoklama kaydı + ad kopyası                                      | Kurum personelinin canlı listede isim görmesi (kurum `users` okuyamaz) | `attendanceRecords`                   | Süresiz (pasaport girdisinin dayanağı)                                                          | Belge **kalır**, `displayName` **boşaltılır**                                                                                                               |
| Başvuru + ad kopyası                                            | Kurumun başvuru listesinde isim görmesi                                | `activities/{id}/applicants/{uid}`    | Süresiz (kontenjan geçmişi)                                                                     | Belge **kalır**, `applicantName` **boşaltılır**                                                                                                             |
| Kurum üyeliği (rol, ad, e-posta)                                | Kurum ekibi yönetimi                                                   | `organizations/{orgId}/members/{uid}` | Üyelik sürdüğü sürece                                                                           | **Belge tamamen silinir**                                                                                                                                   |
| Eğitmen başvurusu (motivasyon metni, dil belgesi)               | Eğitmen onay süreci                                                    | `trainerApplications/{uid}`           | Karar verilene kadar + referans                                                                 | **Belge tamamen silinir**                                                                                                                                   |
| "Katıldım" iddiası + kanıt fotoğrafı                            | Yoklama alınamadığında manuel onay                                     | `pendingClaims`                       | İnceleme süresi (birkaç gün)                                                                    | ⚠️ **Henüz otomatik silinmiyor** — bkz. "Bilinen sınırlar"                                                                                                  |
| Eğitim geri bildirimi (yıldız + yorum)                          | Eğitmenin profilindeki ortalama                                        | `activities/{id}/feedback/{uid}`      | Süresiz (kalite kaydı, BazaltGo'daki gibi silinmez/gizlenir)                                    | ⚠️ **Henüz otomatik silinmiyor** — bkz. "Bilinen sınırlar"                                                                                                  |
| Audit log (kim, ne, ne zaman onayladı)                          | Denetlenebilirlik (Bölüm 7.5)                                          | `auditLog`                            | Süresiz                                                                                         | Kalır — `actorUid` platform admin/kurum personeli olduğu için silinen kişinin KENDİ hesabıyla ilgisi yok                                                    |
| PDF pasaport doğrulama özeti (ad, seviye, saat, katılım sayısı) | İşverenin/kurumun belgeyi doğrulaması                                  | `verifications/{token}`               | Bir anlık görüntü, silinmez (geçmişte doğru olduğunu gösterir)                                  | ⚠️ Hesap silinse bile üretilmiş doğrulama sayfaları yaşamaya devam eder — bu bilinçli: basılı/paylaşılmış bir PDF'in doğrulaması sonradan geçersiz olmamalı |

## "Ledger anonimleşiyor" ne demek (Bölüm 15 Faz 7 bitti ölçütü)

`ledger` ve `passportEntries` **hiçbir zaman** ad, e-posta, telefon ya da
fotoğraf taşımadı — yalnızca `uid` (rastgele, anlamsız bir kimlik) ile referans
veriyorlar (bkz. CLAUDE.md Bölüm 5 şeması). `users/{uid}` belgesi silinince o
`uid` artık hiçbir okunabilir profile çözülemez. Yani anonimleştirme **ayrı bir
yazma işlemi gerektirmedi** — zaten var olan ayrımın doğal sonucu.

## Rıza yönetimi

Analitik rızası varsayılan **kapalı**, ayarlardan açılıp kapatılabilir
(`users/{uid}/private/settings.analyticsConsent`, Faz 6'dan beri).
Bugün hiçbir analytics SDK'sı kurulu değil — bu bayrak ileride biri
eklenirse kapıyı önceden kapalı tutuyor.

## Bilinen sınırlar (bilinçli kapsam dışı, Blaze açılınca otomatikleşecek)

- **`pendingClaims.photoDataUrl`**: kanıt fotoğrafı hesap silinirken
  silinmiyor. Gerekçe: kuyruk birkaç gün içinde onaylanıp `passportEntries`'e
  dönüşüyor ya da reddediliyor; silinmeyen belge kısa ömürlü. Blaze açılınca
  zamanlanmış bir temizlik fonksiyonu N gün sonra bu belgeleri silecek.
- **`activities/{id}/feedback/{uid}.comment`**: eğitmen değerlendirmesi hesap
  silinirken silinmiyor/boşaltılmıyor. BazaltGo'daki gibi bilinçli bir tasarım
  — yorum kurumun kalite kaydının parçası, silinmez, yalnız gizlenir
  (`hidden` bayrağı). Yazarın kimliği `uid` üzerinden olduğu için hesap
  silinince de aynı "anonim işaretçi" mantığı geçerli, ama metin değişmez
  kalıyor. Blaze açılınca bu, ad/uid'siz bir "eski katılımcı" etiketine
  dönüştürülebilir.
- **Aynı cihazdan çoklu hesap tespiti** (Bölüm 7.5) hiç uygulanmadı — App
  Check + cihaz parmak izi hash'i gerektiriyor, bu fazın kapsamında değildi.
- **Auth hesabı silme** `deleteUser()` ile istemciden yapılıyor (Firebase
  Auth "yakın zamanda giriş" ister — uygulama bunu `reauthenticate()` ile
  karşılıyor). Admin SDK'dan toplu/arka plan silme Blaze gerektirir.

## İlgili

`docs/LEGAL_OPEN_QUESTIONS.md` §7 (muhasebe saklama süresi), §1 (parasal
kupon — bu fazda açılmadı), `docs/DECISIONS.md` §13.
