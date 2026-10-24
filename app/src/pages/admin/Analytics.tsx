/**
 * Platform admin — sistem geneli istatistik + şüpheli işlem panosu
 * (CLAUDE.md Bölüm 9, Faz 7). Hesap mantığı `lib/adminAnalytics.ts`te.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Card, Spinner } from '@/components/ui'
import {
  fetchFraudSignals,
  fetchSystemStats,
  type FraudSignal,
  type SystemStats,
} from '@/lib/adminAnalytics'

function Tile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-ink-800/60">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  )
}

export function SystemStatsPanel(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchSystemStats()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch((caught: unknown) => {
        console.error('[admin] Sistem istatistiği okunamadı:', caught)
        if (!cancelled) setError(t('systemStats.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('systemStats.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('systemStats.subtitle')}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {!stats ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label={t('systemStats.users')} value={String(stats.users)} />
          <Tile
            label={t('systemStats.organisations')}
            value={`${stats.organisations} (${stats.verifiedOrganisations} ${t('systemStats.verifiedOrganisations')})`}
          />
          <Tile
            label={t('systemStats.activities')}
            value={`${stats.activities} (${stats.publishedActivities} ${t('systemStats.publishedActivities')})`}
          />
          <Tile
            label={t('systemStats.participations')}
            value={String(stats.participations)}
          />
          <Tile label={t('systemStats.ipAwarded')} value={String(stats.ipAwarded)} />
        </div>
      )}
    </div>
  )
}

export function FraudSignalsPanel(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const [signals, setSignals] = useState<FraudSignal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchFraudSignals()
      .then((result) => {
        if (!cancelled) setSignals(result)
      })
      .catch((caught: unknown) => {
        console.error('[admin] Şüpheli işlemler hesaplanamadı:', caught)
        if (!cancelled) setError(t('fraud.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('fraud.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('fraud.subtitle')}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {!signals ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      ) : signals.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('fraud.empty')}
        </Card>
      ) : (
        <ul className="space-y-2">
          {signals.map((signal, index) => (
            <li key={index}>
              <Card className="space-y-1">
                {signal.kind === 'highAcceptRate' ? (
                  <>
                    <p className="text-sm font-semibold">
                      {t('fraud.highAcceptRateTitle')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('fraud.highAcceptRateBody', {
                        org: signal.orgName,
                        rate: Math.round(signal.rate * 100),
                        count: signal.total,
                        avg: Math.round((signal.rate - 0.3) * 100),
                      })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{t('fraud.nearCapTitle')}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('fraud.nearCapBody', {
                        uid: signal.uid,
                        count: signal.count,
                        limit: signal.cap,
                        org: signal.orgName || signal.orgId,
                      })}
                    </p>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
