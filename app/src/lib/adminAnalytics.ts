/**
 * Platform admin — sistem geneli istatistik ve şüpheli işlem panosu.
 * CLAUDE.md Bölüm 9: "sistem geneli istatistik … şüpheli işlem panosu."
 *
 * Sayımlar `getCountFromServer`/`getAggregateFromServer` ile — tüm belgeleri
 * indirmeden (Firestore bunu toplama sorgusu olarak faturalandırır, tam
 * okuma değil). `firestore.rules`teki `isAdmin()` koşulu `resource.data`'ya
 * bakmadığı için bu toplama sorguları admin'de filtresiz çalışır.
 */

import {
  collection,
  collectionGroup,
  count,
  getAggregateFromServer,
  getCountFromServer,
  getDocs,
  limit,
  query,
  sum,
  where,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import type { RewardTemplate, Voucher } from '@/types/reward'

export interface SystemStats {
  users: number
  organisations: number
  verifiedOrganisations: number
  activities: number
  publishedActivities: number
  participations: number
  ipAwarded: number
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const [users, orgs, verifiedOrgs, activities, publishedActivities, passportAgg] =
    await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'organizations')),
      getCountFromServer(
        query(collection(db, 'organizations'), where('verified', '==', true)),
      ),
      getCountFromServer(collection(db, 'activities')),
      getCountFromServer(
        query(collection(db, 'activities'), where('status', '==', 'published')),
      ),
      getAggregateFromServer(collection(db, 'passportEntries'), {
        count: count(),
        ipAwarded: sum('ipAwarded'),
      }),
    ])

  return {
    users: users.data().count,
    organisations: orgs.data().count,
    verifiedOrganisations: verifiedOrgs.data().count,
    activities: activities.data().count,
    publishedActivities: publishedActivities.data().count,
    participations: passportAgg.data().count,
    ipAwarded: passportAgg.data().ipAwarded ?? 0,
  }
}

// --- Şüpheli işlem panosu (CLAUDE.md Bölüm 7.5) -----------------------------

export interface HighAcceptRateSignal {
  kind: 'highAcceptRate'
  orgId: string
  orgName: string
  accepted: number
  total: number
  rate: number
}

export interface NearVoucherCapSignal {
  kind: 'nearVoucherCap'
  uid: string
  orgId: string
  orgName: string
  count: number
  cap: number
}

export type FraudSignal = HighAcceptRateSignal | NearVoucherCapSignal

const MIN_APPLICATIONS_FOR_SIGNAL = 10
const ACCEPT_RATE_MARGIN = 0.3

/**
 * Kurum bazında olağandışı yüksek kabul oranı.
 *
 * Yalnız en çok 50 doğrulanmış kurum taranır: pilot ölçeğinde hepsini
 * kapsar, büyürse admin panelinin her açılışında onlarca toplama sorgusu
 * birikmesin diye bir üst sınır var.
 */
async function highAcceptRateSignals(): Promise<HighAcceptRateSignal[]> {
  const orgsSnapshot = await getDocs(
    query(collection(db, 'organizations'), where('verified', '==', true), limit(50)),
  )

  const rows = await Promise.all(
    orgsSnapshot.docs.map(async (orgDoc) => {
      const [totalAgg, acceptedAgg] = await Promise.all([
        getCountFromServer(
          query(collectionGroup(db, 'applicants'), where('orgId', '==', orgDoc.id)),
        ),
        getCountFromServer(
          query(
            collectionGroup(db, 'applicants'),
            where('orgId', '==', orgDoc.id),
            where('status', '==', 'accepted'),
          ),
        ),
      ])
      const total = totalAgg.data().count
      const accepted = acceptedAgg.data().count
      return {
        orgId: orgDoc.id,
        orgName: (orgDoc.data()['name'] as string | undefined) ?? orgDoc.id,
        total,
        accepted,
        rate: total > 0 ? accepted / total : 0,
      }
    }),
  )

  const withEnoughData = rows.filter((row) => row.total >= MIN_APPLICATIONS_FOR_SIGNAL)
  if (withEnoughData.length === 0) return []

  const platformAverage =
    withEnoughData.reduce((sum, row) => sum + row.rate, 0) / withEnoughData.length

  return withEnoughData
    .filter((row) => row.rate - platformAverage >= ACCEPT_RATE_MARGIN)
    .map((row) => ({
      kind: 'highAcceptRate' as const,
      orgId: row.orgId,
      orgName: row.orgName,
      accepted: row.accepted,
      total: row.total,
      rate: row.rate,
    }))
}

/** Kişi başı aylık kupon sınırına yaklaşan/ulaşan kullanıcılar. */
async function nearVoucherCapSignals(): Promise<NearVoucherCapSignal[]> {
  const since = new Date()
  since.setDate(since.getDate() - 31)

  const [vouchersSnapshot, templatesSnapshot, orgsSnapshot] = await Promise.all([
    getDocs(
      query(collection(db, 'vouchers'), where('issuedAt', '>=', since), limit(3000)),
    ),
    getDocs(query(collection(db, 'rewardTemplates'), limit(500))),
    getDocs(query(collection(db, 'organizations'), limit(500))),
  ])

  const caps = new Map<string, number>()
  for (const snapshot of templatesSnapshot.docs) {
    const data = snapshot.data() as Partial<RewardTemplate>
    if (data.maxPerUserPerMonth) caps.set(snapshot.id, data.maxPerUserPerMonth)
  }
  const orgNames = new Map<string, string>()
  for (const snapshot of orgsSnapshot.docs) {
    orgNames.set(
      snapshot.id,
      (snapshot.data()['name'] as string | undefined) ?? snapshot.id,
    )
  }

  const counts = new Map<string, number>()
  for (const snapshot of vouchersSnapshot.docs) {
    const voucher = snapshot.data() as Partial<Voucher>
    if (!voucher.uid || !voucher.templateId) continue
    const key = `${voucher.uid}__${voucher.templateId}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const signals: NearVoucherCapSignal[] = []
  for (const [key, count] of counts) {
    const [uid, templateId] = key.split('__') as [string, string]
    const cap = caps.get(templateId)
    if (!cap || count < cap) continue
    const voucher = vouchersSnapshot.docs
      .map((snapshot) => snapshot.data() as Partial<Voucher>)
      .find((entry) => entry.uid === uid && entry.templateId === templateId)
    signals.push({
      kind: 'nearVoucherCap',
      uid,
      orgId: voucher?.orgId ?? '',
      orgName: orgNames.get(voucher?.orgId ?? '') ?? '',
      count,
      cap,
    })
  }
  return signals
}

export async function fetchFraudSignals(): Promise<FraudSignal[]> {
  const [highAccept, nearCap] = await Promise.all([
    highAcceptRateSignals(),
    nearVoucherCapSignals(),
  ])
  return [...highAccept, ...nearCap]
}
