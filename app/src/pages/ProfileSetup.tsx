/**
 * Onboarding'in son adımı — profil kurulumu.
 *
 * Buraya yalnızca girişi yapılmış ama profili eksik kullanıcı düşer
 * (isProfileComplete). İki adım: kim olduğun + ne yapmak istediğin.
 *
 * Konum izni burada İSTENMEZ. CLAUDE.md konum iznini "opsiyonel" diyor;
 * kayıt anında izin istemek reddedilme oranını yükseltir ve hedef kitlede
 * güven sorunu yaratır. İzin, "yakınımdakiler" filtresi ilk kez kullanıldığında
 * (Faz 2) bağlamıyla birlikte istenecek.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { InterestPicker, LanguagePicker, SkillPicker } from '@/components/ProfileFields'
import { Alert, Button, Card, TextField } from '@/components/ui'
import type { CategoryId, SkillId } from '@/config/catalog'
import { useAuth } from '@/lib/AuthProvider'
import { updateUserProfile } from '@/lib/userProfile'
import type { UserLanguage } from '@/types/user'
import type { Locale } from '@/config/brand'

export default function ProfileSetup(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [languages, setLanguages] = useState<UserLanguage[]>(
    profile?.languages ?? [],
  )
  const [interests, setInterests] = useState<CategoryId[]>(
    profile?.interests ?? [],
  )
  const [skills, setSkills] = useState<SkillId[]>(profile?.skills ?? [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const step1Valid = displayName.trim().length >= 2 && languages.length > 0
  const step2Valid = interests.length > 0

  async function handleFinish(): Promise<void> {
    if (!user || busy) return
    setBusy(true)
    setError(null)
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        city: city.trim(),
        languages,
        interests,
        skills,
        locale: (i18n.resolvedLanguage ?? 'de') as Locale,
      })
      await navigate('/', { replace: true })
    } catch (caught) {
      console.error('[profileSetup]', caught)
      setError(t('profile.saveFailed', { ns: 'errors' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <p className="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">
        {t('setup.stepLabel', { current: step, total: 2 })}
      </p>
      <h1 className="mb-1 text-2xl font-bold">
        {step === 1 ? t('setup.step1Title') : t('setup.step2Title')}
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {step === 1 ? t('setup.step1Subtitle') : t('setup.step2Subtitle')}
      </p>

      <Card className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}

        {step === 1 ? (
          <>
            <TextField
              label={t('auth.displayName')}
              hint={t('auth.displayNameHint')}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <TextField
              label={t('profile.city')}
              hint={t('profile.cityHint')}
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <LanguagePicker value={languages} onChange={setLanguages} />
          </>
        ) : (
          <>
            <InterestPicker value={interests} onChange={setInterests} />
            <SkillPicker value={skills} onChange={setSkills} />
          </>
        )}
      </Card>

      <div className="mt-6 space-y-3">
        {step === 1 ? (
          <Button full disabled={!step1Valid} onClick={() => setStep(2)}>
            {t('action.continue')}
          </Button>
        ) : (
          <>
            <Button
              full
              loading={busy}
              disabled={!step2Valid}
              onClick={() => void handleFinish()}
            >
              {t('setup.finish')}
            </Button>
            <Button variant="ghost" full onClick={() => setStep(1)}>
              {t('action.back')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
