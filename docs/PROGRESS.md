# Ehrenweg — İlerleme (PROGRESS)

Son güncelleme: 2026-09-24

## Faz durumu

| Faz | İçerik | Durum |
|---|---|---|
| **0** | Ortam, Firebase projeleri, monorepo iskeleti, CI, emülatör, seed | 🟡 devam ediyor |
| 1 | Auth, onboarding, i18n, profil, roller/claim | ⬜ |
| 2 | Kurumlar ve aktiviteler | ⬜ |
| 3 | QR yoklama, pasaport, IP, seviye, rozet | ⬜ |
| 4 | Cüzdan, ledger, kupon, vezne | ⬜ |
| 5 | Trainer yolu | ⬜ |
| 6 | Push, duyuru, AI uçları | ⬜ |
| 7 | Analitik, PDF, DSGVO | ⬜ |
| 8 | Android derleme, imzalama, Play iç test | ⬜ |
| 9 | Sertleştirme, prod deploy | ⬜ |

---

## Faz 0 — detay

### Bitti
- Ortam kontrolü: node v24.12.0, npm 11.6.2, git 2.50.1, java 17.0.16
  (Homebrew openjdk@17), firebase-tools 15.22.4, gh 2.98.0 — **eksik yok**
- Kararlar alındı ve `docs/DECISIONS.md`'ye yazıldı
- `docs/LEGAL_OPEN_QUESTIONS.md` açıldı (8 madde)
- `.gitignore` kuruldu (ilk commit'ten önce)

### Devam ediyor
- Monorepo iskeleti (`/app`, `/functions`, kurallar, `/scripts`)

### Kaldı
- GitHub private repo + CI
- Firebase projeleri (`ehrenweg-dev`, `ehrenweg-prod`)
- Emülatör + seed ile uçtan uca açılış (Faz 0 bitiş ölçütü)
- Android upload keystore üretimi

---

## Bilinen sorunlar / engeller

| # | Konu | Durum |
|---|---|---|
| 1 | Firebase CLI'da `ehrenwegde@gmail.com` hesabı kayıtlı değil. `firebase login:add` gerekiyor. | 🔴 kullanıcı bekleniyor |
| 2 | `JAVA_HOME` sistemde ayarlı değil; emülatör komutlarında elle veriliyor (`/opt/homebrew/opt/openjdk@17`). | 🟢 çözüldü (geçici) |
| 3 | Keystore için tam yasal ad + şehir henüz alınmadı (üretimden sonra değiştirilemez). | 🟡 Faz 0 sonunda sorulacak |
| 4 | Firestore konumu `eur3` kararı, veritabanı oluşturulmadan önce son kez teyit edilecek. | 🟡 açık |
