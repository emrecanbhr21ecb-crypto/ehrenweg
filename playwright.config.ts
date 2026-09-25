/**
 * Playwright yapılandırması — uçtan uca testler (P04 madde 9).
 *
 * Nasıl çalışır: `npm run test:e2e` önce Firebase emülatörlerini açar
 * (`emulators:exec`), sonra Playwright'ı çalıştırır. Playwright de kendi
 * `webServer` ayarıyla Vite'ı **test modunda** başlatır — `app/.env.test`
 * yalnız sahte `demo-ehrenweg` değerleri taşır, yani test hiçbir koşulda
 * gerçek `ehrenweg-dev` projesine dokunamaz.
 */

import { defineConfig, devices } from '@playwright/test'

const PORT = 5174
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // Kayıt akışı emülatöre yazıyor; paralel çalışan iki test aynı e-postayı
  // kullanırsa "email-already-in-use" ile düşerler. Testler kendi benzersiz
  // e-postasını üretiyor ama sıralı çalışmak hata ayıklamayı da kolaylaştırıyor.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // CI'da yanlışlıkla `test.only` bırakılmışsa kırmızı olsun.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,

  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Hedef kitle ağırlıklı telefon kullanıyor; alt menü ve dokunma
      // hedefleri mobil genişlikte de doğrulanmalı.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: `npm --prefix app run dev -- --mode test --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
