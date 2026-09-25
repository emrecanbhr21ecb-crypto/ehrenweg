/**
 * Kurum paneli — duyurular (CLAUDE.md Bölüm 9, Bölüm 12 `sendAnnouncement`).
 *
 * Duyuru yazılıp yayınlanıyor ve uygulamada anında görünüyor. **Push
 * gönderimi sunucuya bağlı** (Blaze kapalı); arayüz bunu her duyurunun
 * yanında dürüstçe gösteriyor — "gönderildi" sanıp beklemek olmasın.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  Badge,
  Button,
  Card,
  Switch,
  TextArea,
  TextField,
} from '@/components/ui'
import { CLOUD_FUNCTIONS_ENABLED } from '@/lib/backend'
import { useAuth } from '@/lib/AuthProvider'
import {
  createAnnouncement,
  deleteAnnouncement,
  watchOrgAnnouncements,
} from '@/lib/announcements'
import { formatDate } from '@/lib/format'
import {
  pickText,
  type ActivityValidationKey,
  type Organization,
} from '@/types/activity'
import {
  announcementSchema,
  type Announcement,
  type AnnouncementForm,
} from '@/types/announcement'
import type { Locale } from '@/config/brand'

function emptyForm(): AnnouncementForm {
  return {
    titleDe: '',
    titleEn: '',
    bodyDe: '',
    bodyEn: '',
    pinned: true,
    linkActivityId: '',
    imageURL: '',
    lifetimeDays: 30,
  }
}

export function OrgAnnouncements({
  organization,
}: {
  organization: Organization
}): React.JSX.Element {
  const { t, i18n } = useTranslation(['notify', 'errors'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [items, setItems] = useState<Announcement[]>([])
  const [form, setForm] = useState<AnnouncementForm>(emptyForm)
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return watchOrgAnnouncements(organization.id, setItems, (caught) =>
      console.error('[announce] Okunamadı:', caught),
    )
  }, [organization.id])

  function patch(part: Partial<AnnouncementForm>): void {
    setForm((current) => ({ ...current, ...part }))
  }

  async function publish(): Promise<void> {
    if (!user) return
    const parsed = announcementSchema.safeParse(form)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !next[field]) {
          next[field] = t(issue.message as ActivityValidationKey, { ns: 'errors' })
        }
      }
      setErrors(next)
      return
    }

    setErrors({})
    setBusy(true)
    setError(null)
    try {
      await createAnnouncement(parsed.data, {
        orgId: organization.id,
        orgName: organization.name,
        uid: user.uid,
      })
      setForm(emptyForm())
      setOpen(false)
      setNotice(t('notify:announce.published'))
    } catch (caught) {
      console.error('[announce] Yayınlanamadı:', caught)
      setError(t('notify:announce.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('notify:announce.title')}</h2>
        <Button onClick={() => setOpen(!open)}>➕ {t('notify:announce.new')}</Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!CLOUD_FUNCTIONS_ENABLED && (
        <Alert tone="info">{t('notify:announce.pushUnavailable')}</Alert>
      )}

      {open && (
        <Card className="space-y-4">
          <TextField
            label={t('notify:announce.titleDe')}
            value={form.titleDe}
            error={errors['titleDe']}
            onChange={(event) => patch({ titleDe: event.target.value })}
          />
          <TextField
            label={t('notify:announce.titleEn')}
            value={form.titleEn}
            onChange={(event) => patch({ titleEn: event.target.value })}
          />
          <TextArea
            label={t('notify:announce.bodyDe')}
            rows={3}
            value={form.bodyDe}
            error={errors['bodyDe']}
            onChange={(event) => patch({ bodyDe: event.target.value })}
          />
          <TextArea
            label={t('notify:announce.bodyEn')}
            rows={3}
            value={form.bodyEn}
            onChange={(event) => patch({ bodyEn: event.target.value })}
          />
          <TextField
            label={t('notify:announce.linkActivity')}
            hint={t('notify:announce.linkHint')}
            value={form.linkActivityId}
            onChange={(event) => patch({ linkActivityId: event.target.value })}
          />
          <TextField
            label={t('notify:announce.imageURL')}
            type="url"
            placeholder="https://"
            value={form.imageURL}
            error={errors['imageURL']}
            onChange={(event) => patch({ imageURL: event.target.value })}
          />
          <TextField
            label={t('notify:announce.lifetime')}
            type="number"
            min={1}
            max={365}
            value={form.lifetimeDays}
            onChange={(event) => patch({ lifetimeDays: Number(event.target.value) })}
          />
          <Switch
            checked={form.pinned}
            onChange={(next) => patch({ pinned: next })}
            label={t('notify:announce.pinned')}
          />

          <Button loading={busy} onClick={() => void publish()}>
            {t('notify:announce.publish')}
          </Button>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('notify:announce.empty')}
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{pickText(item.title, locale)}</p>
                  <Badge tone={item.pushSent ? 'success' : 'neutral'}>
                    {item.pushSent
                      ? t('notify:announce.pushSent')
                      : t('notify:announce.pushPending')}
                  </Badge>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {pickText(item.body, locale)}
                </p>

                {item.createdAt && (
                  <p className="text-xs text-gray-500">
                    {formatDate(item.createdAt.toDate(), locale)}
                  </p>
                )}

                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(t('notify:announce.deleteConfirm'))) return
                    void deleteAnnouncement(item.id).then(() =>
                      setNotice(t('notify:announce.deleted')),
                    )
                  }}
                >
                  {t('notify:announce.delete')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
