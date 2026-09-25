/**
 * E-posta doğrulama bekleme ekranı.
 *
 * Firebase doğrulama linkine tıklandığında bu sekme haberdar OLMAZ; bu yüzden
 * hem "doğruladım" düğmesi hem de sayfa yeniden odaklandığında otomatik
 * kontrol var. Kullanıcı e-postayı telefonunda açıp uygulamaya dönünce
 * kendiliğinden geçmeli.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Alert, Button, Card } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { AuthError, resendVerificationEmail, signOutUser } from '@/lib/authService'

/** Tekrar gönderme arasındaki bekleme — Firebase kota koruması. */
const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmail(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()

  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Doğrulandıysa içeri al.
  useEffect(() => {
    if (user?.emailVerified) void navigate('/', { replace: true })
  }, [user?.emailVerified, navigate])

  // Sekme yeniden odağa gelince sessizce kontrol et.
  useEffect(() => {
    function onFocus(): void {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function handleCheck(): Promise<void> {
    setChecking(true)
    setError(null)
    setNotice(null)
    await refresh()
    setChecking(false)
    // refresh() sonrası user.emailVerified hâlâ false ise kullanıcıyı boşuna
    // bekletmeyelim, açıkça söyleyelim.
    if (!user?.emailVerified) setNotice(t('auth.stillNotVerified'))
  }

  async function handleResend(): Promise<void> {
    setError(null)
    setNotice(null)
    try {
      await resendVerificationEmail()
      setNotice(t('auth.verificationResent'))
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? t(caught.i18nKey, { ns: 'errors' })
          : t('auth.unknown', { ns: 'errors' }),
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <Card className="space-y-5 text-center">
        <p className="text-5xl" aria-hidden="true">
          ✉️
        </p>
        <h1 className="text-xl font-semibold">{t('auth.verifyTitle')}</h1>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t('auth.verifyBody', { email: user?.email ?? '' })}
        </p>

        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        <div className="space-y-3">
          <Button full loading={checking} onClick={() => void handleCheck()}>
            {t('auth.verifyCheck')}
          </Button>
          <Button
            variant="secondary"
            full
            disabled={cooldown > 0}
            onClick={() => void handleResend()}
          >
            {cooldown > 0
              ? t('auth.resendIn', { seconds: cooldown })
              : t('auth.resendVerification')}
          </Button>
          <Button
            variant="ghost"
            full
            onClick={() => {
              void signOutUser().then(() => navigate('/welcome', { replace: true }))
            }}
          >
            {t('auth.signOut')}
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('auth.verifySpamHint')}
        </p>
      </Card>
    </div>
  )
}
