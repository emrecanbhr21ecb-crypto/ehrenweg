/**
 * Kurum paneli — bir aktivitenin başvuranları, kabul/red.
 *
 * Kuruma gösterilen bilgi bilinçli olarak asgari: ad, konuşulan diller ve
 * başvuru mesajı. Profil belgesi HİÇ okunmuyor (CLAUDE.md Bölüm 10 veri
 * minimizasyonu) — bu alanlar başvuru anında başvuru belgesine kopyalanıyor.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Alert, Badge, Button, Card, Spinner, TextArea } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { fetchActivity } from '@/lib/activities'
import { decideApplication, watchApplicants } from '@/lib/applications'
import { formatDateTime } from '@/lib/format'
import { pickText, type Activity, type Application } from '@/types/activity'
import type { Locale } from '@/config/brand'

function ApplicantRow({
  application,
  onDecide,
  busy,
}: {
  application: Application
  onDecide: (decision: 'accept' | 'reject', note: string) => void
  busy: boolean
}): React.JSX.Element {
  const { t, i18n } = useTranslation(['manage', 'catalog', 'activities'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const [note, setNote] = useState('')

  const decided = application.status !== 'applied'

  return (
    <li className="space-y-3 border-t border-gray-100 py-4 first:border-t-0 dark:border-ink-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{application.applicantName}</p>
          {application.applicantLanguages.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t('manage:applicants.speaks')}:{' '}
              {application.applicantLanguages
                .map((code) => t(`catalog:languages.codes.${code}`))
                .join(', ')}
            </p>
          )}
        </div>

        <Badge
          tone={
            application.status === 'accepted'
              ? 'success'
              : application.status === 'rejected'
                ? 'danger'
                : application.status === 'withdrawn'
                  ? 'neutral'
                  : 'info'
          }
        >
          {t(`activities:application.${application.status}`)}
        </Badge>
      </div>

      {application.message && (
        <p className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-ink-800">
          {application.message}
        </p>
      )}

      {decided ? (
        application.decidedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('manage:applicants.decidedBy', {
              date: formatDateTime(application.decidedAt.toDate(), locale),
            })}
          </p>
        )
      ) : (
        <div className="space-y-2">
          <TextArea
            label={t('manage:applicants.noteLabel')}
            placeholder={t('manage:applicants.notePlaceholder')}
            rows={2}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex gap-2">
            <Button loading={busy} onClick={() => onDecide('accept', note.trim())}>
              {t('manage:applicants.accept')}
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => onDecide('reject', note.trim())}
            >
              {t('manage:applicants.reject')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function OrgApplicants(): React.JSX.Element {
  const { activityId = '' } = useParams()
  const { t, i18n } = useTranslation(['manage', 'activities'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [activity, setActivity] = useState<Activity | null>(null)
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyUid, setBusyUid] = useState<string | null>(null)

  useEffect(() => {
    if (!activityId) return
    void fetchActivity(activityId)
      .then(setActivity)
      .catch(() => setActivity(null))
  }, [activityId])

  useEffect(() => {
    if (!activityId) return
    return watchApplicants(
      activityId,
      (rows) => {
        setApplications(rows)
        setError(null)
      },
      (caught) => {
        console.error('[org] Başvuranlar okunamadı:', caught)
        setError(t('manage:applicants.loadFailed'))
        setApplications([])
      },
    )
  }, [activityId, t])

  const counts = useMemo(() => {
    const rows = applications ?? []
    return {
      applied: rows.filter((row) => row.status === 'applied').length,
      accepted: rows.filter((row) => row.status === 'accepted').length,
      rejected: rows.filter((row) => row.status === 'rejected').length,
    }
  }, [applications])

  async function decide(
    applicantUid: string,
    decision: 'accept' | 'reject',
    note: string,
  ): Promise<void> {
    if (!user) return
    setBusyUid(applicantUid)
    setError(null)
    try {
      await decideApplication(activityId, applicantUid, decision, user.uid, note)
      setNotice(
        decision === 'accept'
          ? t('manage:applicants.accepted')
          : t('manage:applicants.rejected'),
      )
    } catch (caught) {
      console.error('[org] Karar kaydedilemedi:', caught)
      setError(t('manage:applicants.actionFailed'))
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/org" className="text-sm underline">
        ← {t('manage:org.title')}
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{t('manage:applicants.title')}</h1>
        {activity && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('manage:applicants.forActivity', {
              title: pickText(activity.title, locale),
            })}
          </p>
        )}
      </header>

      {applications !== null && applications.length > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('manage:applicants.counts', counts)}
        </p>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {applications === null && (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      )}

      {applications !== null && applications.length === 0 && (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('manage:applicants.empty')}
        </Card>
      )}

      {applications !== null && applications.length > 0 && (
        <Card className="p-0">
          <ul className="px-5">
            {applications.map((application) => (
              <ApplicantRow
                key={application.uid}
                application={application}
                busy={busyUid === application.uid}
                onDecide={(decision, note) =>
                  void decide(application.uid, decision, note)
                }
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
