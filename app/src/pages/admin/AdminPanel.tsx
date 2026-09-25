/**
 * Platform yönetimi (CLAUDE.md Bölüm 9):
 *   - kurum doğrulama kuyruğu (Bölüm 4: resmi belge / e-posta alan adı kontrolü)
 *   - içerik moderasyonu: `pending_review` aktiviteleri onayla / gerekçeyle reddet
 *
 * Trainer başvuruları, rol yönetimi, şüpheli işlem panosu ve audit log
 * sonraki fazların işi; sekme yapısı onlara yer bırakacak şekilde kuruldu.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ActivityCard } from '@/components/ActivityCard'
import { Alert, Badge, Button, Card, Spinner, TextArea } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { reviewActivity, watchPendingActivities } from '@/lib/activities'
import { reviewOrganization, watchPendingOrganizations } from '@/lib/organizations'
import type { Activity, Organization } from '@/types/activity'

type Tab = 'organisations' | 'activities'

/** Gerekçeli reddetme kutusu — onay/red her iki kuyrukta da aynı şekilde çalışır. */
function ReviewBox({
  onApprove,
  onReject,
  busy,
  confirmApprove,
}: {
  onApprove: () => void
  onReject: (note: string) => void
  busy: boolean
  confirmApprove?: string
}): React.JSX.Element {
  const { t } = useTranslation('manage')
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          loading={busy}
          onClick={() => {
            if (confirmApprove && !window.confirm(confirmApprove)) return
            onApprove()
          }}
        >
          ✓ {t('admin.approve')}
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => setRejecting((value) => !value)}
        >
          {t('admin.reject')}
        </Button>
      </div>

      {rejecting && (
        <div className="space-y-2">
          <TextArea
            label={t('admin.rejectNote')}
            hint={t('admin.rejectNoteHint')}
            rows={3}
            maxLength={500}
            value={note}
            error={noteError ?? undefined}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            variant="danger"
            loading={busy}
            onClick={() => {
              // Gerekçesiz red, karşı tarafa hiçbir şey öğretmez.
              if (!note.trim()) {
                setNoteError(t('admin.rejectNoteRequired'))
                return
              }
              setNoteError(null)
              onReject(note.trim())
            }}
          >
            {t('admin.reject')}
          </Button>
        </div>
      )}
    </div>
  )
}

function OrganisationQueue(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const { user } = useAuth()

  const [rows, setRows] = useState<Organization[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    return watchPendingOrganizations(
      (next) => {
        setRows(next)
        setError(null)
      },
      (caught) => {
        console.error('[admin] Kurum kuyruğu okunamadı:', caught)
        setError(t('admin.loadFailed'))
        setRows([])
      },
    )
  }, [t])

  async function decide(
    organization: Organization,
    decision: 'approve' | 'reject',
    note = '',
  ): Promise<void> {
    if (!user) return
    setBusyId(organization.id)
    setError(null)
    try {
      await reviewOrganization(organization.id, decision, user.uid, note)
      setNotice(decision === 'approve' ? t('admin.approved') : t('admin.rejected'))
    } catch (caught) {
      console.error('[admin] Kurum kararı kaydedilemedi:', caught)
      setError(t('admin.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (rows === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {rows.length === 0 && (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('admin.orgQueueEmpty')}
        </Card>
      )}

      {rows.map((organization) => {
        const domain = organization.contactEmail.split('@')[1] ?? '—'
        return (
          <Card key={organization.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{organization.name}</h3>
              <Badge tone="neutral">{t(`types.${organization.type}`)}</Badge>
              <Badge tone="warning">{organization.city}</Badge>
            </div>

            {organization.description.de && (
              <p className="text-sm">{organization.description.de}</p>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.appliedBy', { email: organization.contactEmail })}
            </p>

            {/* Bölüm 4: "resmi belge/e-posta alan adı kontrolüyle onaylar" */}
            <p className="text-sm font-medium">{t('admin.checkDomain', { domain })}</p>

            {organization.website && (
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-block text-sm underline"
              >
                {t('admin.openWebsite')} ↗
              </a>
            )}

            <ReviewBox
              busy={busyId === organization.id}
              confirmApprove={t('admin.confirmApproveOrg')}
              onApprove={() => void decide(organization, 'approve')}
              onReject={(note) => void decide(organization, 'reject', note)}
            />
          </Card>
        )
      })}
    </div>
  )
}

function ActivityQueue(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const { user } = useAuth()

  const [rows, setRows] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    return watchPendingActivities(
      (next) => {
        setRows(next)
        setError(null)
      },
      (caught) => {
        console.error('[admin] İçerik kuyruğu okunamadı:', caught)
        setError(t('admin.loadFailed'))
        setRows([])
      },
    )
  }, [t])

  async function decide(
    activity: Activity,
    decision: 'approve' | 'reject',
    note = '',
  ): Promise<void> {
    if (!user) return
    setBusyId(activity.id)
    setError(null)
    try {
      await reviewActivity(activity.id, decision, user.uid, note)
      setNotice(decision === 'approve' ? t('admin.approved') : t('admin.rejected'))
    } catch (caught) {
      console.error('[admin] İçerik kararı kaydedilemedi:', caught)
      setError(t('admin.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (rows === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {rows.length === 0 && (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('admin.activityQueueEmpty')}
        </Card>
      )}

      {rows.map((activity) => (
        <div key={activity.id} className="space-y-2">
          <ActivityCard
            activity={activity}
            showStatus
            footer={
              <Link to={`/activities/${activity.id}`}>
                <Button variant="secondary">{t('admin.preview')}</Button>
              </Link>
            }
          />
          <Card>
            <ReviewBox
              busy={busyId === activity.id}
              onApprove={() => void decide(activity, 'approve')}
              onReject={(note) => void decide(activity, 'reject', note)}
            />
          </Card>
        </div>
      ))}
    </div>
  )
}

export default function AdminPanel(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const [tab, setTab] = useState<Tab>('organisations')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'organisations', label: t('admin.tabOrganisations') },
    { id: 'activities', label: t('admin.tabActivities') },
  ]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('admin.subtitle')}
        </p>
      </header>

      <nav className="flex gap-1 border-b border-gray-200 dark:border-ink-800">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={tab === entry.id ? 'page' : undefined}
            onClick={() => setTab(entry.id)}
            className={[
              'min-h-11 px-4 text-sm font-medium border-b-2',
              tab === entry.id
                ? 'border-primary-700 text-primary-800 dark:text-primary-200'
                : 'border-transparent text-gray-500 dark:text-gray-400',
            ].join(' ')}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'organisations' ? <OrganisationQueue /> : <ActivityQueue />}
    </div>
  )
}
