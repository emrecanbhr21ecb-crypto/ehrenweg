/**
 * Ödüller, kuponlar ve defter — CLAUDE.md Bölüm 5 ve Bölüm 7.
 *
 * Bölüm 7 bu fazın anayasası: "Bu bölüm gerçek para içerdiği için güvenlik ve
 * denetlenebilirlik birinci öncelik."
 *
 * Para tutarları **her yerde tamsayı sent** olarak taşınır. Kayan noktalı
 * euro (12.34) ile toplama yapmak muhasebeyi kuruş kuruş kaydırır; mutabakat
 * raporu da bu yüzden hiçbir zaman tutmazdı.
 */

import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

import type { LocalizedText } from '@/types/activity'

// --- Ödül şablonu ----------------------------------------------------------

/**
 * Ödül türleri (CLAUDE.md Bölüm 5 `rewardTemplates.kind`).
 *
 * `cash_voucher` diğerlerinden farklıdır: gerçek para. Bölüm 10'daki hukuki
 * not yüzünden kurum bazında kapalıdır ve yalnız platform admin açabilir.
 */
export const REWARD_KINDS = [
  'integration_points',
  'gift_voucher',
  'discount',
  'cash_voucher',
] as const
export type RewardKind = (typeof REWARD_KINDS)[number]

/** Parasal karşılığı olan türler — bütçeden düşer. */
export function isMonetary(kind: RewardKind): boolean {
  return kind === 'gift_voucher' || kind === 'cash_voucher'
}

export interface RewardTemplate {
  id: string
  orgId: string
  kind: RewardKind
  title: LocalizedText
  description: LocalizedText

  /** Hediye/parasal kuponun değeri (sent). İndirimde kullanılmaz. */
  valueCents: number
  /** İndirim yüzdesi (kind === 'discount'). */
  discountPercent: number
  /** İndirimi veren işletme — kafe/mağaza. */
  partnerOrgId: string | null

  /** Ödül mağazasında kaç IP'ye satılıyor. 0 = IP ile alınamaz (otomatik verilir). */
  costIp: number
  validityDays: number

  /**
   * Toplam bütçe (sent). `null` = bütçesiz (yalnız IP ödülleri için).
   * Bütçe AŞILAMAZ — Firestore kuralı her kupon basımında kontrol eder.
   */
  totalBudgetCents: number | null
  /** Sunucu alanı: şimdiye kadar basılan kuponların toplam değeri. */
  spentCents: number
  /** Sunucu alanı. */
  issuedCount: number

  /** Suistimal önlemi (Bölüm 7.5): kişi başı aylık üst sınır. */
  maxPerUserPerMonth: number

  active: boolean
  createdAt: Timestamp | null
  createdBy: string
  seed?: boolean
}

export const MAX_VALUE_CENTS = 50_000 // 500 €
export const MAX_COST_IP = 10_000

export const rewardTemplateSchema = z
  .object({
    kind: z.enum(REWARD_KINDS),
    titleDe: z.string().trim().max(120),
    titleEn: z.string().trim().max(120),
    descriptionDe: z.string().trim().max(600),
    descriptionEn: z.string().trim().max(600),
    valueCents: z.number().int().min(0).max(MAX_VALUE_CENTS, 'validation.valueRange'),
    discountPercent: z.number().int().min(0).max(100),
    partnerOrgId: z.string().trim().max(64),
    costIp: z.number().int().min(0).max(MAX_COST_IP, 'validation.costRange'),
    validityDays: z.number().int().min(1, 'validation.validityRange').max(730),
    totalBudgetCents: z.number().int().min(0).max(100_000_000).nullable(),
    maxPerUserPerMonth: z.number().int().min(1).max(50),
    active: z.boolean(),
  })
  .refine((v) => v.titleDe.trim() !== '' || v.titleEn.trim() !== '', {
    message: 'validation.titleRequired',
    path: ['titleDe'],
  })
  // Parasal ödülün değeri olmalı; değersiz bir hediye kuponu veznede
  // "ne kadar ödeyeceğim" sorusunu cevapsız bırakır.
  .refine((v) => !isMonetary(v.kind) || v.valueCents > 0, {
    message: 'validation.valueRequired',
    path: ['valueCents'],
  })
  .refine((v) => v.kind !== 'discount' || v.discountPercent > 0, {
    message: 'validation.discountRequired',
    path: ['discountPercent'],
  })
  // Parasal ödül bütçesiz olamaz: bütçe, sistemdeki tek gerçek tavan.
  .refine((v) => !isMonetary(v.kind) || (v.totalBudgetCents ?? 0) > 0, {
    message: 'validation.budgetRequired',
    path: ['totalBudgetCents'],
  })

export type RewardTemplateForm = z.infer<typeof rewardTemplateSchema>

/** Şablondan kaç kupon daha basılabilir (bütçeye göre). */
export function remainingBudgetCents(template: RewardTemplate): number | null {
  if (template.totalBudgetCents === null) return null
  return Math.max(0, template.totalBudgetCents - template.spentCents)
}

export function canIssue(template: RewardTemplate): boolean {
  if (!template.active) return false
  const remaining = remainingBudgetCents(template)
  if (remaining === null) return true
  return remaining >= template.valueCents
}

// --- Kupon -----------------------------------------------------------------

export const VOUCHER_STATUSES = ['issued', 'redeemed', 'expired', 'revoked'] as const
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number]

