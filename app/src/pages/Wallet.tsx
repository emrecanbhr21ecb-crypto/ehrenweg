/**
 * Wallet — CLAUDE.md Bölüm 9 ve Bölüm 7.2/7.4.
 *
 * IP bakiyesi, ödül mağazası, kuponlarım (aktif / kullanıldı / süresi doldu),
 * kupon detayında 60 saniyede yenilenen imzalı QR.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QrCode } from '@/components/QrCode'
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { formatDate, formatDateTime } from '@/lib/format'
import {
  buyReward,
  watchMyLedger,
  watchMyVouchers,
  watchShopTemplates,
} from '@/lib/rewards'
import { refreshVoucherToken, type VoucherToken } from '@/lib/voucherQr'
import { pickText } from '@/types/activity'
import {
  RewardFailure,
  VOUCHER_QR_TTL_SECONDS,
  canIssue,
  effectiveVoucherStatus,
  formatCents,
  remainingBudgetCents,
  type LedgerEntry,
  type RewardErrorKey,
  type RewardTemplate,
  type Voucher,
  type VoucherStatus,
} from '@/types/reward'
import type { Locale } from '@/config/brand'

type Tab = 'shop' | 'vouchers' | 'history'

const STATUS_TONE: Record<VoucherStatus, 'success' | 'neutral' | 'warning' | 'danger'> =
  {
    issued: 'success',
    redeemed: 'neutral',
    expired: 'warning',
    revoked: 'danger',
  }

// ---------------------------------------------------------------------------

/** Kupon QR'ı — 60 saniyede bir kendini yeniler (CLAUDE.md Bölüm 7.4). */
function VoucherQr({ voucher }: { voucher: Voucher }): React.JSX.Element {
  const { t, i18n } = useTranslation('wallet')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const [token, setToken] = useState<VoucherToken | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [failed, setFailed] = useState(false)

  // Token'ı üret ve TTL dolmadan hemen önce yenile. Bileşen kapanınca
  // zamanlayıcı durur — arka planda boşuna yazma yapılmaz.
  useEffect(() => {
    let cancelled = false

    async function rotate(): Promise<void> {
      try {
        const next = await refreshVoucherToken(voucher.id)
        if (cancelled) return
        setToken(next)
        setFailed(false)
      } catch (error) {
        console.error('[wallet] QR token yazılamadı:', error)
        if (!cancelled) setFailed(true)
      }
    }

    void rotate()
    const timer = window.setInterval(
      () => void rotate(),
      VOUCHER_QR_TTL_SECONDS * 1000 - 3000,
    )
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [voucher.id])

  useEffect(() => {
    if (!token) return
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((token.expiresAtMs - Date.now()) / 1000)))
    }, 250)
    return () => window.clearInterval(timer)
  }, [token])

  if (failed) return <Alert tone="error">{t('voucher.qrFailed')}</Alert>
  if (!token) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <QrCode
        value={token.payload}
        size={240}
        ariaLabel={t('voucher.qrLabel')}
        className="rounded-2xl bg-white p-2"
      />

      <p className="text-xs text-gray-500" aria-live="off">
        {t('voucher.qrRefresh', { seconds: secondsLeft })}
      </p>

      {/* Bölüm 7.4: veznenin kimlik eşleştirmesi için ad + fotoğraf */}
      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-ink-800">
        {voucher.holderPhotoURL ? (
          <img
            src={voucher.holderPhotoURL}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-xl dark:bg-primary-950"
          >
            👤
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{voucher.holderName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('voucher.identityHint')}
          </p>
        </div>
      </div>

      <p className="max-w-xs text-center text-xs text-gray-500 dark:text-gray-400">
        {t('voucher.qrHint', { seconds: VOUCHER_QR_TTL_SECONDS })}
      </p>

      <p className="text-[11px] text-gray-400">
        {formatDateTime(voucher.expiresAt.toDate(), locale)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function VoucherCard({ voucher }: { voucher: Voucher }): React.JSX.Element {
  const { t, i18n } = useTranslation('wallet')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const [open, setOpen] = useState(false)

  const status = effectiveVoucherStatus(voucher)
  const redeemable = status === 'issued'

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{pickText(voucher.title, locale)}</p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {voucher.kind === 'discount'
              ? t('voucher.discountValue', { percent: voucher.discountPercent })
              : formatCents(voucher.valueCents, locale)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[status]}>{t(`voucher.status.${status}`)}</Badge>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {status === 'redeemed' && voucher.redeemedAt
          ? t('voucher.redeemedOn', {
              date: formatDate(voucher.redeemedAt.toDate(), locale),
            })
          : t('voucher.validUntil', {
              date: formatDate(voucher.expiresAt.toDate(), locale),
            })}
      </p>

      {redeemable ? (
        <>
          <Button
            variant={open ? 'secondary' : 'primary'}
            onClick={() => setOpen(!open)}
          >
            {open ? t('form.cancel') : `▣ ${t('voucher.showQr')}`}
          </Button>
          {open && <VoucherQr voucher={voucher} />}
        </>
      ) : (
        <p className="text-xs text-gray-500">{t('voucher.notRedeemable')}</p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------

function ShopCard({
  template,
  balance,
  onBuy,
  busy,
}: {
  template: RewardTemplate
  balance: number
  onBuy: (template: RewardTemplate) => void
  busy: boolean
}): React.JSX.Element {
  const { t, i18n } = useTranslation('wallet')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale

  const available = canIssue(template)
  const affordable = balance >= template.costIp
  const remaining = remainingBudgetCents(template)

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{pickText(template.title, locale)}</p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {template.kind === 'discount'
              ? t('voucher.discountValue', { percent: template.discountPercent })
              : formatCents(template.valueCents, locale)}
          </p>
        </div>
        <Badge tone="info">{t(`kind.${template.kind}`)}</Badge>
      </div>

      {pickText(template.description, locale) && (
        <p className="text-sm">{pickText(template.description, locale)}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge tone={affordable ? 'success' : 'neutral'}>
          {t('shop.cost', { count: template.costIp })}
        </Badge>
        <Badge tone="neutral">
          {t('shop.valid', { count: template.validityDays })}
        </Badge>
        <Badge tone="neutral">
          {t('shop.limitPerMonth', { count: template.maxPerUserPerMonth })}
        </Badge>
        {remaining !== null && template.valueCents > 0 && (
          <Badge tone={available ? 'neutral' : 'danger'}>
            {available
              ? t('shop.remaining', {
                  count: Math.floor(remaining / Math.max(1, template.valueCents)),
                })
              : t('shop.soldOut')}
          </Badge>
        )}
      </div>

      <Button
        full
        loading={busy}
        disabled={!available || !affordable}
        onClick={() => onBuy(template)}
      >
        {t('shop.buy')}
      </Button>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export default function Wallet(): React.JSX.Element {
  const { t, i18n } = useTranslation(['wallet', 'common'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, profile } = useAuth()

  const [tab, setTab] = useState<Tab>('shop')
  const [templates, setTemplates] = useState<RewardTemplate[] | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])

  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    return watchShopTemplates(setTemplates, (caught) => {
      console.error('[wallet] Mağaza okunamadı:', caught)
      setTemplates([])
    })
  }, [])

  useEffect(() => {
    if (!user) return
    return watchMyVouchers(user.uid, setVouchers, (caught) => {
      console.error('[wallet] Kuponlar okunamadı:', caught)
      setVouchers([])
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    return watchMyLedger(user.uid, setLedger, (caught) =>
      console.error('[wallet] Defter okunamadı:', caught),
    )
  }, [user])

  const balance = profile?.stats.ip ?? 0

  const sortedVouchers = useMemo(() => {
    if (!vouchers) return []
    // Kullanılabilir olanlar önce: kullanıcı veznede kuponunu ararken
    // ölü kuponların arasında kaybolmasın.
    const rank = (voucher: Voucher): number =>
      effectiveVoucherStatus(voucher) === 'issued' ? 0 : 1
    return [...vouchers].sort((a, b) => rank(a) - rank(b))
  }, [vouchers])

  async function handleBuy(template: RewardTemplate): Promise<void> {
    if (!user || !profile) return

    const confirmed = window.confirm(
      t('wallet:shop.confirm', {
        cost: template.costIp,
        title: pickText(template.title, locale),
      }),
    )
    if (!confirmed) return

    setBusyId(template.id)
    setError(null)
    setNotice(null)
    try {
      await buyReward(template, {
        uid: user.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        ip: balance,
      })
      setNotice(t('wallet:shop.success'))
      setTab('vouchers')
    } catch (caught) {
      console.error('[wallet] Ödül alınamadı:', caught)
      const key: RewardErrorKey =
        caught instanceof RewardFailure ? caught.key : 'unknown'
      setError(t(`wallet:rewardError.${key}`))
    } finally {
      setBusyId(null)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'shop', label: t('wallet:wallet.tabShop') },
    { id: 'vouchers', label: t('wallet:wallet.tabVouchers') },
    { id: 'history', label: t('wallet:wallet.tabHistory') },
  ]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('wallet:wallet.title')}</h1>
      </header>

      <Card className="text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('wallet:wallet.balance')}
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-primary-800 dark:text-primary-200">
          {balance}
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('wallet:wallet.balanceHint')}
        </p>
      </Card>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-ink-800">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={tab === entry.id ? 'page' : undefined}
            onClick={() => setTab(entry.id)}
            className={[
              'min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium',
              tab === entry.id
                ? 'border-primary-700 text-primary-800 dark:text-primary-200'
                : 'border-transparent text-gray-500 dark:text-gray-400',
            ].join(' ')}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === 'shop' &&
        (templates === null ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-8 text-primary-700" />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            emoji="🎁"
            title={t('wallet:shop.title')}
            body={t('wallet:shop.empty')}
          />
        ) : (
          <ul className="space-y-4">
            {templates.map((template) => (
              <li key={template.id}>
                <ShopCard
                  template={template}
                  balance={balance}
                  busy={busyId === template.id}
                  onBuy={(value) => void handleBuy(value)}
                />
              </li>
            ))}
          </ul>
        ))}

      {tab === 'vouchers' &&
        (vouchers === null ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-8 text-primary-700" />
          </div>
        ) : vouchers.length === 0 ? (
          <EmptyState
            emoji="🎫"
            title={t('wallet:voucher.title')}
            body={t('wallet:voucher.empty')}
            action={
              <Button variant="secondary" onClick={() => setTab('shop')}>
                {t('wallet:voucher.browseShop')}
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {sortedVouchers.map((voucher) => (
              <li key={voucher.id}>
                <VoucherCard voucher={voucher} />
              </li>
            ))}
          </ul>
        ))}

      {tab === 'history' &&
        (ledger.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('wallet:history.empty')}
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="px-5">
              {ledger.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{t(`wallet:history.type.${entry.type}`)}</p>
                    {entry.createdAt && (
                      <p className="text-xs text-gray-500">
                        {formatDate(entry.createdAt.toDate(), locale)}
                      </p>
                    )}
                  </div>
                  <p
                    className={[
                      'shrink-0 text-sm font-semibold tabular-nums',
                      entry.amount >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-gray-600 dark:text-gray-400',
                    ].join(' ')}
                  >
                    {entry.amount >= 0 ? '+' : ''}
                    {entry.currency === 'IP'
                      ? entry.amount
                      : formatCents(entry.amount, locale)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  )
}
