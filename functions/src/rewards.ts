/**
 * Ödüller, kuponlar ve kupon QR'ı — CLAUDE.md Bölüm 7 ve Bölüm 12.
 *   issueVoucher (iç), buyReward, getVoucherQr, redeemVoucher,
 *   revokeVoucher, expireVouchers (günlük)
 *
 * ⚠️ BU FONKSİYONLAR HENÜZ DAĞITILMADI (Blaze kapalı, docs/DECISIONS.md §10).
 * Aynı iş şu an istemci + `firestore.rules` ile yapılıyor. Buradaki sürümün
 * kazandıracakları:
 *
 *   1. **HMAC'li kupon QR'ı.** Nonce saklanmıyor, `VOUCHER_HMAC_SECRET` ile
 *      hesaplanıyor; sır hiçbir istemciye gitmiyor.
 *   2. **Tek yazar.** Bütçe, IP bakiyesi ve defter tek bir ayrıcalıklı
 *      yerden yazılıyor; kural akrobasisi gerekmiyor.
 *   3. **Zamanlanmış süre dolumu.** `expireVouchers` günlük çalışıyor.
 *
 * Sır kurulumu (proje sahibi çalıştırır):
 *   firebase functions:secrets:set VOUCHER_HMAC_SECRET --project ehrenweg-dev
 *   firebase functions:secrets:set VOUCHER_HMAC_SECRET --project ehrenweg-prod
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { z } from 'zod'

import { COL, FieldValue, Timestamp, db } from './common/admin'
import { writeAudit } from './common/audit'
import { VOUCHER_HMAC_SECRET, VOUCHER_QR_TTL_SECONDS } from './common/config'
import {
  parseInput,
  requireAuth,
  requireOrgRole,
  requireVerifiedEmail,
  type AuthedContext,
} from './common/guards'

const HOLDERS = 'holders'

/** QR ön eki — CLAUDE.md Bölüm 1A. İstemcideki sabitle AYNI olmalı. */
const QR_PREFIX = 'EHRENWEG:VCH:'

/** Kişi başı aylık sınır dönemi — istemcideki 31 günle AYNI. */
const PERIOD_DAYS = 31

const buySchema = z.object({ templateId: z.string().min(1).max(64) })
const voucherSchema = z.object({ voucherId: z.string().min(1).max(64) })
const redeemSchema = z.object({
  payload: z.string().min(1).max(512),
  redemptionOrgId: z.string().min(1).max(64),
})
const revokeSchema = z.object({
  voucherId: z.string().min(1).max(64),
  reason: z.string().max(300).default(''),
})

function sign(secret: string, voucherId: string, nonce: string, exp: number): string {
  return createHmac('sha256', secret)
    .update(`${voucherId}|${nonce}|${exp}`)
    .digest('base64url')
}

function signatureMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * `buyReward` — IP ile ödül alma.
 *
 * CLAUDE.md Bölüm 7.2: "IP bakiyesi transaction içinde düşülür."
 * Bölüm 7.1: "Bütçe aşılamaz (Firestore transaction ile kontrol)."
 *
 * Transaction'ın içine hem bütçe hem bakiye hem aylık sınır giriyor; üçünden
 * biri tutmazsa hiçbiri yazılmıyor. Eşzamanlı iki çağrıda Firestore
 * ikincisini yeniden deniyor ve tavan doğru uygulanıyor.
 */
