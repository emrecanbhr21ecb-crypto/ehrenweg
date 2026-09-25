/**
 * Eğitim geri bildirimi — CLAUDE.md Bölüm 8.
 *
 * "Eğitime gelen katılımcı geri bildirimleri (1–5 yıldız + yorum) …
 *  Yorumlar kurum tarafından gizlenebilsin."
 *
 * Yalnız EĞİTİM aktivitelerinde ve yalnız aktivite bittikten sonra görünür.
 * Yazma hakkı pasaport girdisi olanlarda — kural da aynı şeyi arıyor, yani
 * gitmeyen biri puan veremiyor.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Badge, Button, Card, TextArea } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { formatDate } from '@/lib/format'
import {
  fetchMyFeedback,
  setFeedbackHidden,
  submitFeedback,
  watchActivityFeedback,
} from '@/lib/trainer'
import { averageRating, MAX_RATING, type TrainingFeedback } from '@/types/trainer'
import type { Activity } from '@/types/activity'
import type { Locale } from '@/config/brand'

/** Yıldız seçici — gerçek radio grubu, klavyeyle gezilebilir. */
function StarPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}): React.JSX.Element {
  const { t } = useTranslation('trainer')

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t('feedback.rating')}</legend>
      <div className="flex gap-1">
        {Array.from({ length: MAX_RATING }, (_, index) => index + 1).map((star) => (
          <label key={star} className="cursor-pointer">
            <input
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
            />
            <span
              aria-label={t('feedback.star', { count: star })}
              className={[
                'inline-block px-1 text-3xl transition-transform',
                star <= value ? 'text-amber-500' : 'text-gray-300 dark:text-ink-700',
              ].join(' ')}
            >
              ★
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function TrainingFeedbackSection({
  activity,
  canModerate,
}: {
  activity: Activity
  canModerate: boolean
}): React.JSX.Element | null {
  const { t, i18n } = useTranslation('trainer')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, profile } = useAuth()

  const [entries, setEntries] = useState<TrainingFeedback[]>([])
  const [mine, setMine] = useState<TrainingFeedback | null | undefined>(undefined)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    return watchActivityFeedback(activity.id, setEntries, (caught) =>
      console.error('[feedback] Okunamadı:', caught),
    )
  }, [activity.id])

  useEffect(() => {
    if (!user) return
    void fetchMyFeedback(activity.id, user.uid)
      .then(setMine)
      .catch(() => setMine(null))
  }, [activity.id, user])

  // Yalnız eğitimlerde ve yalnız bittikten sonra.
  if (activity.type !== 'training') return null
  if (activity.endAt.toDate().getTime() > Date.now()) return null
  if (mine === undefined) return null

  const summary = averageRating(entries)
  const visible = canModerate ? entries : entries.filter((entry) => !entry.hidden)

  async function send(): Promise<void> {
    if (!user || !profile) return
    setBusy(true)
    setError(null)
    try {
      await submitFeedback(activity.id, {
        uid: user.uid,
        displayName: profile.displayName,
        trainerUid: activity.trainerUid ?? '',
        orgId: activity.orgId,
        rating,
        comment: comment.trim(),
      })
      setDone(true)
    } catch (caught) {
      // Kural pasaport girdisi arıyor: gitmeyen biri puan veremez.
      console.error('[feedback] Kaydedilemedi:', caught)
      setError(t('feedback.onlyAttendees'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('feedback.listTitle')}</h2>
        {summary.count > 0 && (
          <Badge tone="neutral">
            {t('feedback.average', { average: summary.average, count: summary.count })}
          </Badge>
        )}
      </div>

      {done && <Alert tone="success">{t('feedback.submitted')}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!mine && !done && (
        <Card className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">{t('feedback.title')}</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('feedback.hint')}
            </p>
          </div>

          <StarPicker value={rating} onChange={setRating} />

          <TextArea
            label={t('feedback.comment')}
            placeholder={t('feedback.commentPlaceholder')}
            rows={3}
            maxLength={600}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />

          <Button loading={busy} onClick={() => void send()}>
            {t('feedback.submit')}
          </Button>
        </Card>
      )}

      {visible.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('feedback.empty')}
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="px-5">
            {visible.map((entry) => (
              <li
                key={entry.uid}
                className="border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {entry.displayName}
                      {entry.uid === user?.uid && (
                        <span className="ms-2 text-xs text-gray-500">
                          ({t('feedback.yours')})
                        </span>
                      )}
                    </p>
                    <p
                      className="text-amber-500"
                      aria-label={t('feedback.star', { count: entry.rating })}
                    >
                      {'★'.repeat(entry.rating)}
                      <span className="text-gray-300 dark:text-ink-700">
                        {'★'.repeat(MAX_RATING - entry.rating)}
                      </span>
                    </p>
                  </div>

                  {entry.hidden && <Badge tone="warning">{t('feedback.hidden')}</Badge>}
                </div>

                {entry.comment && <p className="mt-1 text-sm">{entry.comment}</p>}

                {entry.createdAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(entry.createdAt.toDate(), locale)}
                  </p>
                )}

                {canModerate && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void setFeedbackHidden(activity.id, entry.uid, !entry.hidden)
                    }
                  >
                    {entry.hidden ? t('feedback.show') : t('feedback.hide')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
