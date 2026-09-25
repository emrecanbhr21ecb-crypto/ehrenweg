/**
 * E2E yardımcıları — Auth emülatörüyle konuşma.
 *
 * Emülatör gerçek e-posta göndermez; doğrulama bağlantısını REST ucundan
 * okuyoruz. Böylece "kayıt → e-posta doğrulama → profil" akışının tamamı,
 * kullanıcının gerçekten yapacağı sırayla test edilebiliyor.
 */

import type { Page } from '@playwright/test'

export const EMULATOR_PROJECT = 'demo-ehrenweg'
export const AUTH_EMULATOR = 'http://127.0.0.1:9099'

/** Her testin kendi kullanıcısı olsun — testler birbirini kirletmesin. */
export function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  return `${prefix}.${stamp}@example.de`
}

interface OobCode {
  email: string
  requestType: string
  oobLink: string
}

/**
 * Auth emülatöründeki doğrulama/sıfırlama bağlantılarını okur.
 * Gerçek Firebase'de böyle bir uç YOKTUR — yalnız emülatörde çalışır.
 */
export async function fetchOobLink(
  email: string,
  requestType: 'VERIFY_EMAIL' | 'PASSWORD_RESET',
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let seen: string[] = []

  // sendEmailVerification ile kodun emülatöre düşmesi arasında kısa bir gecikme
  // olabiliyor; tek atışta sormak yarış koşulu yaratır.
  while (Date.now() < deadline) {
    const response = await fetch(
      `${AUTH_EMULATOR}/emulator/v1/projects/${EMULATOR_PROJECT}/oobCodes`,
    )
    if (!response.ok) {
      throw new Error(
        `[e2e] Auth emülatörüne ulaşılamadı (${response.status}). ` +
          `Testleri "npm run test:e2e" ile çalıştır — emülatörleri o açıyor.`,
      )
    }

    const data = (await response.json()) as { oobCodes?: OobCode[] }
    const codes = data.oobCodes ?? []
    seen = codes.map((c) => `${c.email}/${c.requestType}`)

    // Aynı e-posta için birden fazla kod olabilir (tekrar gönder); sonuncusu geçerli.
    const match = [...codes]
      .reverse()
      .find((code) => code.email === email && code.requestType === requestType)

    if (match) return match.oobLink

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `[e2e] ${email} için ${requestType} bağlantısı ${timeoutMs} ms içinde gelmedi. ` +
      `Bulunan kodlar: ${seen.join(', ') || 'yok'}`,
  )
}

/**
 * Doğrulama bağlantısını açar ve uygulamaya döner.
 *
 * Bağlantı emülatörün kendi onay sayfasına gider; oraya gidip geri dönmek
 * kullanıcının telefonda yaptığı şeyin aynısı.
 */
export async function confirmEmail(page: Page, email: string): Promise<void> {
  const link = await fetchOobLink(email, 'VERIFY_EMAIL')
  await page.goto(link)
  await page.goBack()
}

/** Emülatördeki tüm kullanıcıları siler — testler arasında temiz başlangıç. */
export async function clearAuthUsers(): Promise<void> {
  await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${EMULATOR_PROJECT}/accounts`, {
    method: 'DELETE',
  })
}
