/**
 * Faz 1 uçtan uca testi (P04 madde 9).
 *
 * Kanıtladığı akış: onboarding → kayıt → e-posta doğrulama → profil kurulumu
 * → ana ekran → profil düzenleme, hem **Almanca hem İngilizce**.
 *
 * Neden emülatör: gerçek `ehrenweg-dev` projesine test hesabı açmamak için.
 * `app/.env.test` yalnız `demo-ehrenweg` değerleri taşıyor; `demo-` ön eki
 * Firebase SDK'sının üretime bağlanmasını imkânsız kılıyor.
 */

import { expect, test, type Page } from '@playwright/test'

import { confirmEmail, uniqueEmail } from './helpers'

/** Ekran görüntüleri buraya — PDF'te istenen docs/screenshots/faz1. */
const SHOTS = 'docs/screenshots/faz1'

const PASSWORD = 'EhrenwegTest2026!'

interface Copy {
  languageButton: string
  skip: string
  createAccount: string
  name: string
  email: string
  password: string
  ageConfirm: RegExp
  terms: RegExp
  signUp: string
  verifyTitle: RegExp
  verifyCheck: string
  setupContinue: string
  finish: string
  interestEnvironment: string
  languageGerman: string
  profileTab: string
  editProfile: string
  passportTitle: RegExp
}

const DE: Copy = {
  languageButton: 'Deutsch',
  skip: 'Überspringen',
  createAccount: 'Konto erstellen',
  name: 'Name',
  email: 'E-Mail',
  password: 'Passwort',
  ageConfirm: /mindestens 16 Jahre/,
  terms: /Datenschutzerklärung/,
  signUp: 'Registrieren',
  verifyTitle: /Bestätige deine E-Mail/,
  verifyCheck: 'Ich habe bestätigt',
  setupContinue: 'Weiter',
  finish: "Fertig – los geht's",
  interestEnvironment: 'Umwelt & Natur',
  languageGerman: 'Deutsch',
  profileTab: 'Profil',
  editProfile: 'Profil bearbeiten',
  passportTitle: /Integrationspass/,
}

const EN: Copy = {
  languageButton: 'English',
  skip: 'Skip',
  createAccount: 'Create account',
  name: 'Name',
  email: 'Email',
  password: 'Password',
  ageConfirm: /at least 16 years old/,
  terms: /privacy policy/,
  signUp: 'Sign up',
  verifyTitle: /Confirm your email/,
  verifyCheck: "I've confirmed it",
  setupContinue: 'Continue',
  finish: "Done – let's go",
  interestEnvironment: 'Environment & nature',
  languageGerman: 'German',
  profileTab: 'Profile',
  editProfile: 'Edit profile',
  passportTitle: /Integration passport/,
}

/** Onboarding'i geçip kayıt formuna gelir ve istenen dili seçer. */
async function openSignUp(page: Page, copy: Copy): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: copy.languageButton })).toBeVisible()
  await page.getByRole('button', { name: copy.languageButton }).click()

  await page.getByRole('button', { name: copy.skip }).click()
  await page.getByRole('button', { name: copy.createAccount }).click()
  await expect(page).toHaveURL(/\/signup$/)
}

/** Kayıt formunu doldurup gönderir. */
async function submitSignUp(
  page: Page,
  copy: Copy,
  email: string,
  displayName: string,
): Promise<void> {
  await page.getByLabel(copy.name, { exact: true }).fill(displayName)
  await page.getByLabel(copy.email, { exact: true }).fill(email)
  await page.getByLabel(copy.password, { exact: true }).fill(PASSWORD)

  // Onay kutularını metinle değil ROL ile seç: "Datenschutzerklärung" metni
  // aynı satırdaki target="_blank" bağlantısında da geçiyor ve ona tıklamak
  // testi yeni sekmeye götürüyordu.
  await page.getByRole('checkbox', { name: copy.ageConfirm }).check()
  await page.getByRole('checkbox', { name: copy.terms }).check()

  await page.getByRole('button', { name: copy.signUp }).click()

  // Doğrulama ekranını BEKLE. Buraya gelmeden emülatörden oobCode istemek
  // "kod bulunamadı" ile düşer — kayıt henüz tamamlanmamış olur.
  await expect(page.getByText(copy.verifyTitle)).toBeVisible()
}

/**
 * E-posta doğrulama kapısını geçer.
 *
 * Doğrulama bağlantısından dönüldüğünde sekme yeniden odağa geliyor,
 * VerifyEmail ekranı token'ı kendiliğinden tazeliyor ve kapı açılıyor —
 * kullanıcının düğmeye basması çoğu zaman gerekmiyor. Açılmazsa düğmeyle
 * zorluyoruz ki test, otomatik tazeleme çalışmasa da anlamlı kalsın.
 */
async function passVerification(page: Page, copy: Copy, email: string): Promise<void> {
  await confirmEmail(page, email)

  const confirmButton = page.getByRole('button', { name: copy.verifyCheck })
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click()
  }

  await expect(page).toHaveURL(/\/setup$/)
}

