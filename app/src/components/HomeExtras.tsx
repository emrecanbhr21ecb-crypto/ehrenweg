/**
 * Ana ekranın Faz 6 parçaları — CLAUDE.md Bölüm 9:
 * duyuru slider'ı, "sana uygun" önerileri, yaklaşan başvurular,
 * bu ayki özet, hava durumu.
 *
 * Ayrı dosya: Home.tsx Faz 1'den beri sade bir iskelet ve öyle kalsın;
 * bu parçalar kendi veri aboneliklerini taşıyor.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ActivityCard } from '@/components/ActivityCard'
import { Badge, Card, Spinner } from '@/components/ui'
import { findCity, matchCityByName } from '@/config/cities'
import { useAuth } from '@/lib/AuthProvider'
import { watchPublishedActivities } from '@/lib/activities'
import { watchAnnouncements } from '@/lib/announcements'
import { watchMyApplications } from '@/lib/applications'
import { formatDate, formatDateTime } from '@/lib/format'
import { readStoredCityId } from '@/lib/geo'
import { watchMyPassport } from '@/lib/passport'
import { fetchWeather, type Weather } from '@/lib/weather'
import { pickText, type Activity, type Application } from '@/types/activity'
import type { Announcement } from '@/types/announcement'
import type { PassportEntry } from '@/types/attendance'
import type { Locale } from '@/config/brand'

// --- Hava durumu -----------------------------------------------------------

/**
 * Hava durumu rozeti.
 *
 * Konum İSTEMEZ: profildeki ya da daha önce seçilmiş şehri kullanır. Hava
 * durumu için GPS izni istemek, verdiği değere göre fazla bir bedel.
 */
export function WeatherBadge(): React.JSX.Element | null {
  const { t } = useTranslation('notify')
  const { profile } = useAuth()
  const [weather, setWeather] = useState<Weather | null>(null)

  const city = useMemo(() => {
    const storedId = readStoredCityId()
    if (storedId) return findCity(storedId)
    return profile?.city ? matchCityByName(profile.city) : undefined
  }, [profile?.city])

  useEffect(() => {
    if (!city) return
    void fetchWeather({ lat: city.lat, lng: city.lng }).then(setWeather)
  }, [city])

  if (!city || !weather) return null

  return (
    <Badge tone="neutral">
      <span aria-hidden="true">{weather.emoji}</span>
      {t('home.weather', { temp: weather.temperature, city: city.name })}
    </Badge>
  )
}

// --- Duyuru slider'ı -------------------------------------------------------

/**
 * Duyurular. Yatay kaydırılabilir kartlar.
 *
 * Otomatik dönen bir karusel YOK: erişilebilirlik açısından kötü (ekran
 * okuyucu ve motor güçlüğü olan kullanıcı yakalayamaz) ve kimsenin okumadığı
 * bir hareketten ibaret. Kullanıcı kendi kaydırıyor.
 */
