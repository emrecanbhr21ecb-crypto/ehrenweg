/**
 * Integrationspass: puan yazımı, seviye, no-show cezası, rozet bağlamı.
 *
 * CLAUDE.md Bölüm 12 `onAttendanceConfirmed`:
 *   "passportEntry + IP + ledger + rozet/seviye hesap"
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ MİMARİ SAPMA — puanı KİM yazıyor (docs/DECISIONS.md §9)
 *
 * Spesifikasyonda bunu bir Firestore tetikleyicisi (`onAttendanceConfirmed`)
 * yapıyor. Blaze kapalı, tetikleyici yok. Katılımcıya yazdırmak ise kesinlikle
 * yasak (Bölüm 5: "Kullanıcı bunu ASLA doğrudan yazamaz", Bölüm 14: stats /
 * passportEntries / ledger istemciden yazılamaz).
 *
 * Bu yüzden puanı **kurum personelinin cihazı** yazıyor — zaten yoklama
 * ekranında canlı listeyi izleyen taraf o. Yetkisi `firestore.rules` ile
 * dar tutuluyor:
 *
 *   · pasaport girdisi kimliği sabit: `{activityId}_{uid}` → aynı aktivite
 *     için ikinci kez puan YAZILAMAZ (idempotent, item 5)
 *   · `ipAwarded` aktivitenin ilan ettiği değere EŞİT olmak zorunda
 *   · `hours` aktivitenin `hoursCredited` değerine EŞİT olmak zorunda
 *   · girdi ancak o kişinin o aktivitede `confirmed` yoklama kaydı varsa açılır
 *   · `users.stats` güncellemesi yalnız aynı commit'te açılan girdiyle
 *     birebir aynı deltayı taşıyabilir (`getAfter` ile kanıtlanıyor)
 *   · yeni seviye eşik tablosunu aşamaz
 *
 * Yani kötü niyetli bir kurum bile ancak KENDİ aktivitesinin ilan ettiği
 * puanı, kişi başı bir kez verebilir. Gerçek tasarımda da sahip olduğu güç
 * bu kadardır.
 *
 * ⚠️ Bonuslar (yeni kategori +15, ayda 4+ katılım +25) bu yolda
 * UYGULANMIYOR: doğru hesaplamak kullanıcının tüm kurumlardaki geçmişini
 * okumayı gerektirir ve kural bunu doğrulayamaz — kurum bonusu uydurup puan
 * şişirebilirdi. Bonuslar `functions/src/attendance.ts` içindeki
 * `onAttendanceConfirmed` ile, Blaze açıldığı gün devreye girer.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import type { CategoryId } from '@/config/catalog'
import { DEFAULT_SCORING, levelFor, type ScoringConfig } from '@/config/scoring'
import { RECORDS, recordRef } from '@/lib/attendance'
import { db } from '@/lib/firebase'
import { userDocRef } from '@/lib/userProfile'
import {
  passportEntryId,
  type AttendanceRecord,
  type PassportEntry,
} from '@/types/attendance'
import type { Activity } from '@/types/activity'

export const PASSPORT_ENTRIES = 'passportEntries'
export const LEDGER = 'ledger'
export const SCORING_DOC = 'config/scoring'

// --- Puan kuralları (item 6) -----------------------------------------------

let cachedScoring: ScoringConfig | null = null

/**
 * `config/scoring` belgesini okur; yoksa varsayılanlara düşer.
 *
 * Tek seferlik önbellek: kural belgesi oturum içinde değişmiyor ve her
 * puanlamada yeniden okumak gereksiz istek üretir.
 */
export async function loadScoringConfig(): Promise<ScoringConfig> {
  if (cachedScoring) return cachedScoring
  try {
    const snapshot = await getDoc(doc(db, 'config', 'scoring'))
    const data = snapshot.exists() ? (snapshot.data() as Partial<ScoringConfig>) : {}
    cachedScoring = {
      ...DEFAULT_SCORING,
      ...data,
      bonuses: { ...DEFAULT_SCORING.bonuses, ...(data.bonuses ?? {}) },
      penalties: { ...DEFAULT_SCORING.penalties, ...(data.penalties ?? {}) },
      levels: data.levels ?? DEFAULT_SCORING.levels,
    }
  } catch (error) {
    console.warn('[passport] config/scoring okunamadı, varsayılanlar:', error)
    cachedScoring = DEFAULT_SCORING
  }
  return cachedScoring
}

