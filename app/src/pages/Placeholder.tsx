/**
 * Henüz yazılmamış sekmelerin dürüst boş durumu (Activities, Learn, Wallet).
 *
 * "Yakında" demek yerine ne zaman geleceğini söylüyoruz — kullanıcı boş bir
 * ekrana bakıp uygulamanın bozuk olduğunu düşünmesin. Faz 2/4'te bu bileşen
 * gerçek sayfalarla değiştirilip silinecek.
 */

import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui'
import { BRAND } from '@/config/brand'

/**
 * Çözümlenmiş METİN alır, anahtar değil — böylece tip güvenli i18n devrede
 * kalır (gevşek `string` anahtar, olmayan anahtarın derlemede yakalanmasını
 * engellerdi).
 */
export function ComingSoon({
  title,
  body,
  emoji,
}: {
  title: string
  body: string
  emoji: string
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="text-center">
        <p className="text-4xl" aria-hidden="true">
          {emoji}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {body}
        </p>
      </Card>
    </div>
  )
}

export function Activities(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <ComingSoon title={t('nav.activities')} body={t('soon.activities')} emoji="🗺️" />
  )
}

export function Learn(): React.JSX.Element {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.learn')} body={t('soon.learn')} emoji="🎓" />
}

export function Wallet(): React.JSX.Element {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.wallet')} body={t('soon.wallet')} emoji="🎁" />
}

/**
 * Impressum / gizlilik / şartlar bağlantıları.
 *
 * Almanya'da Impressum yasal zorunluluk (TMG §5) ve uygulamanın her yerinden
 * ulaşılabilir olmalı — bu yüzden gerçek bir sayfa, "yakında" değil. Metinler
 * web sitesinde tutuluyor; Faz 7'de uygulama içine de gömülecek.
 */
export function Legal(): React.JSX.Element {
  const { t } = useTranslation()

  const links = [
    { href: BRAND.urls.imprint, key: 'legal.imprint' },
    { href: BRAND.urls.privacy, key: 'legal.privacy' },
    { href: BRAND.urls.terms, key: 'legal.terms' },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.legalLinks')}</h1>
      <Card>
        <ul className="divide-y divide-gray-200 dark:divide-ink-800">
          {links.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm font-medium"
              >
                {t(link.key)}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('legal.contact', { email: BRAND.supportEmail })}
      </p>
    </div>
  )
}
