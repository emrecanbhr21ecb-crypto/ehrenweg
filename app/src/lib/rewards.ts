/**
 * Ödül şablonları, kupon basma ve kuponlarım — CLAUDE.md Bölüm 7.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ MİMARİ SAPMA — para akışını kim yazıyor (docs/DECISIONS.md §10)
 *
 * Bölüm 7.2 açık: "Kupon verme YALNIZCA sunucu tarafında." Blaze kapalı,
 * sunucu yok. Kuponu kullanıcının cihazı basıyor — ama tek bir alanı bile
 * serbest değil; `firestore.rules` şunları aynı commit içinde zorluyor:
 *
 *   1. kuponun değeri/türü/süresi/fiyatı ŞABLONDAN kopyalanmak zorunda,
 *   2. şablonun bütçe sayacı tam `valueCents` kadar artmalı ve
 *      `totalBudgetCents`'i AŞAMAZ (kural commit anındaki gerçek değeri
 *      okur — istemcinin bayat okuması tavanı delemez),
 *   3. kullanıcının IP'si tam `costIp` kadar düşmeli ve eksiye inemez,
 *   4. kişi başı aylık sayaç artmalı ve sınırı aşamaz,
 *   5. deftere hem `ip_spend` hem `voucher_issue` yazılmalı, tutarlar
 *      kuponla birebir aynı olmalı.
 *
 * Beşi birden tutmazsa commit tamamen düşer. Yani "kendime bedava 500 €
 * kupon basayım" mümkün değil; en fazla kurumun ilan ettiği ödülü, ilan
 * ettiği fiyata, ilan ettiği bütçe bitene kadar alabiliyor.
 *
 * Blaze açılınca `functions/src/rewards.ts` içindeki `buyReward` devreye
 * girer ve kuraldaki istemci yazma izinleri `if false` olur.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { userDocRef } from '@/lib/userProfile'
import { EMPTY_TEXT } from '@/types/activity'
import {
  RewardFailure,
  type LedgerEntry,
  type RewardKind,
  type RewardTemplate,
  type RewardTemplateForm,
  type Voucher,
  type VoucherStatus,
} from '@/types/reward'

export const TEMPLATES = 'rewardTemplates'
export const VOUCHERS = 'vouchers'
export const LEDGER = 'ledger'
export const HOLDERS = 'holders'
export const AUDIT_LOG = 'auditLog'

/** Aylık sınır dönemi — kuraldaki 31 günle AYNI olmalı. */
const PERIOD_DAYS = 31

export function templateRef(templateId: string) {
  return doc(db, TEMPLATES, templateId)
}

export function voucherRef(voucherId: string) {
  return doc(db, VOUCHERS, voucherId)
}

function holderRef(templateId: string, uid: string) {
  return doc(db, TEMPLATES, templateId, HOLDERS, uid)
}

// --- Dönüştürücüler --------------------------------------------------------

function toTemplate(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): RewardTemplate {
  const data = snapshot.data() as Partial<RewardTemplate> | undefined
  return {
    id: snapshot.id,
    orgId: data?.orgId ?? '',
    kind: data?.kind ?? 'integration_points',
    title: data?.title ?? EMPTY_TEXT,
    description: data?.description ?? EMPTY_TEXT,
    valueCents: data?.valueCents ?? 0,
    discountPercent: data?.discountPercent ?? 0,
    partnerOrgId: data?.partnerOrgId ?? null,
    costIp: data?.costIp ?? 0,
    validityDays: data?.validityDays ?? 30,
    totalBudgetCents: data?.totalBudgetCents ?? null,
    spentCents: data?.spentCents ?? 0,
    issuedCount: data?.issuedCount ?? 0,
    maxPerUserPerMonth: data?.maxPerUserPerMonth ?? 1,
    active: data?.active !== false,
    createdAt: data?.createdAt ?? null,
    createdBy: data?.createdBy ?? '',
    ...(data?.seed ? { seed: true } : {}),
  }
}

function toVoucher(snapshot: DocumentSnapshot | QueryDocumentSnapshot): Voucher {
  const data = snapshot.data() as Partial<Voucher> | undefined
  return {
    id: snapshot.id,
    uid: data?.uid ?? '',
    templateId: data?.templateId ?? '',
    orgId: data?.orgId ?? '',
    kind: data?.kind ?? 'gift_voucher',
    title: data?.title ?? EMPTY_TEXT,
    valueCents: data?.valueCents ?? 0,
    discountPercent: data?.discountPercent ?? 0,
    partnerOrgId: data?.partnerOrgId ?? null,
    costIp: data?.costIp ?? 0,
    status: data?.status ?? 'issued',
    issuedAt: data?.issuedAt ?? null,
    expiresAt: data?.expiresAt as Voucher['expiresAt'],
    redeemedAt: data?.redeemedAt ?? null,
    redeemedBy: data?.redeemedBy ?? null,
    redemptionOrgId: data?.redemptionOrgId ?? null,
    holderName: data?.holderName ?? '',
    holderPhotoURL: data?.holderPhotoURL ?? null,
    ...(data?.seed ? { seed: true } : {}),
  }
}

