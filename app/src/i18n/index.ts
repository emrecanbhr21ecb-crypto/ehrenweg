/**
 * Çok dillilik kurulumu (CLAUDE.md Bölüm 11).
 *
 * Kurallar:
 *  - Varsayılan dil `de`. Cihaz dili İngilizceyse `en`.
 *  - HİÇBİR arayüz metni koda gömülmez — her şey locales/ altındaki JSON'dan.
 *  - Yeni dil eklemek: locales/<kod>/ klasörü + SUPPORTED_LOCALES'e ekle.
 *    RTL diller (ar, fa, ...) için `dir` otomatik ayarlanır.
 */

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  DEFAULT_LOCALE,
  isRtl,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/config/brand'

import deCatalog from '@/locales/de/catalog.json'
import deCommon from '@/locales/de/common.json'
import deErrors from '@/locales/de/errors.json'
import enCatalog from '@/locales/en/catalog.json'
import enCommon from '@/locales/en/common.json'
import enErrors from '@/locales/en/errors.json'

export const NAMESPACES = ['common', 'errors', 'catalog'] as const
export type Namespace = (typeof NAMESPACES)[number]

export const resources = {
  de: { common: deCommon, errors: deErrors, catalog: deCatalog },
  en: { common: enCommon, errors: enErrors, catalog: enCatalog },
} as const

/** Kullanıcının seçtiği dilin saklandığı anahtar (localStorage). */
export const LOCALE_STORAGE_KEY = 'ehrenweg.locale'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    // 'de-AT' → 'de'. Bölgesel varyantlar ana dile düşer.
    load: 'languageOnly',
    ns: [...NAMESPACES],
    defaultNS: 'common',

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },

    interpolation: {
      // React zaten kaçışlıyor; çift kaçış metni bozar.
      escapeValue: false,
    },

    // Geliştirmede eksik anahtar konsola düşsün. (missingKeyHandler yalnızca
    // saveMissing açıkken tetiklenir — sunucuya bir şey GÖNDERİLMEZ, yalnızca
    // yerel geri çağırma çalışır.) CI'daki `npm run check:i18n` scripti de
    // ayrıca tüm dilleri karşılaştırır.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (
      lngs: readonly string[],
      ns: string,
      key: string,
    ): void => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] EKSİK ANAHTAR: ${ns}:${key} (${lngs.join(',')})`)
      }
    },
  })

/** <html lang> ve <html dir> özniteliklerini dile göre günceller. */
function applyDocumentLanguage(locale: string): void {
  const root = document.documentElement
  root.lang = locale
  root.dir = isRtl(locale) ? 'rtl' : 'ltr'
}

applyDocumentLanguage(i18n.resolvedLanguage ?? DEFAULT_LOCALE)
i18n.on('languageChanged', applyDocumentLanguage)

export async function setLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale)
}

export default i18n
