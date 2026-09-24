/**
 * Ehrenweg — marka tek kaynağı.
 *
 * CLAUDE.md Bölüm 1A: "Adın geçtiği her şey tek kaynaktan gelir. Ad bir gün
 * değişirse yalnız bu dosya ve native kimlikler değişir."
 *
 * Burada olmayan yerler (değişiklikte elle güncellenmesi gerekenler):
 *   - capacitor.config.ts            → appId / appName
 *   - android/app/build.gradle       → productFlavors resValue app_name
 *   - ios/App/App/Info.plist         → CFBundleDisplayName
 *   - app/public/manifest.webmanifest (build'de bu dosyadan üretilir)
 */

export const BRAND = {
  /** Uygulama adı — HER DİLDE AYNI, ASLA ÇEVRİLMEZ. */
  name: 'Ehrenweg',

  slogan: {
    de: 'Dein Weg durchs Ehrenamt – mitten in die Gesellschaft.',
    en: 'Your path through volunteering – into the heart of the community.',
  },

  /** Mağaza kısa açıklaması (Play: 80 karakter sınırı). */
  shortDescription: {
    de: 'Ehrenamt finden, mitmachen, Integrationspass sammeln.',
    en: 'Find volunteering, take part, build your integration passport.',
  },

  /** Native kimlikler — bilgi amaçlı; gerçek kaynak native yapılandırmadır. */
  appId: {
    prod: 'de.ehrenweg.app',
    dev: 'de.ehrenweg.app.dev',
  },

  urls: {
    web: 'https://ehrenweg.de',
    orgPanel: 'https://app.ehrenweg.de',
    /** PDF pasaportundaki doğrulama adresi: `${verifyBase}/{entryId}` */
    verifyBase: 'https://ehrenweg.de/verify',
    /** Deep link / App Link: `${activityBase}/{activityId}` */
    activityBase: 'https://ehrenweg.de/a',
    privacy: 'https://ehrenweg.de/datenschutz',
    imprint: 'https://ehrenweg.de/impressum',
    terms: 'https://ehrenweg.de/agb',
  },

  /** Özel şema deep link'i: ehrenweg://a/{activityId} */
  scheme: 'ehrenweg',

  supportEmail: 'ehrenwegde@gmail.com',

  /**
   * QR içerik ön ekleri. Başka bir uygulamanın QR'ı okutulursa
   * anlaşılır hata verilir (CLAUDE.md Bölüm 1A).
   */
  qr: {
    attendancePrefix: 'EHRENWEG:ATT:',
    voucherPrefix: 'EHRENWEG:VCH:',
  },

  /** Tema renkleri. Tailwind tarafındaki karşılığı: app/src/styles/theme.css */
  colors: {
    /** Ana renk — petrol yeşili */
    primary: '#0F766E',
    /** Vurgu — amber */
    accent: '#F59E0B',
    /** Koyu tema arka planı */
    darkBg: '#0B1220',
  },

  /** PDF pasaport başlığı. */
  passportTitle: {
    de: 'Ehrenweg Integrationspass',
    en: 'Ehrenweg Integration Passport',
  },

  /** Push bildirim kanalı adları (Android notification channel). */
  pushChannel: {
    de: 'Ehrenweg – Aktivitäten',
    en: 'Ehrenweg – Activities',
  },

  /** Varsayılan saat dilimi — tarih/saat biçimlendirmesi bunun üzerinden. */
  timeZone: 'Europe/Berlin',
} as const

export type Brand = typeof BRAND

/** Desteklenen arayüz dilleri. Yeni dil eklenince burası ve locales/ genişler. */
export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Varsayılan dil — cihaz dili İngilizce değilse Almanca. */
export const DEFAULT_LOCALE: Locale = 'de'

/** Sağdan sola yazılan diller. Şimdilik yok; ar/fa/ur eklenince buraya. */
export const RTL_LOCALES: readonly string[] = ['ar', 'fa', 'ps', 'ur', 'he']

export function isRtl(locale: string): boolean {
  // 'ar-EG' → 'ar'. Boş dizgede split yine bir eleman döndürür, yine de
  // noUncheckedIndexedAccess altında güvenli davranıyoruz.
  const base = locale.split('-')[0] ?? locale
  return RTL_LOCALES.includes(base)
}