function toLedgerEntry(snapshot: QueryDocumentSnapshot): LedgerEntry {
  const data = snapshot.data() as Partial<LedgerEntry>
  return {
    id: snapshot.id,
    uid: data.uid ?? '',
    type: data.type ?? 'adjustment',
    amount: data.amount ?? 0,
    currency: data.currency ?? 'IP',
    refId: data.refId ?? '',
    orgId: data.orgId ?? '',
    actorUid: data.actorUid ?? '',
    reason: data.reason ?? '',
    createdAt: data.createdAt ?? null,
  }
}

// --- Şablonlar (kurum paneli) ----------------------------------------------

export function watchOrgTemplates(
  orgId: string,
  onChange: (templates: RewardTemplate[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, TEMPLATES), where('orgId', '==', orgId), limit(100))
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toTemplate)), onError)
}

/** Ödül mağazası — IP ile alınabilen aktif şablonlar. */
export function watchShopTemplates(
  onChange: (templates: RewardTemplate[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, TEMPLATES),
    where('active', '==', true),
    where('costIp', '>', 0),
    limit(100),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toTemplate)), onError)
}

export async function createTemplate(
  form: RewardTemplateForm,
  context: { orgId: string; uid: string },
): Promise<string> {
  const ref = doc(collection(db, TEMPLATES))
  await setDoc(ref, {
    orgId: context.orgId,
    kind: form.kind,
    title: { de: form.titleDe, en: form.titleEn },
    description: { de: form.descriptionDe, en: form.descriptionEn },
    valueCents: form.valueCents,
    discountPercent: form.discountPercent,
    partnerOrgId: form.partnerOrgId === '' ? null : form.partnerOrgId,
    costIp: form.costIp,
    validityDays: form.validityDays,
    totalBudgetCents: form.totalBudgetCents,
    spentCents: 0,
    issuedCount: 0,
    maxPerUserPerMonth: form.maxPerUserPerMonth,
    active: form.active,
    createdAt: serverTimestamp(),
    createdBy: context.uid,
  })
  return ref.id
}

export async function updateTemplate(
  templateId: string,
  form: RewardTemplateForm,
): Promise<void> {
  await updateDoc(templateRef(templateId), {
    kind: form.kind,
    title: { de: form.titleDe, en: form.titleEn },
    description: { de: form.descriptionDe, en: form.descriptionEn },
    valueCents: form.valueCents,
    discountPercent: form.discountPercent,
    partnerOrgId: form.partnerOrgId === '' ? null : form.partnerOrgId,
    costIp: form.costIp,
    validityDays: form.validityDays,
    totalBudgetCents: form.totalBudgetCents,
    maxPerUserPerMonth: form.maxPerUserPerMonth,
    active: form.active,
  })
}

// --- Kupon basma -----------------------------------------------------------

export interface BuyerIdentity {
  uid: string
  displayName: string
  photoURL: string | null
  ip: number
}

/**
 * `buyReward` — IP ile ödül alma. Bütçe kontrolü ve IP düşümü AYNI
 * transaction içinde (CLAUDE.md Bölüm 7.2).
 *
 * Transaction tek bir commit'e beş yazma koyuyor:
 *   vouchers/{id}                      → kupon
 *   rewardTemplates/{id}               → bütçe + sayaç
 *   rewardTemplates/{id}/holders/{uid} → kişi başı aylık sayaç
 *   users/{uid}                        → IP düşümü
 *   ledger/{...} ×2                    → ip_spend + voucher_issue
 *
 * Eşzamanlı iki alım: Firestore transaction'ı ikincisini yeniden dener;
 * yeniden denemede bütçe dolmuşsa istemci `budgetExceeded` fırlatır, oraya
 * kadar gelirse de kural düşürür. İki katman da aynı sonucu veriyor.
 */
