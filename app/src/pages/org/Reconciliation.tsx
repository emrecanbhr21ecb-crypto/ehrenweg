/**
 * Kurum paneli — aylık mutabakat raporu (CLAUDE.md Bölüm 7.4).
 *
 * "verilen, kullanılan, süresi dolan kuponlar ve kalan bütçe"
 * CSV indirilir; PDF için tarayıcının yazdırma penceresi kullanılır
 * (gerekçe: lib/reconciliation.ts).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Card, Spinner } from '@/components/ui'
import { fetchOrgVouchers, watchOrgTemplates } from '@/lib/rewards'
import {
  buildReconciliation,
  downloadCsv,
  type ReconciliationReport,
} from '@/lib/reconciliation'
import { formatCents, type RewardTemplate, type Voucher } from '@/types/reward'
import type { Organization } from '@/types/activity'
import type { Locale } from '@/config/brand'

export function OrgReconciliation({
  organization,
}: {
  organization: Organization
}): React.JSX.Element {
  const { t, i18n } = useTranslation('wallet')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const [templates, setTemplates] = useState<RewardTemplate[]>([])
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return watchOrgTemplates(organization.id, setTemplates, (caught) => {
      console.error('[report] Şablonlar okunamadı:', caught)
    })
  }, [organization.id])

  useEffect(() => {
    void fetchOrgVouchers(organization.id)
      .then(setVouchers)
      .catch((caught: unknown) => {
        console.error('[report] Kuponlar okunamadı:', caught)
        setError(t('report.loadFailed'))
        setVouchers([])
      })
  }, [organization.id, t])

  if (vouchers === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  const report: ReconciliationReport = buildReconciliation(vouchers, templates)
  const money = (cents: number): string => formatCents(cents, locale)

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('report.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('report.subtitle')}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('report.budgetTotal'), value: report.budgetTotalCents },
          { label: t('report.budgetSpent'), value: report.budgetSpentCents },
          { label: t('report.budgetFree'), value: report.budgetRemainingCents },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-ink-800/60"
          >
            <p className="text-sm font-bold tabular-nums">{money(tile.value)}</p>
            <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      {report.rows.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('report.empty')}
        </Card>
      ) : (
        <>
          {/* Geniş tablo kendi içinde kaysın; sayfa yatay kaymamalı. */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-ink-800">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-gray-50 text-left dark:bg-ink-800/60">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t('report.month')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t('report.issued')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t('report.redeemed')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t('report.expired')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.month}
                    className="border-t border-gray-100 dark:border-ink-800"
                  >
                    <th scope="row" className="px-3 py-2 text-start font-normal">
                      {row.month}
                    </th>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {row.issuedCount} · {money(row.issuedCents)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {row.redeemedCount} · {money(row.redeemedCents)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {row.expiredCount} · {money(row.expiredCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold dark:border-ink-700">
                  <th scope="row" className="px-3 py-2 text-start">
                    {t('report.total')}
                  </th>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {report.totals.issuedCount} · {money(report.totals.issuedCents)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {report.totals.redeemedCount} · {money(report.totals.redeemedCents)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {report.totals.expiredCount} · {money(report.totals.expiredCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="secondary"
              onClick={() => downloadCsv(report, organization.name)}
            >
              ⤓ {t('report.downloadCsv')}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              🖨 {t('report.print')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
