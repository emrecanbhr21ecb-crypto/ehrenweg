/**
 * Katılımcı Scan ekranı — CLAUDE.md Bölüm 9, item 2.
 *
 * Kamera ile QR okuma, manuel kod girişi, çevrimdışı kuyruk göstergesi.
 * Hata kodları Bölüm 12'deki liste (wrong-code / expired / inactive /
 * activity-missing / already-recorded / geo-too-far), DE ve EN.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { QrScanner, type CameraState } from '@/components/QrScanner'
import {
  Alert,
  Badge,
  Button,
  Card,
  SelectField,
  Spinner,
  TextField,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import {
  submitLateScan,
  submitManualCode,
  submitScan,
  type ScanContext,
} from '@/lib/attendance'
import { watchMyApplications } from '@/lib/applications'
import { fetchMyPassport } from '@/lib/passport'
import { fetchActivity } from '@/lib/activities'
import { requestDeviceLocation } from '@/lib/geo'
import { enqueueScan, flushQueue, isOnline, subscribeQueue } from '@/lib/scanQueue'
import {
  ScanFailure,
  parseQrPayload,
  type ScanErrorKey,
  type ScannedCode,
} from '@/types/attendance'
import { pickText, type Application } from '@/types/activity'
import type { CategoryId } from '@/config/catalog'
import type { Locale } from '@/config/brand'

/** Bugün civarındaki katılımlar — manuel kod için aktivite seçimi. */
const NEAR_WINDOW_MS = 36 * 60 * 60 * 1000

