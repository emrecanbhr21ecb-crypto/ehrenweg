/**
 * Aktivite detay sayfası (CLAUDE.md Bölüm 9):
 * Leichte-Sprache anahtarı, takvime ekle, paylaş, başvur / geri çek,
 * "bir gün önce hatırlat" yerel bildirimi.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { AttendanceClaim } from '@/components/AttendanceClaim'
import { MapView } from '@/components/MapView'
import { ActivityStatusBadge } from '@/components/ActivityCard'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Spinner,
  TextArea,
  VerifiedBadge,
} from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { useAuth } from '@/lib/AuthProvider'
import { isOpenForApplication, remainingSpots, watchActivity } from '@/lib/activities'
import {
  applyToActivity,
  watchMyApplication,
  withdrawApplication,
} from '@/lib/applications'
import { downloadIcs, shareActivity } from '@/lib/calendar'
import { resolveErrorKey } from '@/lib/errorKey'
import { formatDateTime, formatRange } from '@/lib/format'
import {
  cancelReminder,
  hasReminder,
  scheduleReminder,
  type ReminderResult,
} from '@/lib/reminders'
import { fetchOrganization } from '@/lib/organizations'
import {
  hasText,
  pickText,
  type Activity,
  type Application,
  type Organization,
} from '@/types/activity'
import type { Locale } from '@/config/brand'

/** Etiket–değer satırı. Ekran okuyucuda `<dt>/<dd>` çifti olarak okunur. */
function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

