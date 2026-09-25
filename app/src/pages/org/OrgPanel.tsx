/**
 * Kurum paneli — CLAUDE.md Bölüm 9.
 *
 * Üç sekme: Aktiviteler (taslak → onaya gönder → yayında), Team (üye ekle /
 * çıkar, rol ver), Profil (kurum bilgileri, doğrulama durumu).
 *
 * Kullanıcı birden fazla kurumda olabilir; üstteki seçici hangi kurum adına
 * çalışıldığını belirler ve adres çubuğuna `?org=` olarak yazılır — böylece
 * bağlantı paylaşılabilir ve yenilemede seçim kaybolmaz.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { ActivityCard } from '@/components/ActivityCard'
import { OrgReconciliation } from '@/pages/org/Reconciliation'
import { OrgRedeem } from '@/pages/org/Redeem'
import { OrgRewards } from '@/pages/org/Rewards'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SelectField,
  Spinner,
  TextField,
  VerifiedBadge,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import {
  cancelActivity,
  deleteActivityDraft,
  submitActivity,
  watchOrgActivities,
  withdrawFromReview,
} from '@/lib/activities'
import {
  removeOrgMember,
  setOrgMember,
  watchOrgMembers,
  watchOrganization,
} from '@/lib/organizations'
import {
  ORG_ROLES,
  canManageActivities,
  type Activity,
  type OrgMember,
  type OrgRole,
  type Organization,
} from '@/types/activity'

type Tab = 'activities' | 'members' | 'rewards' | 'redeem' | 'report' | 'profile'

// ---------------------------------------------------------------------------

function ActivitiesTab({
  orgId,
  canPublish,
}: {
  orgId: string
  canPublish: boolean
}): React.JSX.Element {
  const { t } = useTranslation(['manage', 'common', 'attendance'])
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    return watchOrgActivities(
      orgId,
      (rows) => {
        setActivities(rows)
        setError(null)
      },
      (caught) => {
        console.error('[org] Aktiviteler okunamadı:', caught)
        setError(t('manage:org.loadFailed'))
        setActivities([])
      },
    )
  }, [orgId, t])

  async function run(
    id: string,
    action: () => Promise<void>,
    successKey: string,
  ): Promise<void> {
    setBusyId(id)
    setError(null)
    try {
      await action()
      setNotice(successKey)
    } catch (caught) {
      console.error('[org] İşlem başarısız:', caught)
      setError(t('manage:activities.actionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('manage:activities.title')}</h2>
        <Link to={`/org/activities/new?org=${orgId}`}>
          <Button>➕ {t('manage:activities.new')}</Button>
        </Link>
      </div>

      {!canPublish && (
        <Alert tone="warning">{t('manage:activities.needsVerification')}</Alert>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {activities === null && (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      )}

      {activities !== null && activities.length === 0 && (
        <EmptyState
          emoji="📋"
          title={t('manage:activities.empty')}
          body={t('manage:activities.emptyAction')}
          action={
            <Link to={`/org/activities/new?org=${orgId}`}>
              <Button>{t('manage:activities.new')}</Button>
            </Link>
          }
        />
      )}

      {activities !== null && activities.length > 0 && (
        <ul className="space-y-4">
          {activities.map((activity) => (
            <li key={activity.id}>
              <ActivityCard
                activity={activity}
                showStatus
                to={`/activities/${activity.id}`}
                footer={
                  <>
                    <Link to={`/org/activities/${activity.id}/edit`}>
                      <Button variant="secondary">{t('manage:activities.edit')}</Button>
                    </Link>

                    <Link to={`/org/activities/${activity.id}/applicants`}>
                      <Button variant="secondary">
                        {t('manage:activities.openApplicants')} (
                        {activity.stats.applicants})
                      </Button>
                    </Link>

                    {/* Yoklama yalnız YAYINDAKİ aktivitede açılır: taslakta
                        kimse yok, iptal edilende olmamalı. */}
                    {activity.status === 'published' && (
                      <Link to={`/org/activities/${activity.id}/attendance`}>
                        <Button>⛶ {t('attendance:session.title')}</Button>
                      </Link>
                    )}

                    {activity.status === 'draft' && (
                      <Button
                        loading={busyId === activity.id}
                        onClick={() =>
                          void run(
                            activity.id,
                            () => submitActivity(activity.id),
                            t('manage:activities.submitted'),
                          )
                        }
                      >
                        {t('manage:activities.submit')}
                      </Button>
                    )}

                    {activity.status === 'pending_review' && (
                      <Button
                        variant="secondary"
                        loading={busyId === activity.id}
                        onClick={() =>
                          void run(
                            activity.id,
                            () => withdrawFromReview(activity.id),
                            t('manage:activities.withdrawn'),
                          )
                        }
                      >
                        {t('manage:activities.withdraw')}
                      </Button>
                    )}

                    {activity.status === 'published' && (
                      <Button
                        variant="danger"
                        loading={busyId === activity.id}
                        onClick={() => {
                          if (!window.confirm(t('manage:activities.cancelConfirm')))
                            return
                          void run(
                            activity.id,
                            () => cancelActivity(activity.id),
                            t('manage:activities.cancelled'),
                          )
                        }}
                      >
                        {t('manage:activities.cancelActivity')}
                      </Button>
                    )}

                    {activity.status === 'draft' && (
                      <Button
                        variant="ghost"
                        loading={busyId === activity.id}
                        onClick={() => {
                          if (!window.confirm(t('manage:activities.deleteConfirm')))
                            return
                          void run(
                            activity.id,
                            () => deleteActivityDraft(activity.id),
                            t('manage:activities.deleted'),
                          )
                        }}
                      >
                        {t('manage:activities.deleteDraft')}
                      </Button>
                    )}
                  </>
                }
              />

              {activity.reviewNote && activity.status === 'draft' && (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                  {t('manage:activities.reviewNote', { note: activity.reviewNote })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function MembersTab({
  orgId,
  isOrgAdmin,
}: {
  orgId: string
  isOrgAdmin: boolean
}): React.JSX.Element {
  const { t } = useTranslation(['manage', 'errors'])
  const { user } = useAuth()

  const [members, setMembers] = useState<OrgMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [uid, setUid] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('org_staff')

  useEffect(() => {
    return watchOrgMembers(
      orgId,
      (rows) => {
        setMembers(rows)
        setError(null)
      },
      (caught) => {
        console.error('[org] Üyeler okunamadı:', caught)
        setError(t('manage:members.loadFailed'))
        setMembers([])
      },
    )
  }, [orgId, t])

  const adminCount = (members ?? []).filter(
    (member) => member.role === 'org_admin',
  ).length

  async function add(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!user) return
    if (!uid.trim()) {
      setError(t('validation.uidRequired', { ns: 'errors' }))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await setOrgMember(
        orgId,
        { uid: uid.trim(), role, displayName: displayName.trim(), email: email.trim() },
        user.uid,
      )
      setUid('')
      setDisplayName('')
      setEmail('')
      setNotice(t('manage:members.added'))
    } catch (caught) {
      console.error('[org] Üye eklenemedi:', caught)
      setError(t('manage:members.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(member: OrgMember): Promise<void> {
    if (member.role === 'org_admin' && adminCount <= 1) {
      setError(t('manage:members.lastAdminWarning'))
      return
    }
    if (!window.confirm(t('manage:members.removeConfirm'))) return

    setBusy(true)
    setError(null)
    try {
      await removeOrgMember(orgId, member.uid)
      setNotice(t('manage:members.removed'))
    } catch (caught) {
      console.error('[org] Üye çıkarılamadı:', caught)
      setError(t('manage:members.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('manage:members.title')}</h2>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {!isOrgAdmin && <Alert tone="info">{t('manage:members.onlyAdmin')}</Alert>}

      {members === null ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-6 text-primary-700" />
        </div>
      ) : members.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('manage:members.empty')}
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="px-5">
            {members.map((member) => (
              <li
                key={member.uid}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {member.displayName || member.uid}
                    {member.uid === user?.uid && (
                      <span className="ms-2 text-xs text-gray-500">
                        ({t('manage:members.you')})
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {member.email}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={member.role === 'org_admin' ? 'success' : 'neutral'}>
                    {t(`manage:roles.${member.role}`)}
                  </Badge>
                  {isOrgAdmin && (
                    <Button
                      variant="ghost"
                      loading={busy}
                      onClick={() => void remove(member)}
                    >
                      {t('manage:members.remove')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOrgAdmin && (
        <Card>
          <form className="space-y-4" onSubmit={(event) => void add(event)} noValidate>
            <h3 className="text-base font-semibold">{t('manage:members.addTitle')}</h3>

            <TextField
              label={t('manage:members.uid')}
              hint={t('manage:members.uidHint')}
              value={uid}
              onChange={(event) => setUid(event.target.value)}
            />
            <TextField
              label={t('manage:members.displayName')}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <TextField
              label={t('manage:members.email')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <SelectField
              label={t('manage:members.role')}
              value={role}
              onChange={(event) => setRole(event.target.value as OrgRole)}
            >
              {ORG_ROLES.map((value) => (
                <option key={value} value={value}>
                  {t(`manage:roles.${value}`)}
                </option>
              ))}
            </SelectField>

            <Button type="submit" loading={busy}>
              {t('manage:members.add')}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProfileTab({
  organization,
}: {
  organization: Organization
}): React.JSX.Element {
  const { t, i18n } = useTranslation(['manage', 'catalog'])
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'de'

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{organization.name}</h2>
          {organization.verified ? (
            <VerifiedBadge label={t('manage:org.verified')} />
          ) : (
            <Badge tone="warning">{t('manage:org.unverified')}</Badge>
          )}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t(`manage:types.${organization.type}`)} · {organization.city}
        </p>

        {organization.description[locale] && (
          <p className="text-sm">{organization.description[locale]}</p>
        )}

        {organization.website && (
          <a
            href={organization.website}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm underline"
          >
            {organization.website}
          </a>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold">{t('manage:org.myUid')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('manage:org.myUidHint')}
        </p>
        <code className="block overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs dark:bg-ink-800">
          {user?.uid}
        </code>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              .writeText(user?.uid ?? '')
              .then(() => setCopied(true))
          }}
        >
          {copied ? t('manage:org.uidCopied') : t('manage:org.copyUid')}
        </Button>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function OrgPanel(): React.JSX.Element {
  const { t } = useTranslation(['manage', 'common', 'wallet'])
  const { orgRoles, memberships } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('activities')

  const orgIds = useMemo(() => Object.keys(orgRoles), [orgRoles])
  const activeOrgId = searchParams.get('org') ?? orgIds[0] ?? ''

  const [organization, setOrganization] = useState<Organization | null | undefined>(
    undefined,
  )

  useEffect(() => {
    if (!activeOrgId) {
      setOrganization(null)
      return
    }
    return watchOrganization(activeOrgId, setOrganization, (caught) => {
      console.error('[org] Kurum okunamadı:', caught)
      setOrganization(null)
    })
  }, [activeOrgId])

  // Hiçbir kuruma bağlı değil → başvuru daveti.
  if (orgIds.length === 0) {
    return (
      <EmptyState
        emoji="🏛️"
        title={t('manage:org.noOrgTitle')}
        body={t('manage:org.noOrgBody')}
        action={
          <Link to="/org/apply">
            <Button>{t('manage:org.noOrgAction')}</Button>
          </Link>
        }
      />
    )
  }

  if (organization === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  if (organization === null) {
    return <Alert tone="error">{t('manage:org.loadFailed')}</Alert>
  }

  const role = orgRoles[activeOrgId]
  const isOrgAdmin = role === 'org_admin'
  const canManage = canManageActivities(role)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'activities', label: t('manage:org.tabActivities') },
    { id: 'members', label: t('manage:org.tabMembers') },
    { id: 'rewards', label: t('wallet:org.tabRewards') },
    { id: 'redeem', label: t('wallet:org.tabRedeem') },
    { id: 'report', label: t('wallet:org.tabReport') },
    { id: 'profile', label: t('manage:org.tabProfile') },
  ]

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">{t('manage:org.title')}</h1>

        {orgIds.length > 1 && (
          <SelectField
            label={t('manage:org.switchLabel')}
            value={activeOrgId}
            onChange={(event) => setSearchParams({ org: event.target.value })}
          >
            {orgIds.map((id) => (
              <option key={id} value={id}>
                {memberships.find((member) => member.orgId === id)?.orgId === id
                  ? id === organization.id
                    ? organization.name
                    : id
                  : id}
              </option>
            ))}
          </SelectField>
        )}
      </header>

      {organization.status === 'pending' && (
        <Alert tone="warning">
          <strong className="block">{t('manage:org.pendingTitle')}</strong>
          {t('manage:org.pendingBody')}
        </Alert>
      )}

      {organization.status === 'rejected' && (
        <Alert tone="error">
          <strong className="block">{t('manage:org.rejectedTitle')}</strong>
          {organization.reviewNote
            ? t('manage:org.rejectedBody', { note: organization.reviewNote })
            : t('manage:org.rejectedNoNote')}
        </Alert>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-ink-800">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={tab === entry.id ? 'page' : undefined}
            onClick={() => setTab(entry.id)}
            className={[
              'min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium',
              tab === entry.id
                ? 'border-primary-700 text-primary-800 dark:text-primary-200'
                : 'border-transparent text-gray-500 dark:text-gray-400',
            ].join(' ')}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'activities' &&
        (canManage ? (
          <ActivitiesTab orgId={activeOrgId} canPublish={organization.verified} />
        ) : (
          <Alert tone="info">{t('manage:members.onlyAdmin')}</Alert>
        ))}

      {tab === 'members' && <MembersTab orgId={activeOrgId} isOrgAdmin={isOrgAdmin} />}

      {/* Ödül şablonları ve bütçe yalnız kurum yöneticisinde: para
          tanımlamak personel yetkisi değil (CLAUDE.md Bölüm 7.1). */}
      {tab === 'rewards' &&
        (isOrgAdmin ? (
          <OrgRewards organization={organization} />
        ) : (
          <Alert tone="info">{t('manage:members.onlyAdmin')}</Alert>
        ))}

      {/* Kasa: vezne görevlisi ve partner de girebilir. */}
      {tab === 'redeem' && <OrgRedeem orgId={activeOrgId} />}

      {tab === 'report' &&
        (isOrgAdmin ? (
          <OrgReconciliation organization={organization} />
        ) : (
          <Alert tone="info">{t('manage:members.onlyAdmin')}</Alert>
        ))}

      {tab === 'profile' && <ProfileTab organization={organization} />}
    </div>
  )
}
