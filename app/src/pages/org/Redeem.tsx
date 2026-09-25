/**
 * Vezne / partner ekranı — CLAUDE.md Bölüm 9 ve Bölüm 7.4.
 *
 * "Kupon tara → sonuç (geçerli/geçersiz, tutar, kullanıcı adı ve profil
 *  fotoğrafı ile kimlik eşleştirme), günlük kullanım listesi."
 *
 * ⚠️ Uygulama ÖDEME YAPMAZ. Yalnız "vezne şu tutarı ödedi" kaydını tutar;
 * gerçek ödeme kurumun kendi süreciyle olur (Bölüm 7.4). Ekranda bu açıkça
 * yazıyor — vezne görevlisi uygulamanın para gönderdiğini sanmamalı.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QrScanner } from '@/components/QrScanner'
import { Alert, Badge, Button, Card, TextField } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { formatTime } from '@/lib/format'
import { fetchVoucher } from '@/lib/rewards'
import {
  fetchTodaysRedemptions,
  inspectVoucherQr,
  redeemVoucher,
} from '@/lib/redemption'
import { pickText } from '@/types/activity'
import {
  RedeemFailure,
  buildVoucherQr,
  formatCents,
  type RedeemErrorKey,
  type ScannedVoucher,
  type Voucher,
} from '@/types/reward'
import type { Locale } from '@/config/brand'

export function OrgRedeem({ orgId }: { orgId: string }): React.JSX.Element {
  const { t, i18n } = useTranslation('wallet')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, orgRoles } = useAuth()

  const [scanning, setScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [pending, setPending] = useState<{
    voucher: Voucher
    scanned: ScannedVoucher
  } | null>(null)
  const [today, setToday] = useState<Voucher[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const orgIds = useMemo(() => Object.keys(orgRoles), [orgRoles])

  const reloadToday = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      setToday(await fetchTodaysRedemptions(user.uid))
    } catch (caught) {
      console.error('[redeem] Günlük liste okunamadı:', caught)
    }
  }, [user])

  useEffect(() => {
    void reloadToday()
  }, [reloadToday])

  function showFailure(caught: unknown): void {
    const key: RedeemErrorKey = caught instanceof RedeemFailure ? caught.key : 'unknown'
    setError(t(`redeemError.${key}`))
    setPending(null)
  }

  async function inspect(raw: string): Promise<void> {
    if (!user) return
    setScanning(false)
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      setPending(await inspectVoucherQr(raw, { actorUid: user.uid, orgIds }))
    } catch (caught) {
      showFailure(caught)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Kupon numarasıyla arama — QR okunamadığında.
   *
   * Numara tek başına kuponu KULLANDIRMAZ: kullanım kuralı okunamayan
   * token belgesindeki nonce'u arıyor. Yani kişi telefonunda QR'ı açmak
   * zorunda; numara yalnız "hangi kupon" sorusunu cevaplıyor.
   */
  async function inspectById(): Promise<void> {
    if (!user || !manualId.trim()) return
    setError(null)
    setBusy(true)
    try {
      const voucher = await fetchVoucher(manualId.trim())
      if (!voucher) throw new RedeemFailure('notFound')
      await inspect(
        buildVoucherQr({
          voucherId: voucher.id,
          expiresAtMs: Date.now() + 60_000,
          signature: 'manual-lookup',
        }),
      )
    } catch (caught) {
      showFailure(caught)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(): Promise<void> {
    if (!user || !pending) return
    setBusy(true)
    setError(null)
    try {
      await redeemVoucher(
        pending.voucher,
        pending.scanned,
        { actorUid: user.uid, orgIds },
        orgId,
      )
      setNotice(t('redeem.done'))
      setPending(null)
      await reloadToday()
    } catch (caught) {
      console.error('[redeem] Kullanım kaydedilemedi:', caught)
      showFailure(caught)
    } finally {
      setBusy(false)
    }
  }

  const todayTotal = today.reduce((sum, voucher) => sum + voucher.valueCents, 0)

  if (orgIds.length === 0) {
    return <Alert tone="info">{t('redeem.noAccess')}</Alert>
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('redeem.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('redeem.subtitle')}
        </p>
      </header>

      {/* Bölüm 7.4: uygulama ödeme yapmaz — vezne bunu bilmeli. */}
      <Alert tone="info">{t('redeem.notice')}</Alert>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {pending ? (
        <Card className="space-y-4">
          <Badge tone="success">{t('redeem.valid')}</Badge>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('redeem.amount')}
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {pending.voucher.kind === 'discount'
                ? `${pending.voucher.discountPercent} %`
                : formatCents(pending.voucher.valueCents, locale)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {pickText(pending.voucher.title, locale)}
            </p>
          </div>

          {/* Kimlik eşleştirme — ad + fotoğraf */}
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-ink-800">
            {pending.voucher.holderPhotoURL ? (
              <img
                src={pending.voucher.holderPhotoURL}
                alt=""
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-full bg-primary-100 text-2xl dark:bg-primary-950"
              >
                👤
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {t('redeem.holder')}
              </p>
              <p className="font-semibold">{pending.voucher.holderName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('redeem.holderHint')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void confirm()}>
              {busy ? t('redeem.confirming') : t('redeem.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('form.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3">
          {scanning && (
            <QrScanner
              active={scanning}
              onResult={(raw) => void inspect(raw)}
              ariaLabel={t('redeem.scan')}
            />
          )}

          <Button full loading={busy} onClick={() => setScanning(!scanning)}>
            {scanning ? t('redeem.stopScan') : `📷 ${t('redeem.scan')}`}
          </Button>

          <TextField
            label={t('redeem.manualId')}
            value={manualId}
            onChange={(event) => setManualId(event.target.value)}
          />
          <Button variant="secondary" loading={busy} onClick={() => void inspectById()}>
            {t('redeem.check')}
          </Button>
        </Card>
      )}

      <section className="space-y-2">
        <h3 className="text-base font-semibold">{t('redeem.todayTitle')}</h3>

        {today.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('redeem.todayEmpty')}
          </Card>
        ) : (
          <>
            <Card className="p-0">
              <ul className="px-5">
                {today.map((voucher) => (
                  <li
                    key={voucher.id}
                    className="flex items-center justify-between gap-2 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {voucher.holderName}
                      </p>
                      {voucher.redeemedAt && (
                        <p className="text-xs text-gray-500">
                          {formatTime(voucher.redeemedAt.toDate(), locale)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCents(voucher.valueCents, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
            <p className="text-sm font-medium">
              {t('redeem.todayTotal', { amount: formatCents(todayTotal, locale) })}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