export default function ActivityDetail(): React.JSX.Element {
  const { activityId = '' } = useParams()
  const { t, i18n } = useTranslation(['activities', 'catalog', 'errors'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [activity, setActivity] = useState<Activity | null | undefined>(undefined)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [application, setApplication] = useState<Application | null>(null)

  const [simple, setSimple] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reminderOn, setReminderOn] = useState(() => hasReminder(activityId))

  useEffect(() => {
    if (!activityId) return
    return watchActivity(
      activityId,
      (next) => setActivity(next),
      (caught) => {
        console.error('[activity] Okunamadı:', caught)
        setActivity(null)
      },
    )
  }, [activityId])

  useEffect(() => {
    if (!activityId || !user) return
    return watchMyApplication(activityId, user.uid, setApplication, (caught) =>
      console.error('[activity] Başvuru okunamadı:', caught),
    )
  }, [activityId, user])

  useEffect(() => {
    if (!activity?.orgId) return
    void fetchOrganization(activity.orgId)
      .then(setOrganization)
      .catch(() => setOrganization(null))
  }, [activity?.orgId])

  const title = activity ? pickText(activity.title, locale) : ''

  const body = useMemo(() => {
    if (!activity) return ''
    if (simple && hasText(activity.simpleDescription)) {
      return pickText(activity.simpleDescription, locale)
    }
    return pickText(activity.description, locale)
  }, [activity, simple, locale])

  if (activity === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  if (activity === null) {
    return (
      <EmptyState
        emoji="🔍"
        title={t('activities:detail.notFoundTitle')}
        body={t('activities:detail.notFoundBody')}
        action={
          <Link to="/activities">
            <Button variant="secondary">{t('activities:detail.backToList')}</Button>
          </Link>
        }
      />
    )
  }

  const category = CATEGORY_META[activity.categoryId]
  const start = activity.startAt.toDate()
  const open = isOpenForApplication(activity)
  const level = profile?.stats.level ?? 1
  const levelBlocked = activity.minLevel > level
  const activeApplication =
    application && application.status !== 'withdrawn' ? application : null

  async function handleApply(): Promise<void> {
    if (!user || !profile || !activity) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await applyToActivity(
        activity,
        {
          uid: user.uid,
          displayName: profile.displayName,
          languages: profile.languages.map((entry) => entry.code),
        },
        message.trim(),
      )
      setMessage('')
      setNotice(t('activities:apply.success'))
    } catch (caught) {
      console.error('[activity] Başvuru başarısız:', caught)
      setError(t(resolveErrorKey(caught), { ns: 'errors' }))
    } finally {
      setBusy(false)
    }
  }

  async function handleWithdraw(): Promise<void> {
    if (!user || !activity) return
    if (!window.confirm(t('activities:apply.withdrawConfirm'))) return
    setBusy(true)
    setError(null)
    try {
      await withdrawApplication(activity.id, user.uid)
      setNotice(t('activities:apply.withdrawn'))
    } catch (caught) {
      console.error('[activity] Geri çekilemedi:', caught)
      setError(t(resolveErrorKey(caught), { ns: 'errors' }))
    } finally {
      setBusy(false)
    }
  }

  async function handleShare(): Promise<void> {
    if (!activity) return
    const result = await shareActivity(activity.id, title)
    setNotice(
      result === 'shared'
        ? t('activities:detail.shared')
        : result === 'copied'
          ? t('activities:detail.copied')
          : t('activities:detail.shareFailed'),
    )
  }

  async function handleReminder(): Promise<void> {
    if (!activity) return
    if (reminderOn) {
      await cancelReminder(activity.id)
      setReminderOn(false)
      setNotice(t('activities:detail.reminderRemoved'))
      return
    }

    const result: ReminderResult = await scheduleReminder(activity.id, start, {
      title,
      body: activity.online ? t('activities:card.online') : activity.location.address,
    })

    if (result === 'scheduled' || result === 'scheduled_web_only') {
      setReminderOn(true)
      setNotice(
        result === 'scheduled'
          ? t('activities:detail.reminderSet')
          : t('activities:detail.reminderWebOnly'),
      )
      return
    }
    setNotice(
      result === 'too_late'
        ? t('activities:detail.reminderTooLate')
        : t('activities:detail.reminderDenied'),
    )
  }

  return (
    <article className="space-y-5">
      <Button variant="ghost" onClick={() => void navigate(-1)}>
        ← {t('activities:detail.backToList')}
      </Button>

      {activity.coverImageURL && (
        <img
          src={activity.coverImageURL}
          alt=""
          className="h-44 w-full rounded-2xl object-cover"
        />
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            <span aria-hidden="true">{category.emoji}</span>
            {t(`catalog:categories.${activity.categoryId}`)}
          </Badge>
          <Badge tone="info">{t(`activities:type.${activity.type}`)}</Badge>
          {activity.status !== 'published' && (
            <ActivityStatusBadge status={activity.status} />
          )}
        </div>

        <h1 className="text-2xl font-bold leading-tight">{title}</h1>

        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>{activity.orgName}</span>
          {organization?.verified && (
            <VerifiedBadge label={t('activities:detail.organiser')} />
          )}
        </p>
      </header>

      {activity.status === 'cancelled' && (
        <Alert tone="error">{t('activities:detail.cancelled')}</Alert>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('activities:detail.about')}</h2>

          {hasText(activity.simpleDescription) && (
            <button
              type="button"
              role="switch"
              aria-checked={simple}
              onClick={() => setSimple((value) => !value)}
              className="min-h-11 rounded-full border border-primary-700 px-4 text-sm font-medium text-primary-800 dark:text-primary-200"
            >
              {simple
                ? t('activities:detail.simpleOn')
                : t('activities:detail.simpleOff')}
            </button>
          )}
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
      </section>

      <Card className="p-0">
        <dl className="px-5">
          <Row label={t('activities:detail.when')}>
            {formatRange(start, activity.endAt.toDate(), locale)}
          </Row>

          <Row label={t('activities:detail.where')}>
            {activity.online
              ? t('activities:detail.onlineEvent')
              : activity.location.address}
          </Row>

          {activity.requiresApplication && (
            <Row label={t('activities:detail.capacity')}>
              {t('activities:detail.capacityValue', {
                taken: activity.stats.applicants,
                total: activity.capacity,
              })}
            </Row>
          )}

          {activity.applicationDeadline && (
            <Row label={t('activities:detail.deadline')}>
              {formatDateTime(activity.applicationDeadline.toDate(), locale)}
            </Row>
          )}

          {activity.languagesUsed.length > 0 && (
            <Row label={t('activities:detail.languages')}>
              {activity.languagesUsed
                .map((code) => t(`catalog:languages.codes.${code}`))
                .join(' · ')}
            </Row>
          )}

          {activity.skillsGained.length > 0 && (
            <Row label={t('activities:detail.skills')}>
              {activity.skillsGained
                .map((skill) => t(`catalog:skills.${skill}`))
                .join(' · ')}
            </Row>
          )}

          {activity.rewards.ip > 0 && (
            <Row label={t('activities:detail.reward')}>
              {t('activities:card.points', { count: activity.rewards.ip })}
            </Row>
          )}

          {activity.hoursCredited > 0 && (
            <Row label={t('activities:detail.hours')}>
              {t('activities:detail.hoursValue', { count: activity.hoursCredited })}
            </Row>
          )}

          {activity.minLevel > 0 && (
            <Row label={t('activities:detail.minLevel', { level: activity.minLevel })}>
              {t(`levels.${Math.min(5, activity.minLevel) as 1 | 2 | 3 | 4 | 5}`, {
                ns: 'common',
              })}
            </Row>
          )}
        </dl>
      </Card>

      {!activity.online &&
        activity.location.lat !== null &&
        activity.location.lng !== null && (
          <MapView
            ariaLabel={t('activities:detail.where')}
            className="h-56 w-full rounded-2xl"
            markers={[
              {
                id: activity.id,
                lat: activity.location.lat,
                lng: activity.location.lng,
                emoji: category.emoji,
                title,
              },
            ]}
          />
        )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            downloadIcs(activity, {
              title,
              description: pickText(activity.description, locale),
            })
          }
        >
          📅 {t('activities:detail.addToCalendar')}
        </Button>

        <Button variant="secondary" onClick={() => void handleShare()}>
          🔗 {t('activities:detail.share')}
        </Button>

        <Button variant="secondary" onClick={() => void handleReminder()}>
          🔔{' '}
          {reminderOn
            ? t('activities:detail.reminderOff')
            : t('activities:detail.reminderOn')}
        </Button>
      </div>

      {/* item 8 — aktivite bittiyse "ben oradaydım" nachtrağı */}
      <AttendanceClaim activity={activity} />

      {/* --- Başvuru bölümü --- */}
      {!activity.requiresApplication ? (
        <Alert tone="info">{t('activities:detail.noApplicationNeeded')}</Alert>
      ) : activeApplication ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                activeApplication.status === 'accepted'
                  ? 'success'
                  : activeApplication.status === 'rejected'
                    ? 'danger'
                    : 'info'
              }
            >
              {t(`activities:application.${activeApplication.status}`)}
            </Badge>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t(`activities:application.${activeApplication.status}Hint`)}
          </p>

          {activeApplication.decisionNote && (
            <p className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-ink-800">
              {activeApplication.decisionNote}
            </p>
          )}

          {activeApplication.status !== 'rejected' && (
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void handleWithdraw()}
            >
              {t('activities:apply.withdraw')}
            </Button>
          )}
        </Card>
      ) : levelBlocked ? (
        <Alert tone="warning">
          {t('activities:detail.minLevelBlocked', { level: activity.minLevel })}
        </Alert>
      ) : activity.status !== 'published' ? (
        <Alert tone="warning">{t('activities:apply.closed')}</Alert>
      ) : !open ? (
        <Alert tone="warning">
          {remainingSpots(activity) === 0
            ? t('activities:apply.full')
            : t('activities:apply.closed')}
        </Alert>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">{t('activities:apply.title')}</h2>

          <TextArea
            label={t('activities:apply.message')}
            hint={t('activities:apply.messageHint')}
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <Button full loading={busy} onClick={() => void handleApply()}>
            {busy ? t('activities:apply.sending') : t('activities:apply.submit')}
          </Button>
        </Card>
      )}
    </article>
  )
}
