/**
 * Vezne ve partner ekranı — kupon tarama ve "ödendi" onayı.
 * CLAUDE.md Bölüm 7.4, Bölüm 9 "Vezne / partner ekranı".
 *
 * Uygulama ÖDEME YAPMAZ. Yalnız "vezne şu tutarı ödedi" kaydını tutar;
 * gerçek ödeme kurumun kendi süreciyle (nakit/havale/ayni) olur. Bu ayrım
 * hukuki olarak önemli ve arayüzde de böyle anlatılıyor.
 */

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { LEDGER, VOUCHERS, fetchVoucher, toVoucher, writeAudit } from '@/lib/rewards'
import {
  RedeemFailure,
  effectiveVoucherStatus,
  parseVoucherQr,
  type ScannedVoucher,
  type Voucher,
} from '@/types/reward'

export interface RedeemContext {
  actorUid: string
  /** Veznenin/partnerin kendi kurumu — yetki kontrolü için. */
  orgIds: string[]
}

/**
 * Taranan QR'ı çözer ve kuponu getirir — HENÜZ KULLANMAZ.
 *
 * Vezne önce kişiyi görmeli (ad + fotoğraf + tutar), sonra onaylamalı.
 * Tek adımda "tara ve harca" yapmak yanlış kişiye ödeme riskini getirirdi.
 */
export async function inspectVoucherQr(
  raw: string,
  context: RedeemContext,
): Promise<{ voucher: Voucher; scanned: ScannedVoucher }> {
  const scanned = parseVoucherQr(raw)
  if (!scanned) throw new RedeemFailure('wrongCode')

  // QR yükündeki süre yalnız hızlı geri bildirim için; asıl süre kontrolü
  // kuralda, okunamayan token belgesindeki damgaya göre yapılıyor.
  if (scanned.expiresAt < Date.now()) throw new RedeemFailure('expiredCode')

  const voucher = await fetchVoucher(scanned.voucherId).catch(() => null)
  if (!voucher) throw new RedeemFailure('notFound')

  const allowed =
    context.orgIds.includes(voucher.orgId) ||
    (voucher.partnerOrgId !== null && context.orgIds.includes(voucher.partnerOrgId))
  if (!allowed) throw new RedeemFailure('wrongOrganisation')

  const status = effectiveVoucherStatus(voucher)
  if (status === 'redeemed') throw new RedeemFailure('alreadyRedeemed')
  if (status === 'revoked') throw new RedeemFailure('revoked')
  if (status === 'expired') throw new RedeemFailure('voucherExpired')

  return { voucher, scanned }
}

/**
 * `redeemVoucher` — kuponu "kullanıldı" yapar ve deftere yazar.
 *
 * Kural dört şeyi birden doğruluyor: imza (okunamayan token), token süresi,
 * kupon durumu ve veznenin kurum yetkisi. İkinci kullanım `status == 'issued'`
 * şartında düşüyor — ekran görüntüsüyle tekrar okutmak işe yaramıyor.
 */
export async function redeemVoucher(
  voucher: Voucher,
  scanned: ScannedVoucher,
  context: RedeemContext,
  redemptionOrgId: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(doc(db, VOUCHERS, voucher.id))
    if (!snapshot.exists()) throw new RedeemFailure('notFound')
    if (snapshot.data()['status'] !== 'issued') {
      throw new RedeemFailure('alreadyRedeemed')
    }

    transaction.update(doc(db, VOUCHERS, voucher.id), {
      status: 'redeemed',
      redeemedAt: serverTimestamp(),
      redeemedBy: context.actorUid,
      redemptionOrgId,
      // Kural bunu okunamayan token belgesiyle karşılaştırır.
      presentedNonce: scanned.signature,
    })

    transaction.set(doc(db, LEDGER, `${voucher.id}_redeem`), {
      uid: voucher.uid,
      type: 'voucher_redeem',
      amount: -voucher.valueCents,
      currency: 'EUR',
      refId: voucher.id,
      orgId: voucher.orgId,
      actorUid: context.actorUid,
      reason: 'redeemed_at_counter',
      createdAt: serverTimestamp(),
    })
  })

  // Bölüm 7.5: tüm elle işlemler denetim kaydına.
  await writeAudit(
    context.actorUid,
    'voucher.redeemed',
    voucher.id,
    voucher.orgId,
    `${voucher.valueCents}`,
  )
}

/** Veznenin bugünkü işlem listesi (Bölüm 9). */
export async function fetchTodaysRedemptions(actorUid: string): Promise<Voucher[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const q = query(
    collection(db, VOUCHERS),
    where('redeemedBy', '==', actorUid),
    where('redeemedAt', '>=', startOfDay),
    orderBy('redeemedAt', 'desc'),
    limit(200),
  )
  return (await getDocs(q)).docs.map(toVoucher)
}
