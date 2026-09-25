/**
 * Aktivite kartı — liste, kurum paneli ve admin kuyruğunda aynı kart.
 *
 * Tek bir kart bileşeni tutmanın sebebi: katılımcının gördüğü şeyle kurumun
 * önizlemede gördüğü şey birebir aynı olsun. Kurum "yayınlayınca nasıl
 * görünecek" diye merak etmesin.
 */

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { CATEGORY_META } from '@/config/catalog'
import { formatRange } from '@/lib/format'
import { formatDistance } from '@/lib/geo'
import { Badge } from '@/components/ui'
import { pickText, type Activity, type ActivityStatus } from '@/types/activity'
import type { Locale } from '@/config/brand'

const STATUS_TONE: Record<
  ActivityStatus,
  'neutral' | 'warning' | 'success' | 'danger' | 'info'
> = {
  draft: 'neutral',
  pending_review: 'warning',
  published: 'success',
  cancelled: 'danger',
  completed: 'info',
}

export function ActivityStatusBadge({
  status,
}: {
  status: ActivityStatus
}): React.JSX.Element {
  const { t } = useTranslation('activities')
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
}

interface ActivityCardProps {
  activity: Activity
  /** Kullanıcının konumundan mesafe (km) — yoksa gösterilmez. */
  distanceKm?: number | null
  /** Kurum/admin görünümünde durum rozeti gösterilir. */
  showStatus?: boolean
  to?: string
  /** Kart altına ek düğmeler (kurum paneli). */
  footer?: React.ReactNode
}

export function ActivityCard({
  activity,
  distanceKm = null,
  showStatus = false,
  to,
  footer,
}: ActivityCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation('activities')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const title = pickText(activity.title, locale)
  const category = CATEGORY_META[activity.categoryId]
  const spotsLeft = Math.max(0, activity.capacity - activity.stats.applicants)
  const href = to ?? `/activities/${activity.id}`

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      {activity.coverImageURL && (
        <img
          src={activity.coverImageURL}
          alt=""
          loading="lazy"
          className="h-32 w-full object-cover"
        />
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${category.tint}`}
          >
            {category.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug">
              <Link
                to={href}
                className="hover:underline"
                aria-label={t('card.openLabel', { title })}
              >
                {title}
              </Link>
            </h3>
            <p className="truncate text-sm text-gray-600 dark:text-gray-400">
              {activity.orgName}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300">
          {formatRange(activity.startAt.toDate(), activity.endAt.toDate(), locale)}
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {activity.online ? (
            <span>🌐 {t('card.online')}</span>
          ) : (
            <span className="line-clamp-1">📍 {activity.location.address}</span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {showStatus && <ActivityStatusBadge status={activity.status} />}

          <Badge tone="info">{t(`type.${activity.type}`)}</Badge>

          {activity.rewards.ip > 0 && (
            <Badge tone="neutral">
              {t('card.points', { count: activity.rewards.ip })}
            </Badge>
          )}

          {distanceKm !== null && (
            <Badge tone="neutral">{formatDistance(distanceKm, locale)}</Badge>
          )}

          {!activity.requiresApplication ? (
            <Badge tone="neutral">{t('card.noApplication')}</Badge>
          ) : spotsLeft === 0 ? (
            <Badge tone="danger">{t('card.full')}</Badge>
          ) : (
            <Badge tone="success">{t('card.spotsLeft', { count: spotsLeft })}</Badge>
          )}
        </div>

        {footer && <div className="flex flex-wrap gap-2 pt-1">{footer}</div>}
      </div>
    </article>
  )
}
