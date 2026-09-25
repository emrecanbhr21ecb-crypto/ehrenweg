/**
 * Henüz yazılmamış sekmelerin dürüst boş durumu (Activities, Learn, Wallet).
 *
 * "Yakında" demek yerine ne zaman geleceğini söylüyoruz — kullanıcı boş bir
 * ekrana bakıp uygulamanın bozuk olduğunu düşünmesin. Faz 2/4'te bu bileşen
 * gerçek sayfalarla değiştirilip silinecek.
 */

import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui'

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
 * Kurum paneli — Faz 2'de gelecek. Menüde yalnız org rolü olanlara görünür.
 */
export function OrgPanel(): React.JSX.Element {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.org')} body={t('soon.org')} emoji="🏛️" />
}

/** Platform yönetimi — Faz 2'de kurum doğrulama kuyruğuyla başlayacak. */
export function AdminPanel(): React.JSX.Element {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.admin')} body={t('soon.admin')} emoji="🛡️" />
}
