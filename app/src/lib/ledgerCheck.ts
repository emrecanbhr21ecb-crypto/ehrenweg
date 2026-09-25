/**
 * Defter tutarlılık kontrolü — CLAUDE.md Bölüm 7.3:
 * "Kullanıcının IP bakiyesi ve kurumun harcaması ledger'dan yeniden
 *  hesaplanabilir olmalı (tutarlılık kontrol scripti yaz)."
 *
 * Aynı mantık iki yerde çalışıyor:
 *   · `scripts/ledgerConsistencyCheck.ts` — tüm sistem, admin SDK ile
 *   · burası — admin panelinden tetiklenen sürüm (Bölüm 7.7)
 *
 * Mantığı paylaşmak şart: iki ayrı hesap iki ayrı "doğru" üretirdi ve
 * hangisinin haklı olduğu belli olmazdı.
 */

import type { LedgerEntry } from '@/types/reward'

export interface BalanceMismatch {
  uid: string
  stored: number
  computed: number
}

export interface ConsistencyResult {
  usersChecked: number
  mismatches: BalanceMismatch[]
  /** Kurum başına bağlanan tutar (sent) — bütçeyle karşılaştırmak için. */
  orgSpendCents: Record<string, number>
}

/**
 * Defterden IP bakiyelerini yeniden hesaplar.
 *
 * Yalnız `currency === 'IP'` kayıtları sayılır; euro hareketleri kurumun
 * bütçesini ilgilendiriyor, kullanıcının puanını değil.
 */
export function recomputeBalances(entries: LedgerEntry[]): Map<string, number> {
  const balances = new Map<string, number>()
  for (const entry of entries) {
    if (entry.currency !== 'IP') continue
    balances.set(entry.uid, (balances.get(entry.uid) ?? 0) + entry.amount)
  }
  return balances
}

/** Kurumların bütçeden bağladığı tutar (verilen − iptal edilen). */
export function recomputeOrgSpend(entries: LedgerEntry[]): Record<string, number> {
  const spend: Record<string, number> = {}
  for (const entry of entries) {
    if (entry.currency !== 'EUR') continue
    // `voucher_issue` bütçeyi bağlar, `voucher_revoke` serbest bırakır.
    // `voucher_redeem` bütçeyi İKİNCİ KEZ düşürmez — kupon basılırken zaten
    // bağlanmıştı; kullanım yalnız paranın kasadan çıktığı andır.
    if (entry.type === 'voucher_issue') {
      spend[entry.orgId] = (spend[entry.orgId] ?? 0) + entry.amount
    } else if (entry.type === 'voucher_revoke') {
      spend[entry.orgId] = (spend[entry.orgId] ?? 0) + entry.amount
    }
  }
  return spend
}

/** Saklanan bakiyelerle defteri karşılaştırır. */
export function compareBalances(
  entries: LedgerEntry[],
  storedByUid: Map<string, number>,
): ConsistencyResult {
  const computed = recomputeBalances(entries)
  const mismatches: BalanceMismatch[] = []

  // Her iki taraftaki kullanıcıların birleşimi: defterde olup profili
  // silinmiş ya da profili olup hiç hareketi olmayan durumlar da görünsün.
  const uids = new Set<string>([...computed.keys(), ...storedByUid.keys()])

  for (const uid of uids) {
    const stored = storedByUid.get(uid) ?? 0
    const fromLedger = computed.get(uid) ?? 0
    if (stored !== fromLedger) {
      mismatches.push({ uid, stored, computed: fromLedger })
    }
  }

  return {
    usersChecked: uids.size,
    mismatches,
    orgSpendCents: recomputeOrgSpend(entries),
  }
}
