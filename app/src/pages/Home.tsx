/**
 * Ana sayfa.
 *
 * Faz 1 kapsamı: selamlama, bu ayki özet, profil tamamlama durumu ve
 * ilgi alanları. Duyuru slider'ı, AI önerileri, hava durumu ve yaklaşan
 * başvurular Faz 2/6'da bu iskeletin içine yerleşecek — yerleri şimdiden
 * belli olsun diye bölüm başlıkları duruyor, sahte veri YOK (CLAUDE.md:
 * arayüzde "demo/örnek" afişi olmaz, boş durum dürüstçe gösterilir).
 */

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { StatTile } from '@/components/LevelRing'
import { Button, Card } from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { useAuth } from '@/lib/AuthProvider'

/** Berlin saatine göre selamlama — kullanıcı başka saat diliminde olabilir. */
function greetingKey(now: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('de-DE', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }).format(now),
  )
  if (hour < 11) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export default function Home(): React.JSX.Element {
  const { t } = useTranslation()
  const { profile } = useAuth()

  const firstName = (profile?.displayName ?? '').split(' ')[0] ?? ''
  const stats = profile?.stats

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t(`home.greeting.${greetingKey(new Date())}` as 'home.greeting.morning')}
        </p>
        <h1 className="text-2xl font-bold">{firstName || t('home.greetingFallback')}</h1>
      </header>

      {stats && (
        <section aria-labelledby="month-summary">
          <h2 id="month-summary" className="mb-3 text-sm font-semibold">
            {t('home.summaryTitle')}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label={t('passport.ip')} value={stats.ip} emoji="⭐" />
            <StatTile
              label={t('passport.hours')}
              value={Math.round(stats.hours)}
              emoji="⏱️"
            />
            <StatTile
              label={t('passport.activities')}
              value={stats.activitiesCompleted}
              emoji="✅"
            />
          </div>
        </section>
      )}

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 text-sm font-semibold">
          {t('home.upcomingTitle')}
        </h2>
        <Card className="text-center">
          <p className="text-3xl" aria-hidden="true">
            🔎
          </p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {t('home.noUpcoming')}
          </p>
          <Button className="mt-4" variant="secondary">
            <Link to="/activities">{t('home.browseActivities')}</Link>
          </Button>
        </Card>
      </section>

      {profile && profile.interests.length > 0 && (
        <section aria-labelledby="your-interests">
          <h2 id="your-interests" className="mb-3 text-sm font-semibold">
            {t('home.yourInterests')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.interests.map((id) => (
              <li
                key={id}
                className={`rounded-full px-3 py-1.5 text-sm ${CATEGORY_META[id].tint}`}
              >
                <span aria-hidden="true" className="me-1">
                  {CATEGORY_META[id].emoji}
                </span>
                {t(`categories.${id}` as 'categories.environment', { ns: 'catalog' })}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t('home.interestsHint')}{' '}
            <Link to="/profile/edit" className="underline">
              {t('home.editInterests')}
            </Link>
          </p>
        </section>
      )}
    </div>
  )
}
