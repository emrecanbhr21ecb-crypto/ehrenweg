/**
 * DSGVO araçları — "Verilerimi indir" (Art. 20) ve "Hesabımı sil" (Art. 17).
 *
 * CLAUDE.md Bölüm 9 (Profil ekranı) ve Bölüm 15 Faz 7 bitti ölçütü.
 * Mantık `lib/privacy.ts`te; bu bileşen yalnız akışı ve yeniden-giriş
 * (reauth) adımını yönetir.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Alert, Button, Card, TextField } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import {
  AuthError,
  deleteAuthAccount,
  reauthenticate,
  signOutUser,
} from '@/lib/authService'
import { downloadMyData, exportMyData, redactMyTraces } from '@/lib/privacy'

type DeletePhase = 'idle' | 'confirming' | 'needsReauth' | 'working' | 'failed'

export function PrivacyTools(): React.JSX.Element {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [phase, setPhase] = useState<DeletePhase>('idle')
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isGoogleUser = user?.providerData[0]?.providerId === 'google.com'

  async function handleExport(): Promise<void> {
    if (!user) return
    setExporting(true)
    setExportError(null)
    try {
      const data = await exportMyData(user.uid)
      downloadMyData(data, user.uid)
    } catch (caught) {
      console.error('[privacy] Dışa aktarma başarısız:', caught)
      setExportError(t('privacy.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  /**
   * Silme iki adımda ilerler: önce Firestore tarafı (geri dönüşsüz değil,
   * tekrar denenebilir — `redactMyTraces` idempotent), sonra Auth hesabı.
   * Auth adımı "yakın zamanda giriş" isteyebilir; o durumda akış durur ve
   * kullanıcıdan parolasını (ya da Google'da tekrar onay) ister.
   */
  async function runDeletion(): Promise<void> {
    if (!user) return
    setPhase('working')
    setDeleteError(null)
    try {
      await redactMyTraces(user.uid)
      await deleteAuthAccount()
      await signOutUser()
      navigate('/welcome', { replace: true })
    } catch (caught) {
      if (
        caught instanceof AuthError &&
        caught.i18nKey === 'auth.requiresRecentLogin'
      ) {
        setPhase('needsReauth')
        return
      }
      console.error('[privacy] Hesap silinemedi:', caught)
      setDeleteError(t('privacy.deleteFailed'))
      setPhase('failed')
    }
  }

  async function handleReauthAndRetry(): Promise<void> {
    setPhase('working')
    setDeleteError(null)
    try {
      await reauthenticate(isGoogleUser ? undefined : password)
      // Firestore tarafı ilk denemede muhtemelen zaten tamamlandı; tekrar
      // çağırmak zararsız (her adım idempotent) ve yarıda kalmışsa tamamlar.
      await redactMyTraces(user?.uid ?? '')
      await deleteAuthAccount()
      await signOutUser()
      navigate('/welcome', { replace: true })
    } catch (caught) {
      console.error('[privacy] Yeniden giriş / silme başarısız:', caught)
      setDeleteError(
        caught instanceof AuthError
          ? t(caught.i18nKey, { ns: 'errors' })
          : t('privacy.reauthFailed'),
      )
      setPhase('needsReauth')
    }
  }

  return (
    <section aria-labelledby="privacy-heading" className="space-y-3">
      <h2 id="privacy-heading" className="text-sm font-semibold">
        {t('privacy.title')}
      </h2>

      <Card className="space-y-3">
        <div>
          <p className="text-sm font-medium">{t('privacy.exportTitle')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('privacy.exportBody')}
          </p>
        </div>
        {exportError && <Alert tone="error">{exportError}</Alert>}
        <Button
          variant="secondary"
          loading={exporting}
          onClick={() => void handleExport()}
        >
          ⬇️ {t('privacy.exportButton')}
        </Button>
      </Card>

      <Card className="space-y-3 border-red-200 dark:border-red-900">
        <div>
          <p className="text-sm font-medium">{t('privacy.deleteTitle')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('privacy.deleteBody')}
          </p>
        </div>

        {deleteError && <Alert tone="error">{deleteError}</Alert>}

        {phase === 'needsReauth' && (
          <div className="space-y-3">
            <Alert tone="warning">{t('privacy.reauthBody')}</Alert>
            {!isGoogleUser && (
              <TextField
                type="password"
                label={t('privacy.reauthPassword')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            )}
            <Button
              variant="danger"
              loading={false}
              onClick={() => void handleReauthAndRetry()}
            >
              {isGoogleUser
                ? t('privacy.reauthGoogleButton')
                : t('privacy.reauthButton')}
            </Button>
          </div>
        )}

        {phase !== 'needsReauth' && (
          <Button
            variant="danger"
            loading={phase === 'working'}
            onClick={() => {
              if (!window.confirm(t('privacy.deleteConfirm'))) return
              void runDeletion()
            }}
          >
            🗑️ {t('privacy.deleteButton')}
          </Button>
        )}
      </Card>
    </section>
  )
}
