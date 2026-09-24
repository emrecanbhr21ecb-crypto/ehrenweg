import { defineConfig } from 'vitest/config'

/**
 * Güvenlik kuralları testleri.
 *
 * Bu testler emülatöre ihtiyaç duyar; `npm run test:rules` komutu
 * `firebase emulators:exec` içinde çalıştırır. Doğrudan `vitest` çağırma —
 * bağlantı hatası alırsın.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Kural testleri emülatöre yazıp siliyor; paralel çalışırsa
    // birbirinin verisini bozar.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
