/**
 * Bildirim tercihleri ve rıza — CLAUDE.md Bölüm 12 ve Bölüm 10.
 *
 * "Bildirim tercihleri ayarlarda: duyurular, son başvuru hatırlatıcıları,
 *  aylık özet."
 *
 * ⚠️ `analyticsConsent` Bölüm 10 gereği **varsayılan KAPALI**. Açık gelen bir
 * rıza kutusu rıza değildir.
 *
 * Push'un alma tarafı çalışıyor, gönderme tarafı sunucuya bağlı — arayüz bu
 * farkı gizlemiyor (bkz. lib/push.ts).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Card, Switch } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { updateSettings, watchSettings } from '@/lib/announcements'
import { enablePush, type PushState } from '@/lib/push'
import {
  DEFAULT_SETTINGS,
  type NotificationSettings as Settings,
} from '@/types/announcement'

export function NotificationSettings(): React.JSX.Element {
  const { t } = useTranslation('notify')
  const { user } = useAuth()

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [pushState, setPushState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return watchSettings(user.uid, setSettings, (caught) =>
      console.error('[settings] Okunamadı:', caught),
    )
  }, [user])

  async function toggle(key: keyof Settings, value: boolean): Promise<void> {
    if (!user) return
    // İyimser güncelleme: anahtar anında dönsün, yazma arkada gitsin.
    setSettings((current) => ({ ...current, [key]: value }))
    try {
      await updateSettings(user.uid, { [key]: value })
      setNotice(t('settings.saved'))
      setError(null)
    } catch (caught) {
      console.error('[settings] Kaydedilemedi:', caught)
      setError(t('settings.saveFailed'))
    }
  }

  async function turnOnPush(): Promise<void> {
    if (!user) return
    setBusy(true)
    setPushState(await enablePush(user.uid))
    setBusy(false)
  }

  return (
    <section aria-labelledby="notify-heading" className="space-y-3">
      <h2 id="notify-heading" className="text-sm font-semibold">
        {t('settings.title')}
      </h2>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="space-y-4">
        <Switch
          checked={settings.announcements}
          onChange={(next) => void toggle('announcements', next)}
          label={t('settings.announcements')}
        />
        <Switch
          checked={settings.deadlineReminders}
          onChange={(next) => void toggle('deadlineReminders', next)}
          label={t('settings.deadlineReminders')}
        />
        <Switch
          checked={settings.monthlySummary}
          onChange={(next) => void toggle('monthlySummary', next)}
          label={t('settings.monthlySummary')}
        />

        {/* Bölüm 10: analitik varsayılan kapalı, rızaya bağlı. */}
        <Switch
          checked={settings.analyticsConsent}
          onChange={(next) => void toggle('analyticsConsent', next)}
          label={t('settings.analytics')}
          hint={t('settings.analyticsHint')}
        />
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">{t('settings.pushTitle')}</p>

        {pushState === null ? (
          <Button variant="secondary" loading={busy} onClick={() => void turnOnPush()}>
            🔔 {t('settings.pushEnable')}
          </Button>
        ) : (
          <Alert
            tone={
              pushState === 'granted' || pushState === 'granted_no_server'
                ? 'success'
                : 'info'
            }
          >
            {pushState === 'granted' && t('settings.pushGranted')}
            {pushState === 'granted_no_server' && t('settings.pushNoServer')}
            {pushState === 'denied' && t('settings.pushDenied')}
            {pushState === 'unsupported' && t('settings.pushUnsupported')}
            {pushState === 'pending' && t('settings.pushPending')}
          </Alert>
        )}

        {settings.pushTokens.length > 0 && pushState === null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('settings.pushNoServer')}
          </p>
        )}
      </Card>
    </section>
  )
}
