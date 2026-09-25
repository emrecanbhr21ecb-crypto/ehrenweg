/**
 * "Katıldım ama yoklama alınmadı" — katılımcı tarafı (item 8).
 *
 * CLAUDE.md Bölüm 2 onay akışı: fotoğraflı `pendingClaims` → kurum onayı →
 * pasaporta `source: 'admin'`.
 *
 * Yalnız aktivite BİTTİKTEN sonra ve kişinin onaylı yoklama kaydı yokken
 * görünür — yoksa herkesin "ben de vardım" diyebileceği bir kapı olurdu.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Badge, Button, Card, TextArea } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { compressPhoto, fetchMyClaim, submitClaim } from '@/lib/claims'
import type { Activity } from '@/types/activity'
import type { PendingClaim } from '@/types/attendance'

export function AttendanceClaim({
  activity,
}: {
  activity: Activity
}): React.JSX.Element | null {
  const { t } = useTranslation('attendance')
  const { user, profile } = useAuth()

  const [claim, setClaim] = useState<PendingClaim | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    void fetchMyClaim(activity.id, user.uid)
      .then(setClaim)
      .catch(() => setClaim(null))
  }, [activity.id, user])

  // Aktivite henüz bitmediyse nachtrag yok.
  if (activity.endAt.toDate().getTime() > Date.now()) return null
  if (claim === undefined) return null

  if (claim) {
    return (
      <Card className="space-y-2">
        <h2 className="text-base font-semibold">{t('claim.title')}</h2>
        <Badge
          tone={
            claim.status === 'approved'
              ? 'success'
              : claim.status === 'rejected'
                ? 'danger'
                : 'info'
          }
        >
          {t(`claim.${claim.status}`)}
        </Badge>
        {claim.reviewNote && <p className="text-sm">{claim.reviewNote}</p>}
      </Card>
    )
  }

  if (done) {
    return <Alert tone="success">{t('claim.submitted')}</Alert>
  }

  async function pickPhoto(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      setPhoto(await compressPhoto(file))
    } catch (caught) {
      console.error('[claim] Fotoğraf işlenemedi:', caught)
      setError(t('claim.photoTooBig'))
    }
  }

  async function send(): Promise<void> {
    if (!user || !profile) return
    if (!photo) {
      setError(t('claim.photoMissing'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await submitClaim({
        uid: user.uid,
        displayName: profile.displayName,
        activityId: activity.id,
        orgId: activity.orgId,
        activityTitle: activity.title.de || activity.title.en,
        note: note.trim(),
        photoDataUrl: photo,
      })
      setDone(true)
    } catch (caught) {
      console.error('[claim] Gönderilemedi:', caught)
      setError(t('claim.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" full onClick={() => setOpen(true)}>
        {t('claim.open')}
      </Button>
    )
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold">{t('claim.title')}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('claim.hint')}</p>

      {error && <Alert tone="error">{error}</Alert>}

      <TextArea
        label={t('claim.note')}
        placeholder={t('claim.notePlaceholder')}
        rows={3}
        maxLength={400}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="space-y-1.5">
        <label htmlFor="claim-photo" className="block text-sm font-medium">
          {t('claim.photo')}
        </label>
        <input
          id="claim-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => void pickPhoto(event)}
          className="block w-full text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('claim.photoHint')}
        </p>
      </div>

      {photo && (
        <img src={photo} alt="" className="max-h-48 w-full rounded-xl object-contain" />
      )}

      <Button full loading={busy} onClick={() => void send()}>
        {t('claim.submit')}
      </Button>
    </Card>
  )
}
