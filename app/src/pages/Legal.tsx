/**
 * Impressum, Datenschutzerklärung ve Nutzungsbedingungen — UYGULAMA İÇİNDE.
 *
 * Neden dış link yetmez: Almanya'da Impressum (TMG §5) ve gizlilik
 * bilgilendirmesi (DSGVO Art. 13) uygulamadan **doğrudan ve internetsiz**
 * ulaşılabilir olmalı. Play Store incelemesi de uygulama içi gizlilik
 * bağlantısı arıyor.
 *
 * ⚠️ Metinler HUKUKEN ONAYLANMIŞ DEĞİL. `[ ]` işaretli yerler proje sahibinin
 * gerçek bilgileriyle doldurulacak (docs/LEGAL_OPEN_QUESTIONS.md). Ekranın
 * başında bunu söyleyen bir uyarı var ve yayına çıkmadan kaldırılacak —
 * sessizce yanlış hukuki metin göstermektense açıkça "taslak" demek doğru.
 */

import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Alert, Card } from '@/components/ui'
import { BRAND } from '@/config/brand'

const LEGAL_PAGES = ['imprint', 'privacy', 'terms'] as const
export type LegalPage = (typeof LEGAL_PAGES)[number]

function isLegalPage(value: string | undefined): value is LegalPage {
  return (LEGAL_PAGES as readonly string[]).includes(value ?? '')
}

/** Bölümlerin i18n anahtar kökleri — her sayfa kendi bölüm listesini taşır. */
const SECTIONS: Record<LegalPage, readonly string[]> = {
  imprint: ['provider', 'contact', 'responsible', 'dispute'],
  privacy: [
    'controller',
    'whatWeCollect',
    'whatWeDoNotCollect',
    'purpose',
    'legalBasis',
    'storage',
    'processors',
    'rights',
    'contact',
  ],
  terms: ['scope', 'account', 'conduct', 'points', 'liability', 'termination'],
}

/** Genel bakış — /legal. */
export function LegalIndex(): React.JSX.Element {
  const { t } = useTranslation('legal')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('indexTitle')}</h1>
      <Card>
        <ul className="divide-y divide-gray-200 dark:divide-ink-800">
          {LEGAL_PAGES.map((page) => (
            <li key={page}>
              <Link
                to={`/legal/${page}`}
                className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-medium"
              >
                {t(`${page}.title` as 'imprint.title')}
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('contactLine', { email: BRAND.supportEmail })}
      </p>
    </div>
  )
}

/** Tek bir hukuki sayfa — /legal/:page. */
export function LegalPageView(): React.JSX.Element {
  const { t } = useTranslation('legal')
  const { page } = useParams()

  if (!isLegalPage(page)) {
    return <LegalIndex />
  }

  return (
    <div className="space-y-6">
      <Link
        to="/legal"
        className="inline-block text-sm text-primary-700 underline dark:text-primary-300"
      >
        ‹ {t('indexTitle')}
      </Link>

      <h1 className="text-2xl font-bold">{t(`${page}.title` as 'imprint.title')}</h1>

      <Alert tone="warning">{t('draftWarning')}</Alert>

      <Card className="space-y-6">
        {SECTIONS[page].map((section) => (
          <section key={section}>
            <h2 className="mb-2 text-sm font-semibold">
              {t(`${page}.${section}.heading` as 'imprint.provider.heading')}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {t(`${page}.${section}.body` as 'imprint.provider.body')}
            </p>
          </section>
        ))}
      </Card>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('lastUpdated', { date: t('lastUpdatedDate') })}
      </p>
    </div>
  )
}
