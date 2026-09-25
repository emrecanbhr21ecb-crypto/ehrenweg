/**
 * Kayıt — e-posta + şifre ve Google.
 *
 * CLAUDE.md Bölüm 10: 16 yaş altı kayıt ENGELLENİR (DSGVO rızası). Doğum
 * tarihi saklamıyoruz (veri minimizasyonu); kullanıcıdan 16 yaşından büyük
 * olduğunu onaylaması isteniyor ve bu onay rıza kaydı olarak profile değil,
 * yalnız kayıt anında kontrol ediliyor.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { Alert, Button, Card, TextField } from '@/components/ui'
import { BRAND } from '@/config/brand'
import {
  MIN_PASSWORD_LENGTH,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/authService'
import { resolveErrorKey } from '@/lib/errorKey'
import { ensureUserProfile } from '@/lib/userProfile'
import type { Locale } from '@/config/brand'

export default function SignUp(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canSubmit =
    displayName.trim().length >= 2 &&
    email.includes('@') &&
    password.length >= MIN_PASSWORD_LENGTH &&
    ageConfirmed &&
    termsAccepted

  function reportError(caught: unknown): void {
    // Kaynak neresi olursa olsun (Auth mı, Firestore mu) doğru mesaj çıksın.
    console.error('[signup]', caught)
    setError(t(resolveErrorKey(caught), { ns: 'errors' }))
  }

  async function handleEmailSignUp(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!canSubmit || busy) return

    setBusy(true)
    setError(null)
    try {
      const user = await signUpWithEmail({ email, password, displayName })
      await ensureUserProfile(user, {
        displayName: displayName.trim(),
        locale: (i18n.resolvedLanguage ?? 'de') as Locale,
      })
      await navigate('/verify-email', { replace: true })
    } catch (caught) {
      reportError(caught)
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const user = await signInWithGoogle()
      await ensureUserProfile(user, {
        locale: (i18n.resolvedLanguage ?? 'de') as Locale,
      })
      await navigate('/', { replace: true })
    } catch (caught) {
      reportError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold">{t('auth.signUpTitle')}</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {t('auth.signUpSubtitle')}
      </p>

      <Card className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <form onSubmit={(e) => void handleEmailSignUp(e)} className="space-y-4">
          <TextField
            label={t('auth.displayName')}
            hint={t('auth.displayNameHint')}
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <TextField
            label={t('auth.email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            hint={t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded border-gray-300 accent-primary-700"
            />
            <span>{t('auth.ageConfirm')}</span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded border-gray-300 accent-primary-700"
            />
            <span>
              {t('auth.termsPrefix')}{' '}
              <a
                href={BRAND.urls.privacy}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t('auth.privacyLink')}
              </a>{' '}
              {t('auth.termsAnd')}{' '}
              <a
                href={BRAND.urls.terms}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t('auth.termsLink')}
              </a>
            </span>
          </label>

          <Button type="submit" full loading={busy} disabled={!canSubmit}>
            {t('auth.signUpAction')}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200 dark:bg-ink-800" />
          {t('auth.or')}
          <span className="h-px flex-1 bg-gray-200 dark:bg-ink-800" />
        </div>

        <Button
          variant="secondary"
          full
          onClick={() => void handleGoogle()}
          disabled={busy}
        >
          {t('auth.continueWithGoogle')}
        </Button>
      </Card>

      <p className="mt-6 text-center text-sm">
        {t('auth.haveAccountQuestion')}{' '}
        <Link
          to="/signin"
          className="font-semibold text-primary-700 underline dark:text-primary-300"
        >
          {t('auth.signInAction')}
        </Link>
      </p>
    </div>
  )
}
