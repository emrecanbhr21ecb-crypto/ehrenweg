/**
 * Integrationspass ayrıntısı — CLAUDE.md Bölüm 9, item 9.
 *
 * Rozetler, kategori dağılımı ve katılım geçmişi. Seviye halkası ve sayı
 * kartları Profile ekranında zaten var; burası onun altındaki katman.
 *
 * Rozetler Firestore'da SAKLANMIYOR, pasaport girdilerinden hesaplanıyor —
 * gerekçe: config/scoring.ts `earnedBadges`.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Badge, Card, Spinner } from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { BADGE_EMOJI, earnedBadges, type BadgeId } from '@/config/scoring'
import { useAuth } from '@/lib/AuthProvider'
import { formatDate } from '@/lib/format'
import { passportSummary, watchMyPassport } from '@/lib/passport'
import { restrictionEndsAt } from '@/types/user'
import type { PassportEntry } from '@/types/attendance'
import type { Locale } from '@/config/brand'

export function PassportDetails(): React.JSX.Element {
  const { t, i18n } = useTranslation(['attendance', 'catalog', 'common'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, profile } = useAuth()

  const [entries, setEntries] = useState<PassportEntry[] | null>(null)

  useEffect(() => {
    if (!user) return
    return watchMyPassport(user.uid, setEntries, (caught) => {
      console.error('[passport] Girdiler okunamadı:', caught)
      setEntries([])
    })
  }, [user])

  const summary = useMemo(() => passportSummary(entries ?? []), [entries])

  const badges = useMemo<BadgeId[]>(
    () =>
      earnedBadges({
        activitiesCompleted: profile?.stats.activitiesCompleted ?? 0,
        categoryIds: summary.categoryIds,
        languageCount: summary.languageCount,
        topOrgCount: summary.topOrgCount,
        isTrainer: profile?.trainerStatus === 'approved',
      }),
    [profile, summary],
  )

  const restriction = restrictionEndsAt(profile)
  const noShows = profile?.stats.noShows ?? 0

  if (entries === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başvuru kısıtı — nazik dille (CLAUDE.md Bölüm 6) */}
      {restriction && (
        <Alert tone="warning">
          <strong className="block">{t('attendance:noShow.restrictedTitle')}</strong>
          {t('attendance:noShow.restrictedBody', {
            date: formatDate(restriction, locale),
          })}
        </Alert>
      )}

      {!restriction && noShows > 0 && (
        <Alert tone="info">
          <strong className="block">{t('attendance:noShow.userWarningTitle')}</strong>
          {t('attendance:noShow.userWarningBody', { count: noShows })}
        </Alert>
      )}

      {/* Rozetler */}
      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="mb-3 text-sm font-semibold">
          {t('attendance:passport.badgesTitle')}
        </h2>

        {badges.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:passport.badgesEmpty')}
          </Card>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {badges.map((badge) => (
              <li
                key={badge}
                className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-ink-800/60"
              >
                <p className="text-2xl" aria-hidden="true">
                  {BADGE_EMOJI[badge]}
                </p>
                <p className="mt-1 text-[11px] leading-tight font-medium">
                  {t(`attendance:badge.${badge}`)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kategori dağılımı */}
      {summary.byCategory.length > 0 && (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-3 text-sm font-semibold">
            {t('attendance:passport.categoriesTitle')}
          </h2>
          <Card className="space-y-3">
            {summary.byCategory.map((row) => {
              const share =
                summary.byCategory[0] && summary.byCategory[0].count > 0
                  ? (row.count / summary.byCategory[0].count) * 100
                  : 0
              return (
                <div key={row.categoryId}>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      <span aria-hidden="true" className="me-1">
                        {CATEGORY_META[row.categoryId].emoji}
                      </span>
                      {t(`catalog:categories.${row.categoryId}`)}
                    </span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {row.count} ·{' '}
                      {t('attendance:passport.hoursShort', {
                        count: Math.round(row.hours),
                      })}
                    </span>
                  </div>
                  {/* Çubuk dekoratif; sayı zaten yukarıda yazıyor. */}
                  <div
                    aria-hidden="true"
                    className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-ink-800"
                  >
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${Math.max(8, share)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {/* Katılım geçmişi */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-sm font-semibold">
          {t('attendance:passport.historyTitle')}
        </h2>

        {entries.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:passport.historyEmpty')}
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="px-5">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.activityTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span aria-hidden="true">
                        {CATEGORY_META[entry.categoryId].emoji}{' '}
                      </span>
                      {t(`catalog:categories.${entry.categoryId}`)}
                      {entry.approvedAt &&
                        ` · ${formatDate(entry.approvedAt.toDate(), locale)}`}
                    </p>
                    {entry.source === 'admin' && (
                      <Badge tone="neutral" className="mt-1">
                        {t('attendance:passport.sourceAdmin')}
                      </Badge>
                    )}
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold tabular-nums">
                      {t('attendance:passport.pointsShort', { count: entry.ipAwarded })}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      {t('attendance:passport.hoursShort', { count: entry.hours })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