export function AnnouncementSlider(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('notify')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    return watchAnnouncements(
      (rows) => setItems(rows.filter((row) => row.pinned)),
      (caught) => console.error('[home] Duyurular okunamadı:', caught),
    )
  }, [])

  if (items.length === 0) return null

  return (
    <section aria-labelledby="news-heading">
      <h2 id="news-heading" className="mb-3 text-sm font-semibold">
        {t('home.announcementsTitle')}
      </h2>

      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {items.map((item) => {
          const body = (
            <Card className="h-full w-72 shrink-0 snap-start space-y-2">
              {item.imageURL && (
                <img
                  src={item.imageURL}
                  alt=""
                  loading="lazy"
                  className="h-24 w-full rounded-xl object-cover"
                />
              )}
              <p className="font-semibold leading-snug">
                {pickText(item.title, locale)}
              </p>
              <p className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                {pickText(item.body, locale)}
              </p>
              <p className="text-xs text-gray-500">
                {item.orgName}
                {item.createdAt && ` · ${formatDate(item.createdAt.toDate(), locale)}`}
              </p>
            </Card>
          )

          return (
            <li key={item.id} className="shrink-0">
              {item.linkActivityId ? (
                <Link to={`/activities/${item.linkActivityId}`}>{body}</Link>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// --- "Sana uygun" ----------------------------------------------------------

/**
 * Öneriler — ilgi alanı, dil ve online tercihine göre puanlama.
 *
 * ⚠️ Burada AI YOK ve olmayacak (docs/DECISIONS.md §12). Bir ilçede on iki
 * aktivite var; onu sıralamak için modele ihtiyaç yok. Bu basit puanlama
 * anında çalışıyor, bedava ve "bu öneri neden geldi" sorusunun cevabı belli.
 * AI'nın anlamı beş şehir, üç yüz aktivite olduğunda başlar.
 */
export function Suggestions(): React.JSX.Element | null {
  const { t } = useTranslation(['notify', 'activities'])
  const { profile } = useAuth()

  const [activities, setActivities] = useState<Activity[] | null>(null)

  useEffect(() => {
    return watchPublishedActivities(
      (rows) => setActivities(rows),
      () => setActivities([]),
      60,
    )
  }, [])

  const suggestions = useMemo(() => {
    if (!activities || !profile) return []
    const interests = new Set(profile.interests)
    const languages = new Set(profile.languages.map((entry) => entry.code))
    const now = Date.now()

    return activities
      .filter((activity) => activity.startAt.toMillis() > now)
      .map((activity) => {
        let score = 0
        if (interests.has(activity.categoryId)) score += 3
        if (activity.languagesUsed.some((code) => languages.has(code))) score += 2
        if (activity.online) score += 1
        return { activity, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.activity)
  }, [activities, profile])

  if (activities === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6 text-primary-700" />
      </div>
    )
  }

  if (suggestions.length === 0) return null

  return (
    <section aria-labelledby="suggestions-heading" className="space-y-3">
      <div>
        <h2 id="suggestions-heading" className="text-sm font-semibold">
          {t('notify:home.suggestionsTitle')}
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('notify:home.suggestionsHint')}
        </p>
      </div>

      <ul className="space-y-4">
        {suggestions.map((activity) => (
          <li key={activity.id}>
            <ActivityCard activity={activity} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// --- Yaklaşan başvurular + bu ayki özet ------------------------------------

export function UpcomingAndMonth(): React.JSX.Element | null {
  const { t, i18n } = useTranslation(['notify', 'activities'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [applications, setApplications] = useState<Application[]>([])
  const [entries, setEntries] = useState<PassportEntry[]>([])

  useEffect(() => {
    if (!user) return
    return watchMyApplications(user.uid, setApplications, () => setApplications([]))
  }, [user])

  useEffect(() => {
    if (!user) return
    return watchMyPassport(user.uid, setEntries, () => setEntries([]))
  }, [user])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return applications
      .filter(
        (application) =>
          (application.status === 'accepted' || application.status === 'applied') &&
          (application.activityStartAt?.toMillis() ?? 0) > now,
      )
      .sort(
        (a, b) =>
          (a.activityStartAt?.toMillis() ?? 0) - (b.activityStartAt?.toMillis() ?? 0),
      )
      .slice(0, 3)
  }, [applications])

  const month = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    return entries
      .filter((entry) => (entry.approvedAt?.toMillis() ?? 0) >= start.getTime())
      .reduce(
        (totals, entry) => ({
          hours: totals.hours + entry.hours,
          ip: totals.ip + entry.ipAwarded,
        }),
        { hours: 0, ip: 0 },
      )
  }, [entries])

  return (
    <>
      <section aria-labelledby="month-heading">
        <h2 id="month-heading" className="mb-3 text-sm font-semibold">
          {t('notify:home.monthTitle')}
        </h2>
        <Card>
          {month.hours === 0 && month.ip === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('notify:home.monthEmpty')}
            </p>
          ) : (
            <p className="text-sm">
              <strong>
                {t('notify:home.monthHours', { count: Math.round(month.hours) })}
              </strong>
              {' · '}
              <strong>{t('notify:home.monthIp', { count: month.ip })}</strong>
            </p>
          )}
        </Card>
      </section>

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="mb-3 text-sm font-semibold">
            {t('activities:myApplications.title')}
          </h2>
          <Card className="p-0">
            <ul className="px-5">
              {upcoming.map((application) => (
                <li
                  key={application.activityId}
                  className="border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                >
                  <Link
                    to={`/activities/${application.activityId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {pickText(application.activityTitle, locale)}
                  </Link>
                  {application.activityStartAt && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDateTime(application.activityStartAt.toDate(), locale)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  )
}