// --- Puan yazımı -----------------------------------------------------------

function toEntry(snapshot: QueryDocumentSnapshot): PassportEntry {
  const data = snapshot.data() as Partial<PassportEntry>
  return {
    id: snapshot.id,
    uid: data.uid ?? '',
    activityId: data.activityId ?? '',
    orgId: data.orgId ?? '',
    sessionId: data.sessionId ?? '',
    categoryId: data.categoryId ?? 'other',
    activityTitle: data.activityTitle ?? '',
    hours: data.hours ?? 0,
    ipAwarded: data.ipAwarded ?? 0,
    skillsGained: data.skillsGained ?? [],
    source: data.source ?? 'attendance',
    status: 'completed',
    approvedAt: data.approvedAt ?? null,
    bonuses: data.bonuses ?? [],
  }
}

export interface AwardOutcome {
  awarded: boolean
  ip: number
  /** Zaten puanlanmışsa true — çift puan engellendi. */
  alreadyAwarded: boolean
}

/**
 * Bir onaylı yoklama kaydını pasaporta işler.
 *
 * Tek transaction içinde dört yazma:
 *   1. `passportEntries/{activityId}_{uid}`  → katılım belgesi
 *   2. `ledger/{...}`                        → ip_award kaydı (değişmez defter)
 *   3. `users/{uid}.stats`                   → sayaçlar + seviye
 *   4. `attendanceRecords/{...}.awarded`     → bir daha işlenmesin
 *
 * İdempotent: pasaport girdisi zaten varsa hiçbir şey yazılmaz, yalnız
 * kayıt işaretlenir. Kimlikler sabit olduğu için iki cihaz aynı anda
 * çalıştırsa bile ikincisi transaction çakışmasında düşer.
 */
export async function awardAttendance(
  record: AttendanceRecord,
  activity: Activity,
  actorUid: string,
): Promise<AwardOutcome> {
  const config = await loadScoringConfig()
  const entryId = passportEntryId(activity.id, record.uid)
  const entryRef = doc(db, PASSPORT_ENTRIES, entryId)
  const ledgerRef = doc(db, LEDGER, `${entryId}_award`)

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(entryRef)
    const current = await transaction.get(recordRef(record.sessionId, record.uid))

    if (!current.exists()) {
      throw new Error('[passport] Yoklama kaydı bulunamadı.')
    }
    if (current.data()['status'] !== 'confirmed') {
      throw new Error('[passport] Kayıt onaylı değil.')
    }

    if (existing.exists()) {
      // Çift puan koruması: girdi zaten var, yalnız bayrağı düzelt.
      if (current.data()['awarded'] !== true) {
        transaction.update(recordRef(record.sessionId, record.uid), { awarded: true })
      }
      return { awarded: false, ip: 0, alreadyAwarded: true }
    }

    const ip = Math.min(activity.rewards.ip, config.maxIpPerActivity)
    const hours = activity.hoursCredited
    const snapshot = record.statsSnapshot

    const nextStats = {
      activitiesCompleted: snapshot.activitiesCompleted + 1,
      hours: snapshot.hours + hours,
      categoriesCount: snapshot.categoriesCount + (record.isNewCategory ? 1 : 0),
    }

    transaction.set(entryRef, {
      uid: record.uid,
      activityId: activity.id,
      orgId: activity.orgId,
      sessionId: record.sessionId,
      categoryId: activity.categoryId,
      activityTitle: activity.title.de || activity.title.en,
      hours,
      ipAwarded: ip,
      skillsGained: activity.skillsGained,
      source: 'attendance',
      status: 'completed',
      approvedAt: serverTimestamp(),
      bonuses: [],
    })

    // Değişmez defter (Bölüm 7.3): bakiye buradan yeniden hesaplanabilmeli.
    transaction.set(ledgerRef, {
      uid: record.uid,
      type: 'ip_award',
      amount: ip,
      currency: 'IP',
      refId: entryId,
      orgId: activity.orgId,
      actorUid,
      reason: 'attendance',
      createdAt: serverTimestamp(),
    })

    // Sayaçlar `increment` ile: kurum personeli `users` belgesini OKUYAMAZ,
    // mutlak değer yazsaydı araya giren başka bir puanı ezerdi.
    transaction.update(userDocRef(record.uid), {
      'stats.ip': increment(ip),
      'stats.hours': increment(hours),
      'stats.activitiesCompleted': increment(1),
      'stats.categoriesCount': increment(record.isNewCategory ? 1 : 0),
      // Katılım gerçekleşti → no-show serisi kırıldı (Bölüm 6).
      'stats.consecutiveNoShows': 0,
      'stats.level': levelFor(nextStats, config),
      // Kural hangi girdinin yazıldığını buradan bulup deltayı doğrular.
      lastAwardId: entryId,
    })

    transaction.update(recordRef(record.sessionId, record.uid), { awarded: true })

    return { awarded: true, ip, alreadyAwarded: false }
  })
}

