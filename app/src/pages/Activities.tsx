/**
 * Activities — liste ve harita görünümü (CLAUDE.md Bölüm 9).
 *
 * Yayındaki aktiviteler tek sorguyla canlı dinlenir; kategori/dil/mesafe/tarih
 * süzgeci istemcide çalışır (gerekçe: lib/activities.ts `watchPublishedActivities`).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ActivityCard } from '@/components/ActivityCard'
import { ActivityFilterBar } from '@/components/ActivityFilterBar'
import { LocationPicker } from '@/components/LocationPicker'
import { MapView, type MapMarker } from '@/components/MapView'
import { Alert, Button, EmptyState, Spinner } from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { findCity } from '@/config/cities'
import { useAuth } from '@/lib/AuthProvider'
import {
  activityDistance,
  applyFilters,
  watchPublishedActivities,
} from '@/lib/activities'
import {
  NO_ORIGIN,
  originFromCity,
  originFromProfileCity,
  readStoredCityId,
  type GeoOrigin,
} from '@/lib/geo'
import {
  DEFAULT_FILTERS,
  pickText,
  type Activity,
  type ActivityFilters,
} from '@/types/activity'
import type { Locale } from '@/config/brand'

type ViewMode = 'list' | 'map'

export default function Activities(): React.JSX.Element {
  const { t, i18n } = useTranslation('activities')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ActivityFilters>({ ...DEFAULT_FILTERS })
  const [view, setView] = useState<ViewMode>('list')

  // Başlangıç konumu: daha önce seçilen şehir → profildeki şehir → yok.
  // Cihaz konumu ASLA kendiliğinden istenmez; kullanıcı düğmeye basmalı.
  const [origin, setOrigin] = useState<GeoOrigin>(() => {
    const storedId = readStoredCityId()
    const stored = storedId ? findCity(storedId) : undefined
    if (stored) return originFromCity(stored)
    return NO_ORIGIN
  })

  useEffect(() => {
    if (origin.source !== 'none' || !profile?.city) return
    const guess = originFromProfileCity(profile.city)
    if (guess.source !== 'none') setOrigin(guess)
  }, [profile?.city, origin.source])

  useEffect(() => {
    return watchPublishedActivities(
      (rows) => {
        setActivities(rows)
        setError(null)
      },
      (caught) => {
        console.error('[activities] Liste okunamadı:', caught)
        setError(t('list.loadFailed'))
        setActivities([])
      },
    )
  }, [t])

  const visible = useMemo(() => {
    if (!activities) return []
    return applyFilters(activities, filters, { locale, origin: origin.point })
  }, [activities, filters, locale, origin.point])

  const markers = useMemo<MapMarker[]>(
    () =>
      visible
        .filter(
          (activity) =>
            activity.location.lat !== null && activity.location.lng !== null,
        )
        .map((activity) => ({
          id: activity.id,
          lat: activity.location.lat as number,
          lng: activity.location.lng as number,
          emoji: CATEGORY_META[activity.categoryId].emoji,
          title: pickText(activity.title, locale),
        })),
    [visible, locale],
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('list.subtitle')}
        </p>
      </header>

      <LocationPicker origin={origin} onChange={setOrigin} />

      <ActivityFilterBar
        filters={filters}
        onChange={setFilters}
        distanceAvailable={origin.point !== null}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          {t('list.resultCount', { count: visible.length })}
        </p>

        <div
          role="group"
          aria-label={t('list.title')}
          className="flex overflow-hidden rounded-xl border border-gray-300 dark:border-ink-700"
        >
          {(['list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={[
                'min-h-11 px-4 text-sm font-medium',
                view === mode
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-gray-700 dark:bg-ink-900 dark:text-gray-300',
              ].join(' ')}
            >
              {mode === 'list' ? t('list.viewList') : t('list.viewMap')}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {activities === null && (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      )}

      {activities !== null && visible.length === 0 && (
        <EmptyState
          emoji="🔎"
          title={
            activities.length === 0
              ? t('list.emptyTitle')
              : t('list.emptyFilteredTitle')
          }
          body={
            activities.length === 0 ? t('list.emptyBody') : t('list.emptyFilteredBody')
          }
          action={
            activities.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              >
                {t('list.clearFilters')}
              </Button>
            ) : undefined
          }
        />
      )}

      {visible.length > 0 && view === 'list' && (
        <ul className="space-y-4">
          {visible.map((activity) => (
            <li key={activity.id}>
              <ActivityCard
                activity={activity}
                distanceKm={activityDistance(activity, origin.point)}
              />
            </li>
          ))}
        </ul>
      )}

      {visible.length > 0 && view === 'map' && (
        <div className="space-y-2">
          {markers.length === 0 ? (
            <Alert tone="info">{t('list.mapNoCoordinates')}</Alert>
          ) : (
            <>
              <MapView
                markers={markers}
                ariaLabel={t('list.viewMap')}
                onSelect={(id) => void navigate(`/activities/${id}`)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('list.mapHint')}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
