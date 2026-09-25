/**
 * Henüz yazılmamış sekmenin dürüst boş durumu (Learn).
 *
 * "Yakında" demek yerine ne zaman geleceğini söylüyoruz — kullanıcı boş bir
 * ekrana bakıp uygulamanın bozuk olduğunu düşünmesin. Activities, Kurum ve
 * Yönetim Faz 2'de, Wallet Faz 4'te gerçek sayfaya dönüştü; Learn Faz 5'te
 * dönüşünce bu dosya tamamen silinecek.
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

export function Learn(): React.JSX.Element {
  const { t } = useTranslation()
  return <ComingSoon title={t('nav.learn')} body={t('soon.learn')} emoji="🎓" />
}