/**
 * Bir aktivitenin bekleyen puanlarını işler.
 *
 * Kurum yoklama ekranını açtığında ve oturumu durdurduğunda çalışır —
 * `onAttendanceConfirmed` tetikleyicisinin elle karşılığı.
 */
export async function processPendingAwards(
  activity: Activity,
  records: AttendanceRecord[],
  actorUid: string,
): Promise<{ awarded: number; failed: number }> {
  let awarded = 0
  let failed = 0

  for (const record of records) {
    if (record.status !== 'confirmed' || record.awarded) continue
    try {
      const outcome = await awardAttendance(record, activity, actorUid)
      if (outcome.awarded) awarded += 1
    } catch (error) {
      console.error('[passport] Puan yazılamadı:', record.id, error)
      failed += 1
    }
  }

  return { awarded, failed }
}

/**
 * "Katıldım" iddiası onaylandığında pasaporta `source: 'admin'` ile işler
 * (CLAUDE.md Bölüm 2 onay akışı, item 8).
 */
export async function awardClaim(
  claim: { uid: string; activityId: string },
  activity: Activity,
  actorUid: string,
): Promise<AwardOutcome> {
  const config = await loadScoringConfig()
  const entryId = passportEntryId(activity.id, claim.uid)
  const entryRef = doc(db, PASSPORT_ENTRIES, entryId)
  const ledgerRef = doc(db, LEDGER, `${entryId}_award`)

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(entryRef)
    if (existing.exists()) return { awarded: false, ip: 0, alreadyAwarded: true }

    const ip = Math.min(activity.rewards.ip, config.maxIpPerActivity)

    transaction.set(entryRef, {
      uid: claim.uid,
      activityId: activity.id,
      orgId: activity.orgId,
      // 'admin' kaynağının dayanağı onaylanmış iddia; oturum yok.
      sessionId: '',
      categoryId: activity.categoryId,
      activityTitle: activity.title.de || activity.title.en,
      hours: activity.hoursCredited,
      ipAwarded: ip,
      skillsGained: activity.skillsGained,
      source: 'admin',
      status: 'completed',
      approvedAt: serverTimestamp(),
      bonuses: [],
    })

    transaction.set(ledgerRef, {
      uid: claim.uid,
      type: 'ip_award',
      amount: ip,
      currency: 'IP',
      refId: entryId,
      orgId: activity.orgId,
      actorUid,
      reason: 'claim_approved',
      createdAt: serverTimestamp(),
    })

    transaction.update(userDocRef(claim.uid), {
      'stats.ip': increment(ip),
      'stats.hours': increment(activity.hoursCredited),
      'stats.activitiesCompleted': increment(1),
      'stats.consecutiveNoShows': 0,
      lastAwardId: entryId,
    })

    return { awarded: true, ip, alreadyAwarded: false }
  })
}

// --- No-show cezası (item 7) -----------------------------------------------

/**
 * `markNoShows` — kabul edilip gelmeyene ceza (CLAUDE.md Bölüm 6).
 *
 * ⚠️ Spesifikasyonda bu, aktivite bitiminden 24 saat sonra çalışan
 * ZAMANLANMIŞ bir fonksiyon. Blaze kapalı olduğu için zamanlayıcı yok; kurum
 * personeli yoklama ekranında "gelmeyenleri işaretle" düğmesiyle tetikliyor.
 * Aynı iş, aynı kural; yalnız tetikleyici insan.
 *
 * `lastNoShowAt` damgasını kural `request.time` ile karşılaştırıyor, yani
 * ileri tarihli bir kısıt uydurulamıyor.
 */
