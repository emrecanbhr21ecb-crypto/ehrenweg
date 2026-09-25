/**
 * i18next tip güvenliği: `t('nav.home')` yazımı derleyici tarafından denetlenir,
 * olmayan anahtar derlemeyi kırar. Böylece "metin koda gömülmesin" kuralı
 * tip seviyesinde de korunur.
 */
import 'i18next'

import type deActivities from '@/locales/de/activities.json'
import type deAttendance from '@/locales/de/attendance.json'
import type deWallet from '@/locales/de/wallet.json'
import type deCatalog from '@/locales/de/catalog.json'
import type deCommon from '@/locales/de/common.json'
import type deErrors from '@/locales/de/errors.json'
import type deLegal from '@/locales/de/legal.json'
import type deManage from '@/locales/de/manage.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof deCommon
      errors: typeof deErrors
      catalog: typeof deCatalog
      legal: typeof deLegal
      activities: typeof deActivities
      manage: typeof deManage
      attendance: typeof deAttendance
      wallet: typeof deWallet
    }
  }
}