export async function buyReward(
  template: RewardTemplate,
  buyer: BuyerIdentity,
): Promise<string> {
  const voucherId = doc(collection(db, VOUCHERS)).id

  await runTransaction(db, async (transaction) => {
    const templateSnapshot = await transaction.get(templateRef(template.id))
    if (!templateSnapshot.exists()) throw new RewardFailure('inactive')

    const current = toTemplate(templateSnapshot)
    if (!current.active) throw new RewardFailure('inactive')
    if (buyer.ip < current.costIp) throw new RewardFailure('notEnoughIp')

    if (
      current.totalBudgetCents !== null &&
      current.spentCents + current.valueCents > current.totalBudgetCents
    ) {
      throw new RewardFailure('budgetExceeded')
    }

    // Kişi başı aylık sınır (Bölüm 7.5).
    const holderSnapshot = await transaction.get(holderRef(template.id, buyer.uid))
    const now = Date.now()
    const periodMs = PERIOD_DAYS * 86_400_000

    let nextCount = 1
    let resetPeriod = true

    if (holderSnapshot.exists()) {
      const start = (
        holderSnapshot.data()['periodStart'] as Timestamp | undefined
      )?.toMillis()
      const withinPeriod = typeof start === 'number' && now < start + periodMs
      if (withinPeriod) {
        nextCount = ((holderSnapshot.data()['count'] as number | undefined) ?? 0) + 1
        resetPeriod = false
        if (nextCount > current.maxPerUserPerMonth) {
          throw new RewardFailure('monthlyLimit')
        }
      }
    }

    const expiresAt = Timestamp.fromMillis(now + current.validityDays * 86_400_000)

    transaction.set(voucherRef(voucherId), {
      uid: buyer.uid,
      templateId: current.id,
      orgId: current.orgId,
      kind: current.kind,
      title: current.title,
      valueCents: current.valueCents,
      discountPercent: current.discountPercent,
      partnerOrgId: current.partnerOrgId,
      costIp: current.costIp,
      status: 'issued' satisfies VoucherStatus,
      issuedAt: serverTimestamp(),
      expiresAt,
      redeemedAt: null,
      redeemedBy: null,
      redemptionOrgId: null,
      // Veznede kimlik eşleştirmesi (Bölüm 7.4).
      holderName: buyer.displayName,
      holderPhotoURL: buyer.photoURL,
    })

    transaction.update(templateRef(current.id), {
      issuedCount: current.issuedCount + 1,
      spentCents: current.spentCents + current.valueCents,
      lastVoucherId: voucherId,
    })

    if (holderSnapshot.exists()) {
      transaction.update(holderRef(current.id, buyer.uid), {
        count: nextCount,
        ...(resetPeriod ? { periodStart: serverTimestamp() } : {}),
      })
    } else {
      transaction.set(holderRef(current.id, buyer.uid), {
        uid: buyer.uid,
        count: 1,
        periodStart: serverTimestamp(),
      })
    }

    transaction.update(userDocRef(buyer.uid), {
      'stats.ip': buyer.ip - current.costIp,
      lastSpendId: voucherId,
    })

    // Bölüm 7.3: her hareket deftere. İki ayrı kayıt — biri kullanıcının
    // IP bakiyesini, diğeri kurumun harcamasını besliyor.
    transaction.set(doc(db, LEDGER, `${voucherId}_spend`), {
      uid: buyer.uid,
      type: 'ip_spend',
      amount: -current.costIp,
      currency: 'IP',
      refId: voucherId,
      orgId: current.orgId,
      actorUid: buyer.uid,
      reason: 'reward_purchase',
      createdAt: serverTimestamp(),
    })

    transaction.set(doc(db, LEDGER, `${voucherId}_issue`), {
      uid: buyer.uid,
      type: 'voucher_issue',
      amount: current.valueCents,
      currency: 'EUR',
      refId: voucherId,
      orgId: current.orgId,
      actorUid: buyer.uid,
      reason: 'reward_purchase',
      createdAt: serverTimestamp(),
    })
  })

  return voucherId
}

// --- Kuponlar --------------------------------------------------------------

export function watchMyVouchers(
  uid: string,
  onChange: (vouchers: Voucher[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, VOUCHERS), where('uid', '==', uid), limit(200))
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map(toVoucher)
      rows.sort((a, b) => (b.issuedAt?.toMillis() ?? 0) - (a.issuedAt?.toMillis() ?? 0))
      onChange(rows)
    },
    onError,
  )
}

export function watchVoucher(
  voucherId: string,
  onChange: (voucher: Voucher | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    voucherRef(voucherId),
    (snapshot) => onChange(snapshot.exists() ? toVoucher(snapshot) : null),
    onError,
  )
}

export async function fetchVoucher(voucherId: string): Promise<Voucher | null> {
  const snapshot = await getDoc(voucherRef(voucherId))
  return snapshot.exists() ? toVoucher(snapshot) : null
}

