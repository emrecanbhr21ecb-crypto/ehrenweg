/**
 * Kurum / eğitmen yoklama ekranı — CLAUDE.md Bölüm 9, item 1.
 *
 * "Yoklamayı başlat" → tam ekranda her 30 saniyede bir değişen QR, altında
 * 6 haneli manuel kod ve canlı katılımcı sayacı → "Yoklamayı durdur".
 *
 * Ekran üç iş yapıyor:
 *   1. kodu döndürüyor (lib/attendance.ts `rotateCode`)
 *   2. gelen kayıtları canlı gösteriyor
 *   3. onaylı kayıtları pasaporta işliyor — `onAttendanceConfirmed`
 *      tetikleyicisinin Blaze'siz karşılığı (lib/passport.ts)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { QrCode } from '@/components/QrCode'
import {
  Alert,
  Badge,
  Button,
  Card,
  SelectField,
  Spinner,
  Switch,
  TextField,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { fetchActivity } from '@/lib/activities'
import {
  rotateCode,
  startAttendanceSession,
  stopAttendanceSession,
  watchSessionRecords,
  type RotatingCode,
} from '@/lib/attendance'
import { processPendingAwards } from '@/lib/passport'
import { formatTime } from '@/lib/format'
import {
  DEFAULT_GEO_RADIUS_METERS,
  DEFAULT_ROTATION_SECONDS,
  type AttendanceRecord,
  type AttendanceSession as Session,
} from '@/types/attendance'
import type { Activity } from '@/types/activity'
import type { Locale } from '@/config/brand'

const ROTATION_OPTIONS = [15, 30, 60, 120] as const

export default function AttendanceSession(): React.JSX.Element {
  const { activityId = '' } = useParams()
  const { t, i18n } = useTranslation(['attendance', 'manage', 'common'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user } = useAuth()

  const [activity, setActivity] = useState<Activity | null | undefined>(undefined)
  const [session, setSession] = useState<Session | null>(null)
  const [code, setCode] = useState<RotatingCode | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  const [rotationSeconds, setRotationSeconds] = useState<number>(
    DEFAULT_ROTATION_SECONDS,
  )
  const [requireGeo, setRequireGeo] = useState(false)
  const [geoRadius, setGeoRadius] = useState(DEFAULT_GEO_RADIUS_METERS)

  const [busy, setBusy] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Kod döndürme zamanlayıcısı; oturum kapanınca durdurulmalı.
  const rotationTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!activityId) return
    void fetchActivity(activityId)
      .then(setActivity)
      .catch(() => setActivity(null))
  }, [activityId])

  // Canlı katılımcı listesi.
  useEffect(() => {
    if (!session) return
    return watchSessionRecords(session.id, setRecords, (caught) => {
      console.error('[attendance] Kayıtlar okunamadı:', caught)
    })
  }, [session])

  const confirmed = useMemo(
    () => records.filter((record) => record.status === 'confirmed'),
    [records],
  )
  const pendingReview = useMemo(
    () => records.filter((record) => record.status === 'pending_review'),
    [records],
  )
  const pendingAward = useMemo(
    () => confirmed.filter((record) => !record.awarded),
    [confirmed],
  )

  // --- Kod döndürme --------------------------------------------------------

  const scheduleRotation = useCallback(
    (sessionId: string, seconds: number, manualCode: string) => {
      if (rotationTimer.current !== null) window.clearInterval(rotationTimer.current)

      rotationTimer.current = window.setInterval(() => {
        void rotateCode(sessionId, seconds, manualCode)
          .then((next) => {
            setCode(next)
            setSecondsLeft(seconds)
          })
          .catch((caught: unknown) => {
            console.error('[attendance] Kod döndürülemedi:', caught)
          })
      }, seconds * 1000)
    },
    [],
  )

  // Geri sayım — kullanıcı kodun ne zaman değişeceğini görsün.
  useEffect(() => {
    if (!code) return
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((code.expiresAtMs - Date.now()) / 1000)))
    }, 250)
    return () => window.clearInterval(timer)
  }, [code])

  useEffect(() => {
    return () => {
      if (rotationTimer.current !== null) window.clearInterval(rotationTimer.current)
    }
  }, [])

  async function start(): Promise<void> {
    if (!activity || !user) return
    setBusy(true)
    setError(null)
    try {
      const geoAvailable =
        activity.location.lat !== null && activity.location.lng !== null
      const result = await startAttendanceSession(
        {
          activityId: activity.id,
          orgId: activity.orgId,
          activityTitle: activity.title.de || activity.title.en,
          rotationSeconds,
          requireGeo: requireGeo && geoAvailable,
          geoRadiusMeters: geoRadius,
          geoLat: activity.location.lat,
          geoLng: activity.location.lng,
        },
        user.uid,
      )
      setSession(result.session)
      setCode(result.code)
      setSecondsLeft(result.session.rotationSeconds)
      scheduleRotation(
        result.session.id,
        result.session.rotationSeconds,
        result.code.manualCode,
      )
      setFullscreen(true)
    } catch (caught) {
      console.error('[attendance] Oturum başlatılamadı:', caught)
      setError(t('attendance:session.startFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function stop(): Promise<void> {
    if (!session) return
    if (!window.confirm(t('attendance:session.stopConfirm'))) return

    setBusy(true)
    try {
      if (rotationTimer.current !== null) window.clearInterval(rotationTimer.current)
      rotationTimer.current = null
      await stopAttendanceSession(session.id)
      // Kapanırken bekleyen puanları da yaz — personel ayrıca uğraşmasın.
      if (activity && user) {
        await processPendingAwards(activity, confirmed, user.uid)
      }
      setSession(null)
      setCode(null)
      setFullscreen(false)
      setNotice(t('attendance:session.stopped'))
    } catch (caught) {
      console.error('[attendance] Oturum durdurulamadı:', caught)
      setError(t('attendance:session.startFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function award(): Promise<void> {
    if (!activity || !user) return
    setBusy(true)
    setError(null)
    try {
      const result = await processPendingAwards(activity, confirmed, user.uid)
      setNotice(
        result.awarded > 0
          ? t('attendance:award.done', { count: result.awarded })
          : t('attendance:award.nothing'),
      )
      if (result.failed > 0) setError(t('attendance:award.failed'))
    } catch (caught) {
      console.error('[attendance] Puanlar yazılamadı:', caught)
      setError(t('attendance:award.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (activity === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  if (activity === null) {
    return <Alert tone="error">{t('attendance:scanError.activityMissing')}</Alert>
  }

  // --- Tam ekran QR --------------------------------------------------------

  if (fullscreen && session && code) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white p-4 dark:bg-ink-950">
        <p className="text-center text-lg font-semibold">{session.activityTitle}</p>

        <QrCode
          value={code.qrPayload}
          size={Math.min(360, Math.round(window.innerWidth * 0.8))}
          ariaLabel={t('attendance:session.qrLabel')}
        />

        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t('attendance:session.manualCodeLabel')}
          </p>
          <p className="font-mono text-4xl font-bold tabular-nums tracking-[0.3em]">
            {code.manualCode}
          </p>
          <p className="mt-1 text-xs text-gray-500" aria-live="off">
            {t('attendance:session.expiresIn', { seconds: secondsLeft })}
          </p>
        </div>

        <div
          className="rounded-2xl bg-primary-700 px-6 py-3 text-center text-white"
          aria-live="polite"
        >
          <span className="text-3xl font-bold tabular-nums">{confirmed.length}</span>
          <span className="ms-2 text-sm">
            {t('attendance:session.counter', { count: confirmed.length })}
          </span>
        </div>

        <p className="max-w-xs text-center text-xs text-gray-500">
          {t('attendance:session.keepScreenOn')}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => setFullscreen(false)}>
            {t('attendance:session.exitFullscreen')}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void stop()}>
            {t('attendance:session.stop')}
          </Button>
        </div>
      </div>
    )
  }

  // --- Normal ekran --------------------------------------------------------

  const geoAvailable = activity.location.lat !== null && activity.location.lng !== null

  return (
    <div className="space-y-5">
      <Link to="/org" className="text-sm underline">
        ← {t('manage:org.title')}
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{t('attendance:session.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {activity.title.de || activity.title.en}
        </p>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!session ? (
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">
            {t('attendance:session.startTitle')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:session.startHint', { seconds: rotationSeconds })}
          </p>

          <SelectField
            label={t('attendance:session.rotationSeconds')}
            value={String(rotationSeconds)}
            onChange={(event) => setRotationSeconds(Number(event.target.value))}
          >
            {ROTATION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          {/* item 3: opsiyonel GPS kontrolü, yarıçapı ayarlanabilir */}
          <Switch
            checked={requireGeo && geoAvailable}
            disabled={!geoAvailable}
            onChange={setRequireGeo}
            label={t('attendance:session.requireGeo')}
            hint={
              geoAvailable
                ? t('attendance:session.requireGeoHint')
                : t('attendance:session.geoMissing')
            }
          />

          {requireGeo && geoAvailable && (
            <TextField
              label={t('attendance:session.geoRadius')}
              type="number"
              min={50}
              max={5000}
              step={50}
              value={geoRadius}
              onChange={(event) => setGeoRadius(Number(event.target.value))}
            />
          )}

          <Button full loading={busy} onClick={() => void start()}>
            ▶ {t('attendance:session.start')}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{t('attendance:session.running')}</Badge>
            <Badge tone="info">
              {t('attendance:session.counter', { count: confirmed.length })}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setFullscreen(true)}>
              {t('attendance:session.fullscreen')}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void stop()}>
              {t('attendance:session.stop')}
            </Button>
          </div>
        </Card>
      )}

      {/* Puanlama — onAttendanceConfirmed'in elle karşılığı */}
      {pendingAward.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">{t('attendance:award.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:award.hint')}
          </p>
          <Badge tone="warning">
            {t('attendance:award.pending', { count: pendingAward.length })}
          </Badge>
          <Button loading={busy} onClick={() => void award()}>
            {busy ? t('attendance:award.running') : t('attendance:award.run')}
          </Button>
        </Card>
      )}

      {/* Canlı liste */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('attendance:session.liveList')}</h2>
        {confirmed.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:session.empty')}
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="px-5">
              {confirmed.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-2 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{record.displayName}</p>
                    <p className="text-xs text-gray-500">
                      {t(`attendance:review.method.${record.method}`)}
                      {record.scannedAt &&
                        ` · ${formatTime(record.scannedAt.toDate(), locale)}`}
                    </p>
                  </div>
                  {record.awarded && <Badge tone="success">✓</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* item 4: geç / çevrimdışı taramalar */}
      {pendingReview.length > 0 && (
        <Link to={`/org/activities/${activityId}/late-scans`}>
          <Button variant="secondary" full>
            {t('attendance:review.title')} ({pendingReview.length})
          </Button>
        </Link>
      )}
    </div>
  )
}
