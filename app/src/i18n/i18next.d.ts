/**
 * i18next tip güvenliği: `t('nav.home')` yazımı derleyici tarafından denetlenir,
 * olmayan anahtar derlemeyi kırar. Böylece "metin koda gömülmesin" kuralı
 * tip seviyesinde de korunur.
 */
import 'i18next'

import type deCatalog from '@/locales/de/catalog.json'
import type deCommon from '@/locales/de/common.json'
import type deErrors from '@/locales/de/errors.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof deCommon
      errors: typeof deErrors
      catalog: typeof deCatalog
    }
  }
}