/** Kurumun bastığı tüm kuponlar — mutabakat raporu için. */
export async function fetchOrgVouchers(orgId: string): Promise<Voucher[]> {
  const q = query(collection(db, VOUCHERS), where('orgId', '==', orgId), limit(2000))
  return (await getDocs(q)).docs.map(toVoucher)
}

/** `revokeVoucher` — kurum yöneticisi iptal eder + deftere yazar. */
export async function revokeVoucher(
  voucher: Voucher,
  actorUid: string,
  reason: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    transaction.update(voucherRef(voucher.id), { status: 'revoked' })
    transaction.set(doc(db, LEDGER, `${voucher.id}_revoke`), {
      uid: voucher.uid,
      type: 'voucher_revoke',
      amount: -voucher.valueCents,
      currency: 'EUR',
      refId: voucher.id,
      orgId: voucher.orgId,
      actorUid,
      reason,
      createdAt: serverTimestamp(),
    })
  })
  await writeAudit(actorUid, 'voucher.revoked', voucher.id, voucher.orgId, reason)
}

/**
 * `expireVouchers` — süresi geçmişleri işaretler.
 *
 * ⚠️ Spesifikasyonda GÜNLÜK zamanlanmış bir fonksiyon (Bölüm 12). Blaze
 * kapalı olduğu için kurum paneli açıldığında elle tetikleniyor. Görüntüleme
 * tarafı zaten `effectiveVoucherStatus` ile süreyi hesaplıyor, yani işaret
 * gecikse bile süresi geçmiş kupon kullanılamaz — kural da reddeder.
 */
export async function expireVouchers(vouchers: Voucher[]): Promise<number> {
  const now = Date.now()
  let count = 0
  for (const voucher of vouchers) {
    if (voucher.status !== 'issued') continue
    if (voucher.expiresAt.toMillis() > now) continue
    try {
      await updateDoc(voucherRef(voucher.id), { status: 'expired' })
      count += 1
    } catch (error) {
      console.warn('[rewards] Süre işaretlenemedi:', voucher.id, error)
    }
  }
  return count
}

// --- Defter ----------------------------------------------------------------

export function watchMyLedger(
  uid: string,
  onChange: (entries: LedgerEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, LEDGER),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(100),
  )
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(toLedgerEntry)),
    onError,
  )
}

export async function fetchOrgLedger(orgId: string): Promise<LedgerEntry[]> {
  const q = query(
    collection(db, LEDGER),
    where('orgId', '==', orgId),
    orderBy('createdAt', 'asc'),
    limit(5000),
  )
  return (await getDocs(q)).docs.map(toLedgerEntry)
}

// --- Denetim kaydı (Bölüm 7.5) ---------------------------------------------

/** Elle yapılan her para işlemi denetim kaydına düşer. Hata yutulur. */
export async function writeAudit(
  actorUid: string,
  action: string,
  targetId: string,
  orgId: string,
  reason = '',
): Promise<void> {
  try {
    await setDoc(doc(collection(db, AUDIT_LOG)), {
      actorUid,
      action,
      targetId,
      orgId,
      reason,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    // Denetim yazımı asıl işlemi ÇÖKERTMEZ; ama sessizce de kaybolmaz.
    console.error('[rewards] auditLog yazılamadı:', action, error)
  }
}

export interface AuditEntry {
  id: string
  actorUid: string
  action: string
  targetId: string
  orgId: string
  reason: string
  createdAt: Timestamp | null
}

/**
 * Tüm denetim kaydı — yalnız platform admin (Faz 7, Bölüm 9: "audit log").
 *
 * ⚠️ Bugüne kadar yalnız kupon iptali (`voucher.revoked`) bu kayda düşüyordu.
 * Faz 7'de kurum doğrulama, içerik moderasyonu ve eğitmen onayı kararları da
 * `writeAudit` çağırmaya başladı (bkz. pages/admin/AdminPanel.tsx) — "tüm
 * manuel onaylar auditLog'a" (Bölüm 7.5) artık gerçekten doğru.
 */
export async function fetchAuditLog(limitCount = 200): Promise<AuditEntry[]> {
  const q = query(
    collection(db, AUDIT_LOG),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  )
  return (await getDocs(q)).docs.map((snapshot) => {
    const data = snapshot.data() as Partial<AuditEntry>
    return {
      id: snapshot.id,
      actorUid: data.actorUid ?? '',
      action: data.action ?? '',
      targetId: data.targetId ?? '',
      orgId: data.orgId ?? '',
      reason: data.reason ?? '',
      createdAt: data.createdAt ?? null,
    }
  })
}

export { toVoucher, toTemplate }
export type { RewardKind }
