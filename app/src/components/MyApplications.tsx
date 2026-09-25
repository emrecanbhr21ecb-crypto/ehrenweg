/**
 * "Başvurularım" — profil sayfasının bir bölümü (CLAUDE.md Bölüm 9:
 * "katılım geçmişi (katıldı / katılmadı / başvurdu-sonuç)").
 *
 * Dört durum ayrı ayrı görünür: başvurdu, kabul, red, cevap gelmedi.
 * "Cevap gelmedi" ekranda hesaplanır (bkz. `effectiveApplicationStatus`) —
 * kurum karar vermeden tarih geçmişse kullanıcı beklemeye devam etmesin.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Alert, Badge, Button, Card, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { watchMyApplications } from '@/lib/applications'
import { formatDateTime } from '@/lib/format'
import {
  effectiveApplicationStatus,
  pickText,
  type Application,
  type ApplicationStatus,
} from '@/types/activity'
import type { Locale } from '@/config/brand'

const TONE: Record<
  ApplicationStatus,
  'info' | 'success' | 'danger' | 'neutral' | 'warning'
> = {
  applied: 'info',
  accepted: 'success',
  rejected: 'danger',
  no_response: 'warning',
  withdrawn: 'neutral',
}

function ApplicationRow({
  application,
  locale,
}: {
  application: Application
  locale: Locale
}): React.JSX.Element {
  const { t } = useTranslation('activities')
  const status = effectiveApplicationStatus(application)
  const start = application.activityStartAt?.toDate?.() ?? null

  return (
    <li className="border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/activities/${application.activityId}`}
            className="text-sm font-medium hover:underline"
          >
            {pickText(application.activityTitle, locale)}
          </Link>
          {start && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(start, locale)}
            </p>
          )}
        </div>
        <Badge tone={TONE[status]}>{t(`application.${status}`)}</Badge>
      </div>

      {application.decisionNote && (
        <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs dark:bg-ink-800">
          {application.decisionNote}
        </p>
      )}
    </li>
  )
}

export function MyApplications(): React.JSX.Element {
  const { t, i18n } = useTranslation('activities')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [applications, setApplications] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return watchMyApplications(
      user.uid,
      (rows) => {
        setApplications(rows)
        setError(null)
      },
      (caught) => {
        console.error('[applications] Liste okunamadı:', caught)
        setError(t('myApplications.loadFailed'))
        setApplications([])
      },
    )
  }, [user, t])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('myApplications.title')}</h2>

      {error && <Alert tone="error">{error}</Alert>}

      {applications === null && (
        <div className="flex justify-center py-6">
          <Spinner className="size-6 text-primary-700" />
        </div>
      )}

      {applications !== null && applications.length === 0 && (
        <Card className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('myApplications.empty')}
          </p>
          <Link to="/activities" className="mt-3 inline-block">
            <Button variant="secondary">{t('myApplications.browse')}</Button>
          </Link>
        </Card>
      )}

      {applications !== null && applications.length > 0 && (
        <Card className="p-0">
          <ul className="px-5">
            {applications.map((application) => (
              <ApplicationRow
                key={`${application.activityId}-${application.uid}`}
                application={application}
                locale={locale}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