export async function markNoShow(
  uid: string,
  activityId: string,
  penaltyIp: number,
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      transaction.update(userDocRef(uid), {
        'stats.ip': increment(-penaltyIp),
        'stats.noShows': increment(1),
        'stats.consecutiveNoShows': increment(1),
        lastNoShowAt: serverTimestamp(),
        // Kural cezanın hangi aktiviteden geldiğini doğruluyor: aktivite bu
        // kurumun olmalı, bitmiş olmalı, kişi kabul edilmiş olmalı.
        lastNoShowActivityId: activityId,
      })
    })
  } catch (error) {
    // Bakiyesi cezadan azsa kural `ip >= 0` şartında reddeder. O kişiyi
    // puansız bırakmak yerine cezayı atlayıp sayacı yine de artırıyoruz —
    // eldeki hiçbir şeyi olmayandan puan kesmenin anlamı yok.
    console.warn('[passport] IP cezası uygulanamadı, sayaç yine de artıyor:', error)
    await runTransaction(db, async (transaction) => {
      transaction.update(userDocRef(uid), {
        'stats.noShows': increment(1),
        'stats.consecutiveNoShows': increment(1),
        lastNoShowAt: serverTimestamp(),
        lastNoShowActivityId: activityId,
      })
    })
  }
}

// --- Okuma -----------------------------------------------------------------

export function watchMyPassport(
  uid: string,
  onChange: (entries: PassportEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, PASSPORT_ENTRIES),
    where('uid', '==', uid),
    orderBy('approvedAt', 'desc'),
    limit(200),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toEntry)), onError)
}

export async function fetchMyPassport(uid: string): Promise<PassportEntry[]> {
  const q = query(collection(db, PASSPORT_ENTRIES), where('uid', '==', uid), limit(200))
  return (await getDocs(q)).docs.map(toEntry)
}

/** Kullanıcının bu kategoride daha önce katılımı var mı? (tarama anında) */
export function hasCategory(entries: PassportEntry[], categoryId: CategoryId): boolean {
  return entries.some((entry) => entry.categoryId === categoryId)
}

/** Rozet hesabı için: kategori dağılımı, dil katılımı, en çok gidilen kurum. */
export function passportSummary(entries: PassportEntry[]): {
  categoryIds: CategoryId[]
  byCategory: { categoryId: CategoryId; count: number; hours: number }[]
  languageCount: number
  topOrgCount: number
  totalHours: number
} {
  const categories = new Map<CategoryId, { count: number; hours: number }>()
  const orgs = new Map<string, number>()
  let languageCount = 0
  let totalHours = 0

  for (const entry of entries) {
    const bucket = categories.get(entry.categoryId) ?? { count: 0, hours: 0 }
    bucket.count += 1
    bucket.hours += entry.hours
    categories.set(entry.categoryId, bucket)

    orgs.set(entry.orgId, (orgs.get(entry.orgId) ?? 0) + 1)

    if (
      entry.categoryId === 'language_teaching' ||
      entry.categoryId === 'language_learning'
    ) {
      languageCount += 1
    }
    totalHours += entry.hours
  }

  return {
    categoryIds: [...categories.keys()],
    byCategory: [...categories.entries()]
      .map(([categoryId, value]) => ({ categoryId, ...value }))
      .sort((a, b) => b.count - a.count),
    languageCount,
    topOrgCount: Math.max(0, ...orgs.values()),
    totalHours,
  }
}

/** Kurumun bir aktivitedeki tüm yoklama kayıtları (puanlama için tek atış). */
export async function fetchActivityRecordsOnce(
  activityId: string,
): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, RECORDS),
    where('activityId', '==', activityId),
    limit(500),
  )
  return (await getDocs(q)).docs.map((snapshot) => {
    const data = snapshot.data() as Partial<AttendanceRecord>
    return {
      id: snapshot.id,
      uid: data.uid ?? '',
      activityId: data.activityId ?? '',
      sessionId: data.sessionId ?? '',
      orgId: data.orgId ?? '',
      method: data.method ?? 'qr',
      scannedAt: data.scannedAt ?? null,
      status: data.status ?? 'confirmed',
      geoOk: data.geoOk ?? null,
      displayName: data.displayName ?? '',
      awarded: data.awarded === true,
      statsSnapshot: data.statsSnapshot ?? {
        ip: 0,
        hours: 0,
        activitiesCompleted: 0,
        categoriesCount: 0,
      },
      isNewCategory: data.isNewCategory === true,
    }
  })
}
