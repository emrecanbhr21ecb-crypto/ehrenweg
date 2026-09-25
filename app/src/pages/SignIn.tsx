/**
 * Giriş — e-posta/şifre, Google ve şifre sıfırlama.
 *
 * Şifre sıfırlama aynı ekranda açılır (ayrı sayfa değil): şifresini unutan
 * kullanıcı gezinme akışında kaybolmasın.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { Alert, Button, Card, TextField } from '@/components/ui'
import {
  AuthError,
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
} from '@/lib/authService'
import { ensureUserProfile } from '@/lib/userProfile'
import type { Locale } from '@/config/brand'

export default function SignIn(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  function reportError(caught: unknown): void {
    if (caught instanceof AuthError) {
      setError(t(caught.i18nKey, { ns: 'errors' }))
    } else {
      setError(t('auth.unknown', { ns: 'errors' }))
      console.error('[signin]', caught)
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      if (resetMode) {
        await requestPasswordReset(email)
        // Güvenlik: e-posta kayıtlı olmasa bile aynı mesaj gösterilir, yoksa
        // kimin üye olduğu sızar.
        setNotice(t('auth.resetSent'))
        setResetMode(false)
      } else {
        const user = await signInWithEmail(email, password)
        await ensureUserProfile(user, {
          locale: (i18n.resolvedLanguage ?? 'de') as Locale,
        })
        await navigate('/', { replace: true })
      }
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
      <h1 className="mb-1 text-2xl font-bold">
        {resetMode ? t('auth.resetTitle') : t('auth.signInTitle')}
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        {resetMode ? t('auth.resetSubtitle') : t('auth.signInSubtitle')}
      </p>

      <Card className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <TextField
            label={t('auth.email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {!resetMode && (
            <TextField
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}

          <Button type="submit" full loading={busy}>
            {resetMode ? t('auth.resetAction') : t('auth.signInAction')}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setResetMode((value) => !value)
            setError(null)
            setNotice(null)
          }}
          className="w-full text-sm text-primary-700 underline dark:text-primary-300"
        >
          {resetMode ? t('action.back') : t('auth.forgotPassword')}
        </button>

        {!resetMode && (
          <>
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
          </>
        )}
      </Card>

      <p className="mt-6 text-center text-sm">
        {t('auth.noAccountQuestion')}{' '}
        <Link to="/signup" className="font-semibold text-primary-700 underline dark:text-primary-300">
          {t('auth.signUpAction')}
        </Link>
      </p>
    </div>
  )
}
