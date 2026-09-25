/**
 * Eğitmen başvuru formu — CLAUDE.md Bölüm 8.
 *
 * "öğretmek istediği konular, dil seviyesi beyanı, dil eğitimi verecekse
 *  B2+ belge yüklemesi, kısa motivasyon metni. Başvuru anında kullanıcının
 *  istatistiklerinin fotoğrafı (snapshot) kaydedilsin."
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { accountAgeDays } from '@/components/TrainerCard'
import { Alert, Button, Card, ChipToggle, SelectField, TextArea } from '@/components/ui'
import { CEFR_LEVELS, LANGUAGE_CODES, SKILL_IDS } from '@/config/catalog'
import { useAuth } from '@/lib/AuthProvider'
import { compressPhoto } from '@/lib/claims'
import { submitTrainerApplication } from '@/lib/trainer'
import type { ActivityValidationKey } from '@/types/activity'
import {
  needsCertificate,
  trainerApplicationSchema,
  type TrainerApplicationForm,
} from '@/types/trainer'

export default function TrainerApply(): React.JSX.Element {
  const { t } = useTranslation(['trainer', 'catalog', 'errors', 'common'])
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [topics, setTopics] = useState<string[]>([])
  const [language, setLanguage] = useState('')
  const [level, setLevel] = useState('')
  const [motivation, setMotivation] = useState('')
  const [certificate, setCertificate] = useState<string>('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const certificateNeeded = needsCertificate({ topics })

  async function pickCertificate(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setCertificate(await compressPhoto(file))
      setFormError(null)
    } catch (caught) {
      console.error('[trainer] Belge işlenemedi:', caught)
      setFormError(t('trainer:apply.failed'))
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!user || !profile) return

    const parsed = trainerApplicationSchema.safeParse({
      topics,
      teachingLanguage: language,
      teachingLanguageLevel: level,
      motivation,
    } satisfies Record<string, unknown> as TrainerApplicationForm)

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

    // Bölüm 8: dil eğitimi verecekse B2+ belge ŞART.
    if (certificateNeeded && !certificate) {
      setFormError(t('trainer:apply.certificateRequired'))
      return
    }

    setErrors({})
    setFormError(null)
    setBusy(true)

    try {
      const attempts = profile.stats.activitiesCompleted + profile.stats.noShows
      await submitTrainerApplication(
        parsed.data,
        {
          uid: user.uid,
          displayName: profile.displayName,
          email: profile.email,
        },
        {
          level: profile.stats.level,
          hours: profile.stats.hours,
          activitiesCompleted: profile.stats.activitiesCompleted,
          noShows: profile.stats.noShows,
          noShowRate: attempts === 0 ? 0 : profile.stats.noShows / attempts,
          accountAgeDays: Math.floor(accountAgeDays(profile.createdAt)),
        },
        certificate,
      )
      void navigate('/profile', { replace: true })
    } catch (caught) {
      console.error('[trainer] Başvuru gönderilemedi:', caught)
      setFormError(t('trainer:apply.failed'))
      setBusy(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
      <header>
        <h1 className="text-2xl font-bold">{t('trainer:apply.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('trainer:apply.subtitle')}
        </p>
      </header>

      {formError && <Alert tone="error">{formError}</Alert>}

      <Card className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">
            {t('trainer:apply.topics')}
          </legend>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t('trainer:apply.topicsHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {SKILL_IDS.map((id) => (
              <ChipToggle
                key={id}
                selected={topics.includes(id)}
                onToggle={() =>
                  setTopics((current) =>
                    current.includes(id)
                      ? current.filter((entry) => entry !== id)
                      : [...current, id],
                  )
                }
              >
                {t(`catalog:skills.${id}`)}
              </ChipToggle>
            ))}
          </div>
          {errors['topics'] && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {errors['topics']}
            </p>
          )}
        </fieldset>

        <SelectField
          label={t('trainer:apply.language')}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="">{t('trainer:apply.languageNone')}</option>
          {LANGUAGE_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`catalog:languages.codes.${code}`)}
            </option>
          ))}
        </SelectField>

        {language && (
          <SelectField
            label={t('trainer:apply.languageLevel')}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">—</option>
            {CEFR_LEVELS.map((value) => (
              <option key={value} value={value}>
                {t(`catalog:languages.levels.${value}`)}
              </option>
            ))}
          </SelectField>
        )}
      </Card>

      {certificateNeeded && (
        <Card className="space-y-2">
          <label htmlFor="certificate" className="block text-sm font-medium">
            {t('trainer:apply.certificate')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('trainer:apply.certificateHint')}
          </p>
          <input
            id="certificate"
            type="file"
            accept="image/*"
            onChange={(event) => void pickCertificate(event)}
            className="block w-full text-sm"
          />
          {certificate && (
            <img
              src={certificate}
              alt=""
              className="max-h-48 w-full rounded-xl object-contain"
            />
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <TextArea
          label={t('trainer:apply.motivation')}
          hint={t('trainer:apply.motivationHint')}
          rows={5}
          maxLength={1000}
          value={motivation}
          error={errors['motivation']}
          onChange={(event) => setMotivation(event.target.value)}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('trainer:apply.snapshotNote')}
        </p>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {busy ? t('trainer:apply.submitting') : t('trainer:apply.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void navigate(-1)}>
          {t('common:action.cancel')}
        </Button>
      </div>
    </form>
  )
}
