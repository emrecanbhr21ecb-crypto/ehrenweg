/**
 * Kurum ekranı — geç/çevrimdışı taramalar, gelmeyenler, katılım nachträge.
 *
 * CLAUDE.md Bölüm 12: `approveLateScans` (item 4), `markNoShows` (item 7),
 * Bölüm 2 onay akışı: `pendingClaims` → kurum onayı → pasaporta
 * `source: 'admin'` (item 8).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Alert, Badge, Button, Card, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { fetchActivity } from '@/lib/activities'
import { watchApplicants } from '@/lib/applications'
import {
  approveRecords,
  approveRecord,
  rejectRecord,
  watchActivityRecords,
} from '@/lib/attendance'
import { reviewClaim, watchOrgClaims } from '@/lib/claims'
import { awardClaim, loadScoringConfig, markNoShow } from '@/lib/passport'
import { formatDateTime } from '@/lib/format'
import type { AttendanceRecord, PendingClaim } from '@/types/attendance'
import type { Activity, Application } from '@/types/activity'
import type { Locale } from '@/config/brand'

export default function LateScans(): React.JSX.Element {
  const { activityId = '' } = useParams()
  const { t, i18n } = useTranslation(['attendance', 'manage'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [activity, setActivity] = useState<Activity | null | undefined>(undefined)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [applicants, setApplicants] = useState<Application[]>([])
  const [claims, setClaims] = useState<PendingClaim[]>([])

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [penaltyIp, setPenaltyIp] = useState(5)

  useEffect(() => {
    void loadScoringConfig().then((config) => setPenaltyIp(config.penalties.noShowIp))
  }, [])

  useEffect(() => {
    if (!activityId) return
    void fetchActivity(activityId)
      .then(setActivity)
      .catch(() => setActivity(null))
  }, [activityId])

  useEffect(() => {
    if (!activityId) return
    return watchActivityRecords(activityId, setRecords, (caught) =>
      console.error('[late] Kayıtlar okunamadı:', caught),
    )
  }, [activityId])

  useEffect(() => {
    if (!activityId) return
    return watchApplicants(activityId, setApplicants, (caught) =>
      console.error('[late] Başvuranlar okunamadı:', caught),
    )
  }, [activityId])

  useEffect(() => {
    if (!activity?.orgId) return
    return watchOrgClaims(activity.orgId, setClaims, (caught) =>
      console.error('[late] Nachträge okunamadı:', caught),
    )
  }, [activity?.orgId])

  const pending = useMemo(
    () => records.filter((record) => record.status === 'pending_review'),
    [records],
  )

  /**
   * Kabul edilip gelmeyenler: kabul edilmiş başvurusu olan ama onaylı yoklama
   * kaydı olmayan kişiler. Aktivite bitmeden listelenmez — henüz gelebilirler.
   */
  const noShows = useMemo(() => {
    if (!activity) return []
    if (activity.endAt.toDate().getTime() > Date.now()) return []

    const attended = new Set(
      records.filter((record) => record.status === 'confirmed').map((r) => r.uid),
    )
    return applicants.filter(
      (application) =>
        application.status === 'accepted' && !attended.has(application.uid),
    )
  }, [activity, records, applicants])

  const activityClaims = useMemo(
    () => claims.filter((claim) => claim.activityId === activityId),
    [claims, activityId],
  )

  async function run(action: () => Promise<void>, message: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
      setNotice(message)
    } catch (caught) {
      console.error('[late] İşlem başarısız:', caught)
      setError(t('manage:activities.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function markAllNoShows(): Promise<void> {
    if (!window.confirm(t('attendance:noShow.confirm'))) return
    await run(
      async () => {
        for (const application of noShows) {
          await markNoShow(application.uid, activityId, penaltyIp)
        }
      },
      t('attendance:noShow.done', { count: noShows.length }),
    )
  }

  async function decideClaim(
    claim: PendingClaim,
    decision: 'approve' | 'reject',
  ): Promise<void> {
    if (!user || !activity) return
    await run(async () => {
      await reviewClaim(claim.id, decision, user.uid)
      if (decision === 'approve') {
        await awardClaim(
          { uid: claim.uid, activityId: claim.activityId },
          activity,
          user.uid,
        )
      }
    }, t('attendance:claim.reviewDone'))
  }

  if (activity === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  if (activity === null) {
    return <Alert tone="error">{t('attendance:scanError.activityMissing')}</Alert>
  }

  return (
    <div className="space-y-5">
      <Link
        to={`/org/activities/${activityId}/attendance`}
        className="text-sm underline"
      >
        ← {t('attendance:session.title')}
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{t('attendance:review.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {activity.title.de || activity.title.en}
        </p>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* item 4 — geç / çevrimdışı taramalar */}
      <section className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('attendance:review.hint')}
        </p>

        {pending.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:review.empty')}
          </Card>
        ) : (
          <>
            <Button
              loading={busy}
              onClick={() =>
                void run(
                  () => approveRecords(pending.map((record) => record.id)),
                  t('attendance:review.approved'),
                )
              }
            >
              {t('attendance:review.approveAll')} ({pending.length})
            </Button>

            <Card className="p-0">
              <ul className="px-5">
                {pending.map((record) => (
                  <li
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{record.displayName}</p>
                      <p className="text-xs text-gray-500">
                        {t(`attendance:review.method.${record.method}`)}
                        {record.scannedAt &&
                          ` · ${formatDateTime(record.scannedAt.toDate(), locale)}`}
                      </p>
                      {record.geoOk !== null && (
                        <Badge tone={record.geoOk ? 'success' : 'warning'}>
                          {record.geoOk
                            ? t('attendance:review.geoOk')
                            : t('attendance:review.geoBad')}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        loading={busy}
                        onClick={() =>
                          void run(
                            () => approveRecord(record.id),
                            t('attendance:review.approved'),
                          )
                        }
                      >
                        {t('attendance:review.approve')}
                      </Button>
                      <Button
                        variant="ghost"
                        loading={busy}
                        onClick={() =>
                          void run(
                            () => rejectRecord(record.id),
                            t('attendance:review.rejected'),
                          )
                        }
                      >
                        {t('attendance:review.reject')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </section>

      {/* item 8 — "katıldım ama yoklama alınmadı" iddiaları */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('attendance:claim.reviewTitle')}</h2>

        {activityClaims.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:claim.reviewEmpty')}
          </Card>
        ) : (
          activityClaims.map((claim) => (
            <Card key={claim.id} className="space-y-3">
              <p className="text-sm font-medium">{claim.displayName}</p>
              {claim.note && <p className="text-sm">{claim.note}</p>}
              {claim.photoDataUrl && (
                <img
                  src={claim.photoDataUrl}
                  alt=""
                  className="max-h-64 w-full rounded-xl object-contain"
                />
              )}
              <div className="flex gap-2">
                <Button
                  loading={busy}
                  onClick={() => void decideClaim(claim, 'approve')}
                >
                  {t('attendance:claim.reviewApprove')}
                </Button>
                <Button
                  variant="ghost"
                  loading={busy}
                  onClick={() => void decideClaim(claim, 'reject')}
                >
                  {t('attendance:claim.reviewReject')}
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* item 7 — gelmeyenler */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('attendance:noShow.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('attendance:noShow.hint', { ip: penaltyIp })}
        </p>

        {noShows.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:noShow.empty')}
          </Card>
        ) : (
          <>
            <Card className="p-0">
              <ul className="px-5">
                {noShows.map((application) => (
                  <li
                    key={application.uid}
                    className="flex items-center justify-between gap-2 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                  >
                    <p className="text-sm">{application.applicantName}</p>
                    <Button
                      variant="ghost"
                      loading={busy}
                      onClick={() =>
                        void run(
                          () => markNoShow(application.uid, activityId, penaltyIp),
                          t('attendance:noShow.done', { count: 1 }),
                        )
                      }
                    >
                      {t('attendance:noShow.mark')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>

            <Button
              variant="danger"
              loading={busy}
              onClick={() => void markAllNoShows()}
            >
              {t('attendance:noShow.markAll')} ({noShows.length})
            </Button>
          </>
        )}
      </section>
    </div>
  )
}
