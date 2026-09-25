/**
 * Profil düzenleme.
 *
 * Yalnızca `EditableProfile` alanlarını gönderir. Kaydetme, Firestore Rules'un
 * izin verdiği alan listesiyle bire bir örtüşür (types/user.ts açıklamasına
 * bakınız) — aksi hâlde tüm yazma reddedilir.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { InterestPicker, LanguagePicker, SkillPicker } from '@/components/ProfileFields'
import { Alert, Button, Card, TextArea, TextField } from '@/components/ui'
import type { CategoryId, SkillId } from '@/config/catalog'
import { useAuth } from '@/lib/AuthProvider'
import { updateUserProfile } from '@/lib/userProfile'
import { editableProfileSchema, isValidationKey, type UserLanguage } from '@/types/user'

export default function ProfileEdit(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [languages, setLanguages] = useState<UserLanguage[]>(profile?.languages ?? [])
  const [interests, setInterests] = useState<CategoryId[]>(profile?.interests ?? [])
  const [skills, setSkills] = useState<SkillId[]>(profile?.skills ?? [])

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!user || !profile || busy) return

    const candidate = {
      displayName,
      bio,
      city,
      locale: profile.locale,
      interests,
      skills,
      languages,
      photoURL: profile.photoURL,
    }

    const parsed = editableProfileSchema.safeParse(candidate)
    if (!parsed.success) {
      // Zod mesajları i18n ANAHTARI taşıyor (types/user.ts), burada çevrilir.
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form')
        next[field] = isValidationKey(issue.message)
          ? t(issue.message, { ns: 'errors' })
          : t('generic', { ns: 'errors' })
      }
      setFieldErrors(next)
      return
    }

    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      await updateUserProfile(user.uid, parsed.data)
      await navigate('/profile', { replace: true })
    } catch (caught) {
      console.error('[profileEdit]', caught)
      setError(t('profile.saveFailed', { ns: 'errors' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6 pb-4">
      <h1 className="text-2xl font-bold">{t('profile.edit')}</h1>

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="space-y-5">
        <TextField
          label={t('auth.displayName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors['displayName']}
          autoComplete="name"
          required
        />
        <TextField
          label={t('profile.city')}
          hint={t('profile.cityHint')}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors['city']}
          autoComplete="address-level2"
        />
        <TextArea
          label={t('profile.bio')}
          hint={t('profile.bioHint')}
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          error={fieldErrors['bio']}
        />
      </Card>

      <Card>
        <LanguagePicker value={languages} onChange={setLanguages} />
      </Card>

      <Card>
        <InterestPicker value={interests} onChange={setInterests} />
      </Card>

      <Card>
        <SkillPicker value={skills} onChange={setSkills} />
      </Card>

      <div className="space-y-3">
        <Button type="submit" full loading={busy}>
          {t('action.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          full
          onClick={() => void navigate('/profile')}
        >
          {t('action.cancel')}
        </Button>
      </div>
    </form>
  )
}
