/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Ortam değişkenleri. Değerler app/.env.development içinde (git'e GİRMEZ).
 * Örnek şablon: app/.env.example
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string

  /** App Check (reCAPTCHA Enterprise) site key — yalnız gerçek projelerde */
  readonly VITE_RECAPTCHA_SITE_KEY?: string

  /** 'true' | 'false'. Boşsa: geliştirmede emülatör, üretimde gerçek proje. */
  readonly VITE_USE_EMULATORS?: string

  /** Emülatör sunucusu (telefondan test ederken bilgisayarın LAN IP'si) */
  readonly VITE_EMULATOR_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
