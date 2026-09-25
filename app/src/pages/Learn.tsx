/**
 * Learn (Akademi) — CLAUDE.md Bölüm 9.
 *
 * "dil ve beceri eğitimleri, trainer'ların oturumları, kaynak içerikler"
 *
 * Activities ekranının kardeşi ama yalnız `type: 'training'` gösteriyor.
 * Ayrı bir ekran olmasının sebebi Bölüm 9'daki sekme listesi: öğrenmek için
 * gelen kişi gönüllülük ilanlarının arasında kaybolmasın.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ActivityCard } from '@/components/ActivityCard'
import { Alert, Button, Card, EmptyState, Spinner, Switch } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { applyFilters, watchPublishedActivities } from '@/lib/activities'
import { DEFAULT_FILTERS, type Activity } from '@/types/activity'
import type { Locale } from '@/config/brand'

export default function Learn(): React.JSX.Element {
  const { t, i18n } = useTranslation(['trainer', 'activities'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { profile, orgRoles } = useAuth()

  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyLanguage, setOnlyLanguage] = useState(false)

  const isTrainer = profile?.trainerStatus === 'approved'
  const orgId = Object.keys(orgRoles)[0] ?? ''

  useEffect(() => {
    return watchPublishedActivities(
      (rows) => {
        setActivities(rows)
        setError(null)
      },
      (caught) => {
        console.error('[learn] Liste okunamadı:', caught)
        setError(t('activities:list.loadFailed'))
        setActivities([])
      },
    )
  }, [t])

  const courses = useMemo(() => {
    if (!activities) return []
    const filtered = applyFilters(
      activities,
      { ...DEFAULT_FILTERS, type: 'training' },
      { locale, origin: null },
    )
    if (!onlyLanguage) return filtered
    return filtered.filter(
      (activity) =>
        activity.categoryId === 'language_learning' ||
        activity.categoryId === 'language_teaching',
    )
  }, [activities, locale, onlyLanguage])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('trainer:learn.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('trainer:learn.subtitle')}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Eğitmen kendi kursunu buradan önerir (Bölüm 8). */}
      {isTrainer && (
        <Card className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('trainer:learn.proposeHint')}
          </p>
          <Link to={orgId ? `/org/activities/new?org=${orgId}` : '/org'}>
            <Button variant="secondary">➕ {t('trainer:learn.propose')}</Button>
          </Link>
        </Card>
      )}

      <Switch
        checked={onlyLanguage}
        onChange={setOnlyLanguage}
        label={t('trainer:learn.onlyLanguage')}
      />

      {activities === null && (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      )}

      {activities !== null && courses.length === 0 && (
        <EmptyState
          emoji="🎓"
          title={t('trainer:learn.title')}
          body={
            onlyLanguage ? t('trainer:learn.emptyFiltered') : t('trainer:learn.empty')
          }
        />
      )}

      {courses.length > 0 && (
        <ul className="space-y-4">
          {courses.map((activity) => (
            <li key={activity.id}>
              <ActivityCard activity={activity} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
