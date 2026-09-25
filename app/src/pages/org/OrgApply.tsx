/**
 * Kurum başvuru formu (CLAUDE.md Bölüm 4).
 *
 * Başvuru `pending` olarak kaydedilir; kurum onay gelene kadar aktivite
 * YAYINLAYAMAZ (taslak hazırlayabilir). Onay platform admin ekranından gelir.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Alert, Button, Card, SelectField, TextArea, TextField } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { applyForOrganization } from '@/lib/organizations'
import { ORG_TYPES, orgApplicationSchema, type OrgType } from '@/types/activity'
import type { ActivityValidationKey } from '@/types/activity'

export default function OrgApply(): React.JSX.Element {
  const { t } = useTranslation(['manage', 'errors', 'common'])
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [name, setName] = useState('')
  const [type, setType] = useState<OrgType>('municipality')
  const [city, setCity] = useState(profile?.city ?? '')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState(profile?.email ?? '')
  const [descriptionDe, setDescriptionDe] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!user || !profile) return

    const parsed = orgApplicationSchema.safeParse({
      name,
      type,
      city,
      website,
      contactEmail,
      description: { de: descriptionDe, en: descriptionEn },
    })

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
    setFormError(null)
    setBusy(true)

    try {
      const orgId = await applyForOrganization(parsed.data, {
        uid: user.uid,
        displayName: profile.displayName,
        email: profile.email,
      })
      void navigate(`/org?org=${orgId}`, { replace: true })
    } catch (caught) {
      console.error('[org] Başvuru gönderilemedi:', caught)
      setFormError(t('manage:apply.failed'))
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
    >
      <header>
        <h1 className="text-2xl font-bold">{t('manage:apply.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('manage:apply.subtitle')}
        </p>
      </header>

      {formError && <Alert tone="error">{formError}</Alert>}

      <Card className="space-y-4">
        <TextField
          label={t('manage:apply.name')}
          hint={t('manage:apply.nameHint')}
          value={name}
          error={errors['name']}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <SelectField
          label={t('manage:apply.type')}
          value={type}
          onChange={(event) => setType(event.target.value as OrgType)}
        >
          {ORG_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`manage:types.${value}`)}
            </option>
          ))}
        </SelectField>

        <TextField
          label={t('manage:apply.city')}
          value={city}
          error={errors['city']}
          onChange={(event) => setCity(event.target.value)}
          required
        />

        <TextField
          label={t('manage:apply.website')}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={website}
          error={errors['website']}
          onChange={(event) => setWebsite(event.target.value)}
        />

        <TextField
          label={t('manage:apply.contactEmail')}
          hint={t('manage:apply.contactEmailHint')}
          type="email"
          inputMode="email"
          value={contactEmail}
          error={errors['contactEmail']}
          onChange={(event) => setContactEmail(event.target.value)}
          required
        />
      </Card>

      <Card className="space-y-4">
        <TextArea
          label={t('manage:apply.descriptionDe')}
          hint={t('manage:apply.descriptionHint')}
          rows={3}
          value={descriptionDe}
          onChange={(event) => setDescriptionDe(event.target.value)}
        />
        <TextArea
          label={t('manage:apply.descriptionEn')}
          rows={3}
          value={descriptionEn}
          onChange={(event) => setDescriptionEn(event.target.value)}
        />
      </Card>

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {busy ? t('manage:apply.submitting') : t('manage:apply.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void navigate(-1)}>
          {t('common:action.cancel')}
        </Button>
      </div>
    </form>
  )
}
