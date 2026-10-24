/**
 * Kurum analitiği — CLAUDE.md Bölüm 9 (`orgMonthlyReport` karşılığı).
 *
 * PDF için kütüphane yok, tarayıcının yazdırma penceresi kullanılıyor
 * (bkz. lib/reconciliation.ts gerekçesi, styles/theme.css `.print-area`).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Card, Spinner } from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { watchOrgActivities } from '@/lib/activities'
import {
  computeOrgAnalytics,
  fetchOrgPassportEntries,
  fetchOrgVouchers,
  type OrgAnalytics,
} from '@/lib/orgAnalytics'
import type { Organization } from '@/types/activity'
import { formatCents } from '@/types/reward'
import type { Locale } from '@/config/brand'

function StatTile({
  label,
  value,
}: {
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-ink-800/60">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  )
}

export function OrgAnalyticsPanel({
  organization,
}: {
  organization: Organization
}): React.JSX.Element {
  const { t, i18n } = useTranslation(['manage', 'catalog'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribed = false
    const stop = watchOrgActivities(
      organization.id,
      (activities) => {
        void Promise.all([
          fetchOrgPassportEntries(organization.id),
          fetchOrgVouchers(organization.id),
        ])
          .then(([entries, vouchers]) => {
            if (unsubscribed) return
            setAnalytics(computeOrgAnalytics(activities, entries, vouchers))
            setError(null)
          })
          .catch((caught: unknown) => {
            console.error('[analytics] Hesaplanamadı:', caught)
            if (!unsubscribed) setError(t('manage:analytics.loadFailed'))
          })
      },
      (caught) => {
        console.error('[analytics] Aktiviteler okunamadı:', caught)
        setError(t('manage:analytics.loadFailed'))
      },
    )
    return () => {
      unsubscribed = true
      stop()
    }
  }, [organization.id, t])

  if (!analytics) {
    return (
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="print:hidden">
        <h2 className="text-lg font-semibold">{t('manage:analytics.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('manage:analytics.subtitle')}
        </p>
      </header>

      <div className="print-area space-y-5">
        <p className="hidden text-lg font-bold print:block">
          {organization.name} — {t('manage:analytics.title')}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={t('manage:analytics.applications')}
            value={String(analytics.totalApplications)}
          />
          <StatTile
            label={t('manage:analytics.attendances')}
            value={String(analytics.totalAttendances)}
          />
          <StatTile
            label={t('manage:analytics.rate')}
            value={
              analytics.attendanceRate === null
                ? '—'
                : `${Math.round(analytics.attendanceRate * 100)}%`
            }
          />
          <StatTile
            label={t('manage:analytics.participants')}
            value={String(analytics.distinctParticipants)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label={t('manage:analytics.ipAwarded')}
            value={String(analytics.totalIpAwarded)}
          />
          <StatTile
            label={t('manage:analytics.vouchersValue')}
            value={`${analytics.vouchersIssued} · ${formatCents(analytics.vouchersValueCents, locale)}`}
          />
        </div>

        {analytics.byCategory.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              {t('manage:analytics.byCategory')}
            </h3>
            <Card className="space-y-2">
              {analytics.byCategory.map((row) => (
                <div
                  key={row.categoryId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    <span aria-hidden="true" className="me-1">
                      {CATEGORY_META[row.categoryId].emoji}
                    </span>
                    {t(`catalog:categories.${row.categoryId}`)}
                  </span>
                  <span className="tabular-nums text-gray-600 dark:text-gray-400">
                    {row.count} · {Math.round(row.hours)} h
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {analytics.topActivities.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              {t('manage:analytics.topActivities')}
            </h3>
            <Card className="p-0">
              <ul className="px-5">
                {analytics.topActivities.map((row) => (
                  <li
                    key={row.activityId}
                    className="flex items-center justify-between gap-2 border-t border-gray-100 py-2.5 text-sm first:border-t-0 dark:border-ink-800"
                  >
                    <span className="truncate">{row.title}</span>
                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                      {row.attendances}/{row.applicants || '–'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>

      <div className="print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          🖨 {t('manage:analytics.print')}
        </Button>
      </div>
    </div>
  )
}