export interface Voucher {
  id: string
  uid: string
  templateId: string
  orgId: string
  kind: RewardKind
  title: LocalizedText
  valueCents: number
  discountPercent: number
  partnerOrgId: string | null
  /** Kaç IP ödendi — iade gerekirse defterden geri hesaplanabilsin diye. */
  costIp: number

  status: VoucherStatus
  issuedAt: Timestamp | null
  expiresAt: Timestamp

  redeemedAt: Timestamp | null
  redeemedBy: string | null
  redemptionOrgId: string | null

  /** Veznede kimlik eşleştirmesi için (Bölüm 7.4). */
  holderName: string
  holderPhotoURL: string | null
  seed?: boolean
}

/**
 * Ekranda gösterilecek durum.
 *
 * `expireVouchers` günlük zamanlanmış fonksiyonu Blaze'e bağlı; o gelene
 * kadar süre dolumu GÖRÜNTÜLEME anında hesaplanıyor. Kural da aynı kontrolü
 * yapıyor, yani süresi geçmiş bir kupon `issued` görünse bile kullanılamaz.
 */
export function effectiveVoucherStatus(
  voucher: Pick<Voucher, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): VoucherStatus {
  if (voucher.status !== 'issued') return voucher.status
  if (voucher.expiresAt.toDate().getTime() < now.getTime()) return 'expired'
  return 'issued'
}

export function isRedeemable(voucher: Voucher, now: Date = new Date()): boolean {
  return effectiveVoucherStatus(voucher, now) === 'issued'
}

// --- Kupon QR'ı (CLAUDE.md Bölüm 7.4) --------------------------------------

/** QR içerik ön eki — CLAUDE.md Bölüm 1A. */
export const VOUCHER_QR_PREFIX = 'EHRENWEG:VCH:'

/** Token ömrü: 60 saniye. Ekran görüntüsü bu süreden sonra ölü. */
export const VOUCHER_QR_TTL_SECONDS = 60

/**
 * QR yükü: `EHRENWEG:VCH:v1.<voucherId>.<exp>.<sig>`
 *
 * `sig`:
 *   · bugün (Blaze kapalı) → kupon sahibinin cihazının ürettiği rastgele
 *     nonce; okunamayan `vouchers/{id}/qr/current` belgesinde durur ve
 *     doğrulamayı Firestore kuralı yapar. Kural `expiresAt`'i
 *     `request.time + 60 sn` olmaya zorluyor, yani uzun ömürlü token
 *     üretilemiyor.
 *   · Blaze açılınca → HMAC_SHA256(VOUCHER_HMAC_SECRET, voucherId|nonce|exp)
 *
 * Yük biçimi değişmiyor; vezne tarafındaki okuyucu aynı kalıyor.
 */
export interface ScannedVoucher {
  voucherId: string
  expiresAt: number
  signature: string
}

export function buildVoucherQr(input: {
  voucherId: string
  expiresAtMs: number
  signature: string
}): string {
  return (
    `${VOUCHER_QR_PREFIX}v1.` +
    `${input.voucherId}.${input.expiresAtMs}.${input.signature}`
  )
}

export function parseVoucherQr(raw: string): ScannedVoucher | null {
  const text = raw.trim()
  if (!text.startsWith(VOUCHER_QR_PREFIX)) return null

  const parts = text.slice(VOUCHER_QR_PREFIX.length).split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null

  const [, voucherId, exp, signature] = parts
  if (!voucherId || !exp || !signature) return null

  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt)) return null

  return { voucherId, expiresAt, signature }
}

// --- Defter (ledger) -------------------------------------------------------

export const LEDGER_TYPES = [
  'ip_award',
  'ip_spend',
  'voucher_issue',
  'voucher_redeem',
  'voucher_revoke',
  'adjustment',
] as const
export type LedgerType = (typeof LEDGER_TYPES)[number]

export interface LedgerEntry {
  id: string
  uid: string
  type: LedgerType
  /** IP hareketlerinde puan, para hareketlerinde sent. İşaretli. */
  amount: number
  currency: 'IP' | 'EUR'
  refId: string
  orgId: string
  actorUid: string
  reason: string
  createdAt: Timestamp | null
}

// --- Hata anahtarları ------------------------------------------------------

export const REWARD_ERRORS = [
  'notEnoughIp',
  'budgetExceeded',
  'monthlyLimit',
  'inactive',
  'alreadyOwned',
  'unknown',
] as const
export type RewardErrorKey = (typeof REWARD_ERRORS)[number]

export class RewardFailure extends Error {
  readonly key: RewardErrorKey

  constructor(key: RewardErrorKey) {
    super(key)
    this.name = 'RewardFailure'
    this.key = key
  }
}

export const REDEEM_ERRORS = [
  'wrongCode',
  'expiredCode',
  'voucherExpired',
  'alreadyRedeemed',
  'revoked',
  'wrongOrganisation',
  'notFound',
  'unknown',
] as const
export type RedeemErrorKey = (typeof REDEEM_ERRORS)[number]

export class RedeemFailure extends Error {
  readonly key: RedeemErrorKey

  constructor(key: RedeemErrorKey) {
    super(key)
    this.name = 'RedeemFailure'
    this.key = key
  }
}

// --- Biçimlendirme ---------------------------------------------------------

/** Sent → "12,50 €". Intl ile, kullanıcının diliyle. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

/** Ay anahtarı — aylık sınır ve mutabakat raporu için. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