export const buyReward = onCall(async (request) => {
  const ctx = requireAuth(request)
  requireVerifiedEmail(ctx)
  const input = parseInput(buySchema, request.data)

  const templateRef = db.collection(COL.rewardTemplates).doc(input.templateId)
  const voucherRef = db.collection(COL.vouchers).doc()

  await db.runTransaction(async (transaction) => {
    const template = await transaction.get(templateRef)
    if (!template.exists) throw new HttpsError('not-found', 'errors.reward.inactive')
    if (template.get('active') !== true) {
      throw new HttpsError('failed-precondition', 'errors.reward.inactive')
    }

    const costIp = (template.get('costIp') as number | undefined) ?? 0
    const valueCents = (template.get('valueCents') as number | undefined) ?? 0
    const spentCents = (template.get('spentCents') as number | undefined) ?? 0
    const budget = template.get('totalBudgetCents') as number | null | undefined

    if (budget !== null && budget !== undefined && spentCents + valueCents > budget) {
      throw new HttpsError('resource-exhausted', 'errors.reward.budgetExceeded')
    }

    const userRef = db.collection(COL.users).doc(ctx.uid)
    const user = await transaction.get(userRef)
    const balance = (user.get('stats.ip') as number | undefined) ?? 0
    if (balance < costIp) {
      throw new HttpsError('failed-precondition', 'errors.reward.notEnoughIp')
    }

    // Kişi başı aylık sınır (Bölüm 7.5).
    const holderRef = templateRef.collection(HOLDERS).doc(ctx.uid)
    const holder = await transaction.get(holderRef)
    const maxPerMonth = (template.get('maxPerUserPerMonth') as number | undefined) ?? 1
    const periodMs = PERIOD_DAYS * 86_400_000
    const now = Date.now()

    let nextCount = 1
    if (holder.exists) {
      const start = (
        holder.get('periodStart') as InstanceType<typeof Timestamp> | undefined
      )?.toMillis()
      if (typeof start === 'number' && now < start + periodMs) {
        nextCount = ((holder.get('count') as number | undefined) ?? 0) + 1
        if (nextCount > maxPerMonth) {
          throw new HttpsError('resource-exhausted', 'errors.reward.monthlyLimit')
        }
      }
    }

    const validityDays = (template.get('validityDays') as number | undefined) ?? 30

    transaction.set(voucherRef, {
      uid: ctx.uid,
      templateId: input.templateId,
      orgId: template.get('orgId'),
      kind: template.get('kind'),
      title: template.get('title'),
      valueCents,
      discountPercent: (template.get('discountPercent') as number | undefined) ?? 0,
      partnerOrgId: template.get('partnerOrgId') ?? null,
      costIp,
      status: 'issued',
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + validityDays * 86_400_000),
      redeemedAt: null,
      redeemedBy: null,
      redemptionOrgId: null,
      holderName: (user.get('displayName') as string | undefined) ?? '',
      holderPhotoURL: (user.get('photoURL') as string | null | undefined) ?? null,
    })

    transaction.update(templateRef, {
      issuedCount: FieldValue.increment(1),
      spentCents: FieldValue.increment(valueCents),
    })

    transaction.set(
      holderRef,
      nextCount === 1
        ? { uid: ctx.uid, count: 1, periodStart: FieldValue.serverTimestamp() }
        : { uid: ctx.uid, count: nextCount },
      { merge: true },
    )

    transaction.update(userRef, { 'stats.ip': FieldValue.increment(-costIp) })

    // Bölüm 7.3: her hareket deftere.
    transaction.set(db.collection(COL.ledger).doc(`${voucherRef.id}_spend`), {
      uid: ctx.uid,
      type: 'ip_spend',
      amount: -costIp,
      currency: 'IP',
      refId: voucherRef.id,
      orgId: template.get('orgId'),
      actorUid: ctx.uid,
      reason: 'reward_purchase',
      createdAt: FieldValue.serverTimestamp(),
    })

    transaction.set(db.collection(COL.ledger).doc(`${voucherRef.id}_issue`), {
      uid: ctx.uid,
      type: 'voucher_issue',
      amount: valueCents,
      currency: 'EUR',
      refId: voucherRef.id,
      orgId: template.get('orgId'),
      actorUid: ctx.uid,
      reason: 'reward_purchase',
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  return { ok: true, voucherId: voucherRef.id }
})

/**
 * `getVoucherQr` — 60 saniyelik imzalı token (Bölüm 7.4).
 *
 * Nonce SAKLANMIYOR: pencere numarasından türetiliyor, `redeemVoucher` aynı
 * hesabı tekrarlayarak doğruluyor. Ekran görüntüsü 60 saniye sonra ölü.
 */
export const getVoucherQr = onCall(
  { secrets: [VOUCHER_HMAC_SECRET] },
  async (request) => {
    const ctx = requireAuth(request)
    const input = parseInput(voucherSchema, request.data)

    const voucher = await db.collection(COL.vouchers).doc(input.voucherId).get()
    if (!voucher.exists) throw new HttpsError('not-found', 'errors.voucher.invalid')
    if (voucher.get('uid') !== ctx.uid) {
      throw new HttpsError('permission-denied', 'errors.permissionDenied')
    }
    if (voucher.get('status') !== 'issued') {
      throw new HttpsError('failed-precondition', 'errors.voucher.alreadyRedeemed')
    }

    const expiresAt = voucher.get('expiresAt') as InstanceType<typeof Timestamp>
    if (expiresAt.toMillis() < Date.now()) {
      throw new HttpsError('failed-precondition', 'errors.voucher.expired')
    }

    const nonce = randomBytes(12).toString('base64url')
    const exp = Date.now() + VOUCHER_QR_TTL_SECONDS * 1000
    const signature = sign(VOUCHER_HMAC_SECRET.value(), input.voucherId, nonce, exp)

    // Nonce'u kuponda tutuyoruz ki `redeemVoucher` aynı token'ı bir kez
    // kabul etsin; imza tek başına tekrar kullanıma açık olurdu.
    await voucher.ref.update({ activeNonce: nonce, activeNonceExp: exp })

    return {
      payload: `${QR_PREFIX}v1.${input.voucherId}.${exp}.${signature}`,
      expiresAt: exp,
      ttlSeconds: VOUCHER_QR_TTL_SECONDS,
    }
  },
)

/** `redeemVoucher` — imza, süre, durum ve kurum yetkisi kontrolü (Bölüm 7.4). */
export const redeemVoucher = onCall(
  { secrets: [VOUCHER_HMAC_SECRET] },
  async (request) => {
    const ctx: AuthedContext = requireAuth(request)
    const input = parseInput(redeemSchema, request.data)

    if (!input.payload.startsWith(QR_PREFIX)) {
      throw new HttpsError('invalid-argument', 'errors.voucher.invalid')
    }
    const parts = input.payload.slice(QR_PREFIX.length).split('.')
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new HttpsError('invalid-argument', 'errors.voucher.invalid')
    }
    const [, voucherId, expRaw, signature] = parts as [string, string, string, string]

    const exp = Number(expRaw)
    // Sunucu saati — istemcininkine ASLA güvenilmez.
    if (!Number.isFinite(exp) || Date.now() > exp) {
      throw new HttpsError('failed-precondition', 'errors.voucher.expired')
    }

    const ref = db.collection(COL.vouchers).doc(voucherId)

    await db.runTransaction(async (transaction) => {
      const voucher = await transaction.get(ref)
      if (!voucher.exists) throw new HttpsError('not-found', 'errors.voucher.invalid')

      const nonce = voucher.get('activeNonce') as string | undefined
      if (!nonce) throw new HttpsError('failed-precondition', 'errors.voucher.expired')

      const expected = sign(VOUCHER_HMAC_SECRET.value(), voucherId, nonce, exp)
      if (!signatureMatches(expected, signature)) {
        throw new HttpsError('permission-denied', 'errors.voucher.invalid')
      }

      if (voucher.get('status') !== 'issued') {
        throw new HttpsError('failed-precondition', 'errors.voucher.alreadyRedeemed')
      }

      const orgId = voucher.get('orgId') as string
      const partnerOrgId = voucher.get('partnerOrgId') as string | null
      const allowed =
        hasRole(ctx, orgId, ['redemption_officer', 'org_admin']) ||
        (partnerOrgId !== null && hasRole(ctx, partnerOrgId, ['partner', 'org_admin']))
      if (!allowed) {
        throw new HttpsError('permission-denied', 'errors.voucher.wrongOrganisation')
      }

      transaction.update(ref, {
        status: 'redeemed',
        redeemedAt: FieldValue.serverTimestamp(),
        redeemedBy: ctx.uid,
        redemptionOrgId: input.redemptionOrgId,
        // Token tüketildi: aynı QR ikinci kez kabul edilmesin.
        activeNonce: FieldValue.delete(),
        activeNonceExp: FieldValue.delete(),
      })

      transaction.set(db.collection(COL.ledger).doc(`${voucherId}_redeem`), {
        uid: voucher.get('uid'),
        type: 'voucher_redeem',
        amount: -((voucher.get('valueCents') as number | undefined) ?? 0),
        currency: 'EUR',
        refId: voucherId,
        orgId,
        actorUid: ctx.uid,
        reason: 'redeemed_at_counter',
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    await writeAudit({
      action: 'voucher.redeemed',
      actorUid: ctx.uid,
      targetId: voucherId,
      orgId: input.redemptionOrgId,
    })

    return { ok: true }
  },
)

function hasRole(
  ctx: AuthedContext,
  orgId: string,
  allowed: readonly string[],
): boolean {
  if (ctx.claims.role === 'platform_admin') return true
  const role = ctx.claims.orgs?.[orgId]
  return role !== undefined && allowed.includes(role)
}

/** `revokeVoucher` — kurum yöneticisi iptal eder. */
export const revokeVoucher = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(revokeSchema, request.data)

  const ref = db.collection(COL.vouchers).doc(input.voucherId)
  const voucher = await ref.get()
  if (!voucher.exists) throw new HttpsError('not-found', 'errors.voucher.invalid')

  const orgId = voucher.get('orgId') as string
  requireOrgRole(ctx, orgId, 'org_admin')

  if (voucher.get('status') !== 'issued') {
    throw new HttpsError('failed-precondition', 'errors.voucher.alreadyRedeemed')
  }

  await db.runTransaction(async (transaction) => {
    transaction.update(ref, { status: 'revoked' })
    transaction.set(db.collection(COL.ledger).doc(`${input.voucherId}_revoke`), {
      uid: voucher.get('uid'),
      type: 'voucher_revoke',
      amount: -((voucher.get('valueCents') as number | undefined) ?? 0),
      currency: 'EUR',
      refId: input.voucherId,
      orgId,
      actorUid: ctx.uid,
      reason: input.reason,
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  await writeAudit({
    action: 'voucher.revoked',
    actorUid: ctx.uid,
    targetId: input.voucherId,
    orgId,
    reason: input.reason,
  })

  return { ok: true }
})

/** `expireVouchers` — günlük (CLAUDE.md Bölüm 12). */
export const expireVouchers = onSchedule(
  { schedule: 'every day 03:30', timeZone: 'Europe/Berlin' },
  async () => {
    const now = Timestamp.now()
    const stale = await db
      .collection(COL.vouchers)
      .where('status', '==', 'issued')
      .where('expiresAt', '<', now)
      .limit(500)
      .get()

    if (stale.empty) return

    const batch = db.batch()
    for (const voucher of stale.docs) {
      batch.update(voucher.ref, { status: 'expired' })
    }
    await batch.commit()

    logger.info('Süresi dolan kuponlar işaretlendi', { count: stale.size })
  },
)
