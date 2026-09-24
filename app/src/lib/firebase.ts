/**
 * Firebase istemci kurulumu.
 *
 * İlkeler (CLAUDE.md Bölüm 0 kural 4 & 5):
 *  - Yapılandırma .env'den gelir, koda GÖMÜLMEZ. .env dosyaları git'e girmez.
 *  - Geliştirmede her şey Firebase Emulator Suite'e bağlanır; dev projesine
 *    ancak bilerek (VITE_USE_EMULATORS=false) bağlanılır.
 *  - App Check yalnız gerçek projelerde zorunlu; emülatörde debug token ile.
 *
 * NOT: Web API key bir sır DEĞİLDİR (istemcide zaten görünür). Asıl koruma
 * Firestore Rules + App Check + Cloud Functions claim kontrolüdür.
 */

import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

/** Cloud Functions bölgesi — CLAUDE.md Bölüm 1A. Sunucu tarafıyla AYNI olmalı. */
export const FUNCTIONS_REGION = 'europe-west3'

function requireEnv(key: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[firebase] Eksik ortam değişkeni: ${key}. ` +
        `app/.env.development (veya .env.production) dosyasını kontrol et. ` +
        `Değerleri 'firebase apps:sdkconfig web <APP_ID>' ile alabilirsin.`,
    )
  }
  return value
}

const firebaseConfig: FirebaseOptions = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

/** Emülatöre mi bağlanıyoruz? Varsayılan: geliştirmede EVET. */
export const USE_EMULATORS =
  import.meta.env.VITE_USE_EMULATORS === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false')

export const auth = getAuth(app)

/**
 * Firestore çevrimdışı kalıcılığı AÇIK.
 * Gerekçe: hedef kitle mobil veri kısıtlı kullanabiliyor; ayrıca QR yoklamada
 * "internet yoksa çevrimdışı kuyruğa al" davranışı bunun üzerine kurulacak
 * (CLAUDE.md Bölüm 2, Faz 3).
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

export const storage = getStorage(app)
export const functions = getFunctions(app, FUNCTIONS_REGION)

// --- Emülatör bağlantıları -------------------------------------------------
// Sıcak yeniden yükleme (HMR) ikinci kez bağlanmaya çalışmasın diye bayrak.
declare global {
  // eslint-disable-next-line no-var
  var __EHRENWEG_EMULATORS_CONNECTED__: boolean | undefined
}

if (USE_EMULATORS && !globalThis.__EHRENWEG_EMULATORS_CONNECTED__) {
  globalThis.__EHRENWEG_EMULATORS_CONNECTED__ = true

  const host = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1'

  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
  connectStorageEmulator(storage, host, 9199)
  connectFunctionsEmulator(functions, host, 5001)

  console.info(
    `[Ehrenweg] Emülatörlere bağlanıldı (${host}). ` +
      `Gerçek projeye bağlanmak için app/.env.development içinde ` +
      `VITE_USE_EMULATORS=false yap.`,
  )
}

// --- App Check -------------------------------------------------------------
/**
 * App Check'i başlatır. Emülatörde atlanır.
 *
 * Üretimde reCAPTCHA Enterprise site key'i gerekir; yoksa sessizce atlanır ve
 * uyarı basılır (Faz 0'da henüz Firebase konsolu kurulmamış olabilir).
 * Cloud Functions tarafında App Check ZORUNLU olacağı için bu, yayına
 * çıkmadan önce mutlaka çalışır duruma gelmelidir.
 */
export function initAppCheck(): AppCheck | null {
  if (USE_EMULATORS) return null

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    console.warn(
      '[Ehrenweg] VITE_RECAPTCHA_SITE_KEY yok — App Check başlatılmadı. ' +
        'Yayına çıkmadan önce Firebase Console → App Check üzerinden kurulmalı.',
    )
    return null
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}