test.describe('Faz 1 — kayıt, doğrulama, profil', () => {
  test('Almanca: kayıt → doğrulama → profil kurulumu → ana ekran', async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail('de.teilnehmer')

    await openSignUp(page, DE)
    if (testInfo.project.name === 'mobile') {
      await page.screenshot({
        path: `${SHOTS}/01-registrierung-de.png`,
        fullPage: true,
      })
    }

    await submitSignUp(page, DE, email, 'Amira Test')

    // 1. E-posta doğrulama kapısı
    await expect(page.getByText(DE.verifyTitle)).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    // 2. Emülatördeki doğrulama bağlantısını aç ve kapıyı geç
    await passVerification(page, DE, email)

    // 3. Profil kurulumu — adım 1: dil ekle
    await page.getByLabel('Sprache hinzufügen').selectOption('de')
    await page.getByRole('button', { name: DE.setupContinue }).click()

    // 4. Profil kurulumu — adım 2: ilgi alanı seç
    await page.getByRole('button', { name: DE.interestEnvironment }).click()
    if (testInfo.project.name === 'mobile') {
      await page.screenshot({ path: `${SHOTS}/02-interessen-de.png`, fullPage: true })
    }
    await page.getByRole('button', { name: DE.finish }).click()

    // 5. Ana ekran — profil tamam, uygulamanın içindeyiz
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Amira' })).toBeVisible()
    if (testInfo.project.name === 'mobile') {
      await page.screenshot({ path: `${SHOTS}/03-start-de.png`, fullPage: true })
    }

    // 6. Integrationspass
    await page.getByRole('link', { name: DE.profileTab }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: DE.passportTitle })).toBeVisible()
    // Yeni kullanıcı 1. seviyede ve puanı sıfır olmalı — sunucu alanları
    // istemciden şişirilemiyor (firestore.rules), bu onun görünen kanıtı.
    await expect(page.getByText('Neuankömmling')).toBeVisible()
    if (testInfo.project.name === 'mobile') {
      await page.screenshot({
        path: `${SHOTS}/04-integrationspass-de.png`,
        fullPage: true,
      })
    }
  })

  test('İngilizce: kayıt → doğrulama → profil kurulumu', async ({ page }, testInfo) => {
    const email = uniqueEmail('en.participant')

    await openSignUp(page, EN)
    await submitSignUp(page, EN, email, 'John Test')

    await passVerification(page, EN, email)
    await page.getByLabel('Add a language').selectOption('en')
    await page.getByRole('button', { name: EN.setupContinue }).click()

    await page.getByRole('button', { name: EN.interestEnvironment }).click()
    await page.getByRole('button', { name: EN.finish }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'John' })).toBeVisible()

    await page.getByRole('link', { name: EN.profileTab }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: EN.passportTitle })).toBeVisible()
    await expect(page.getByText('Newcomer')).toBeVisible()
    if (testInfo.project.name === 'mobile') {
      await page.screenshot({ path: `${SHOTS}/05-passport-en.png`, fullPage: true })
    }
  })

  test('profil düzenleme kaydediliyor', async ({ page }) => {
    const email = uniqueEmail('de.edit')

    await openSignUp(page, DE)
    await submitSignUp(page, DE, email, 'Bearbeiten Test')
    await passVerification(page, DE, email)
    await page.getByLabel('Sprache hinzufügen').selectOption('ar')
    await page.getByRole('button', { name: DE.setupContinue }).click()
    await page.getByRole('button', { name: DE.interestEnvironment }).click()
    await page.getByRole('button', { name: DE.finish }).click()

    // Ana ekranın gerçekten yüklenmesini bekle: kurulum biter bitmez alt
    // menüye tıklamak mobilde kayboluyordu (yönlendirme henüz oturmamış oluyor).
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Bearbeiten' })).toBeVisible()

    await page.getByRole('link', { name: DE.profileTab }).click()
    await expect(page).toHaveURL(/\/profile$/)

    // Profil canlı dinlendiği için ilk anlık görüntüden sonra bir kez daha
    // çiziliyor; sayfa oturmadan tıklarsak düğme DOM'dan kopuyor.
    await expect(page.getByRole('heading', { name: DE.passportTitle })).toBeVisible()
    await page.getByRole('button', { name: DE.editProfile }).click()

    await page.getByLabel('Stadt', { exact: true }).fill('Berlin')
    await page
      .getByLabel('Über mich', { exact: true })
      .fill('Ich helfe gern im Garten.')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // Kaydettikten sonra profil sayfasına döner ve değişiklik görünür
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByText('Berlin')).toBeVisible()
    await expect(page.getByText('Ich helfe gern im Garten.')).toBeVisible()
  })

  test('giriş yapmamış kullanıcı korumalı sayfaya giremez', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/welcome$/)
  })

  test('Impressum girişsiz açılabiliyor (TMG §5)', async ({ page }) => {
    await page.goto('/legal/imprint')
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
    // Taslak uyarısı yayına çıkmadan kaldırılacak; şimdilik görünür olmalı.
    await expect(page.getByText(/Entwurf/)).toBeVisible()
  })
})