export default function Scan(): React.JSX.Element {
  const { t, i18n } = useTranslation(['attendance', 'common'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, profile } = useAuth()

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [queued, setQueued] = useState(0)

  const [applications, setApplications] = useState<Application[]>([])
  const [manualActivity, setManualActivity] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [myCategories, setMyCategories] = useState<CategoryId[] | null>(null)

  // Kuyruk sayacı canlı.
  useEffect(() => subscribeQueue(setQueued), [])

  // Manuel kod için: yakın tarihli başvurularım.
  useEffect(() => {
    if (!user) return
    return watchMyApplications(user.uid, setApplications, (caught) =>
      console.error('[scan] Başvurular okunamadı:', caught),
    )
  }, [user])

  // "Yeni kategori mi" kararı için kendi pasaportum.
  useEffect(() => {
    if (!user) return
    void fetchMyPassport(user.uid)
      .then((entries) => setMyCategories(entries.map((entry) => entry.categoryId)))
      .catch(() => setMyCategories([]))
  }, [user])

  const nearby = useMemo(() => {
    const now = Date.now()
    return applications.filter((application) => {
      if (application.status === 'withdrawn' || application.status === 'rejected') {
        return false
      }
      const start = application.activityStartAt?.toMillis?.()
      return typeof start === 'number' && Math.abs(start - now) < NEAR_WINDOW_MS
    })
  }, [applications])

  useEffect(() => {
    if (!manualActivity && nearby[0]) setManualActivity(nearby[0].activityId)
  }, [nearby, manualActivity])

  /** Tarama bağlamı: kimlik + konum + doğrulanabilir sayaç kopyası. */
  const buildContext = useCallback(
    async (categoryId: CategoryId | null): Promise<ScanContext> => {
      if (!user || !profile) throw new ScanFailure('notSignedIn')

      // Konumu yalnız gerekiyorsa isteriz; oturum GPS istemiyorsa
      // kullanıcıyı boşuna izin penceresiyle rahatsız etmeyiz.
      let position: { lat: number; lng: number } | null = null
      const located = await requestDeviceLocation(6000)
      if (located.ok) position = located.point

      const known = myCategories ?? []
      return {
        uid: user.uid,
        displayName: profile.displayName,
        position,
        stats: {
          ip: profile.stats.ip,
          hours: profile.stats.hours,
          activitiesCompleted: profile.stats.activitiesCompleted,
          categoriesCount: profile.stats.categoriesCount,
        },
        isNewCategory: categoryId ? !known.includes(categoryId) : false,
      }
    },
    [user, profile, myCategories],
  )

  function showFailure(caught: unknown): void {
    const key: ScanErrorKey = caught instanceof ScanFailure ? caught.key : 'unknown'
    setError(t(`attendance:scanError.${key}`))
    setSuccess(null)
  }

  /** QR okundu. */
  const handleResult = useCallback(
    async (raw: string): Promise<void> => {
      setCameraOn(false)
      setError(null)
      setSuccess(null)

      const parsed = parseQrPayload(raw)
      if (!parsed) {
        setError(t('attendance:scanError.wrongCode'))
        return
      }

      // Çevrimdışıysa kuyruğa al ve kullanıcıya dürüstçe söyle.
      if (!isOnline()) {
        enqueueScan(raw)
        setSuccess(t('attendance:scan.offlineQueued'))
        return
      }

      setBusy(true)
      try {
        await sendScan(parsed, false)
        setSuccess(t('attendance:scan.success'))
      } catch (caught) {
        // Ağ hatasıysa kuyruğa al; kural reddiyse gerçek hatayı göster.
        if (caught instanceof ScanFailure) showFailure(caught)
        else {
          enqueueScan(raw)
          setSuccess(t('attendance:scan.offlineQueued'))
        }
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, buildContext],
  )

  /**
   * Tek bir taramayı gönderir; süresi geçmişse geç-onay yoluna düşer.
   *
   * Kategori bilgisi burada YOK: QR yalnız oturumu tanıtıyor, aktiviteyi
   * `submitScan` içeride okuyor. Kategori sayacı bu yüzden yalnız manuel
   * kod yolunda artıyor. Blaze açılınca `onAttendanceConfirmed` ikisini de
   * sunucuda doğru hesaplayacak (bkz. lib/passport.ts).
   */
  async function sendScan(scanned: ScannedCode, expired: boolean): Promise<void> {
    const context = await buildContext(null)
    if (expired) await submitLateScan(scanned, context)
    else await submitScan(scanned, context)
  }

  /** Manuel 6 haneli kod. */
  async function handleManual(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!manualActivity || manualCode.trim().length < 4) {
      setError(t('attendance:scanError.wrongCode'))
      return
    }

    setBusy(true)
    try {
      const activity = await fetchActivity(manualActivity)
      const context = await buildContext(activity?.categoryId ?? null)

      await submitManualCode(manualActivity, manualCode.trim(), context)
      setManualCode('')
      setSuccess(t('attendance:scan.success'))
    } catch (caught) {
      showFailure(caught)
    } finally {
      setBusy(false)
    }
  }

  /** Kuyruğu gönder. */
  const flush = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await flushQueue(async (scan, expired) => {
        const context = await buildContext(null)
        if (expired) await submitLateScan(scan, context)
        else await submitScan(scan, context)
      })
      if (result.sent + result.late > 0) {
        setSuccess(
          result.late > 0
            ? t('attendance:scan.successLate')
            : t('attendance:scan.queueSent', { count: result.sent }),
        )
      }
    } catch (caught) {
      console.error('[scan] Kuyruk gönderilemedi:', caught)
    } finally {
      setBusy(false)
    }
  }, [buildContext, t])

  // Bağlantı gelince kuyruğu kendiliğinden boşalt.
  useEffect(() => {
    function onOnline(): void {
      void flush()
    }
    window.addEventListener('online', onOnline)
    if (isOnline()) void flush()
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (myCategories === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('attendance:scan.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('attendance:scan.subtitle')}
        </p>
      </header>

      {success && <Alert tone="success">{success}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Çevrimdışı kuyruk göstergesi */}
      {queued > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="warning">⏳</Badge>
            <p className="text-sm font-medium">
              {t('attendance:scan.queueCount', { count: queued })}
            </p>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('attendance:scan.queueHint')}
          </p>
          <Button variant="secondary" loading={busy} onClick={() => void flush()}>
            {t('attendance:scan.queueSendNow')}
          </Button>
        </Card>
      )}

      {/* Kamera */}
      <Card className="space-y-3">
        {cameraOn && (
          <QrScanner
            active={cameraOn}
            onResult={(raw) => void handleResult(raw)}
            onStateChange={setCameraState}
            ariaLabel={t('attendance:scan.title')}
          />
        )}

        {cameraState === 'denied' && (
          <Alert tone="warning">{t('attendance:scan.cameraDenied')}</Alert>
        )}
        {cameraState === 'unavailable' && (
          <Alert tone="warning">{t('attendance:scan.cameraUnavailable')}</Alert>
        )}

        <Button full loading={busy} onClick={() => setCameraOn((value) => !value)}>
          {cameraOn
            ? t('attendance:scan.stopCamera')
            : `📷 ${t('attendance:scan.startCamera')}`}
        </Button>
      </Card>

      {/* Manuel kod */}
      <Card>
        <form className="space-y-4" onSubmit={(event) => void handleManual(event)}>
          <h2 className="text-base font-semibold">
            {t('attendance:scan.manualTitle')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:scan.manualHint')}
          </p>

          {nearby.length === 0 ? (
            <Alert tone="info">
              {t('attendance:scan.noUpcoming')}{' '}
              <Link to="/activities" className="underline">
                {t('common:nav.activities')}
              </Link>
            </Alert>
          ) : (
            <>
              <SelectField
                label={t('attendance:scan.manualActivity')}
                value={manualActivity}
                onChange={(event) => setManualActivity(event.target.value)}
              >
                {nearby.map((application) => (
                  <option key={application.activityId} value={application.activityId}>
                    {pickText(application.activityTitle, locale)}
                  </option>
                ))}
              </SelectField>

              <TextField
                label={t('attendance:scan.manualCode')}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={manualCode}
                onChange={(event) =>
                  setManualCode(event.target.value.replace(/\D/g, ''))
                }
                className="text-center font-mono text-2xl tracking-[0.4em]"
              />

              <Button type="submit" full loading={busy}>
                {busy
                  ? t('attendance:scan.sending')
                  : t('attendance:scan.manualSubmit')}
              </Button>
            </>
          )}
        </form>
      </Card>
    </div>
  )
}
