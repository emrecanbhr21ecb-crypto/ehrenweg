/**
 * Kurum analitiği — CLAUDE.md Bölüm 9: "başvuru→katılım oranı, kategori
 * dağılımı, en çok katılım alan aktiviteler, PDF rapor".
 *
 * `activity.stats.attendees` hiçbir yerde ARTIRILMIYOR (Blaze kapalı,
 * `onAttendanceConfirmed` yok — docs/DECISIONS.md §9). Katılım sayısı bu
 * yüzden gerçek kaynaktan, `passportEntries`ten sayılıyor: orada bir satır
 * = bir onaylı, puanlanmış katılım.
 */

import { collection, getDocs, limit, query, where } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { fetchOrgVouchers } from '@/lib/rewards'
import type { Activity } from '@/types/activity'
import type { CategoryId } from '@/config/catalog'
import type { PassportEntry } from '@/types/attendance'

export async function fetchOrgPassportEntries(orgId: string): Promise<PassportEntry[]> {
  const q = query(
    collection(db, 'passportEntries'),
    where('orgId', '==', orgId),
    limit(5000),
  )
  return (await getDocs(q)).docs.map((snapshot) => snapshot.data() as PassportEntry)
}

export interface ActivityParticipation {
  activityId: string
  title: string
  categoryId: CategoryId
  applicants: number
  attendances: number
}

export interface OrgAnalytics {
  totalApplications: number
  totalAttendances: number
  /** 0–1. `null` = hiç başvuru şartlı aktivite yok, oran anlamsız. */
  attendanceRate: number | null
  byCategory: { categoryId: CategoryId; count: number; hours: number }[]
  topActivities: ActivityParticipation[]
  totalIpAwarded: number
  distinctParticipants: number
  vouchersIssued: number
  vouchersValueCents: number
}

/**
 * Tüm hesap tek yerde, saf fonksiyon — bileşen yalnız veriyi çeker ve
 * çizer. Böylece `tests/` içinde ağsız test edilebilir.
 */
export function computeOrgAnalytics(
  activities: Activity[],
  entries: PassportEntry[],
  vouchers: { valueCents: number }[],
): OrgAnalytics {
  const attendancesByActivity = new Map<string, number>()
  const byCategory = new Map<CategoryId, { count: number; hours: number }>()
  const participants = new Set<string>()
  let totalIpAwarded = 0

  for (const entry of entries) {
    attendancesByActivity.set(
      entry.activityId,
      (attendancesByActivity.get(entry.activityId) ?? 0) + 1,
    )
    const bucket = byCategory.get(entry.categoryId) ?? { count: 0, hours: 0 }
    bucket.count += 1
    bucket.hours += entry.hours
    byCategory.set(entry.categoryId, bucket)
    participants.add(entry.uid)
    totalIpAwarded += entry.ipAwarded
  }

  // Yalnız "başvuru şartlı" aktiviteler orana girer — serbest katılımlı bir
  // etkinlikte `applicants` hep 0'dır ve oranı anlamsızca düşürürdü.
  const applicableActivities = activities.filter(
    (activity) => activity.requiresApplication,
  )
  const totalApplications = applicableActivities.reduce(
    (sum, activity) => sum + activity.stats.applicants,
    0,
  )
  const totalAttendances = entries.length

  const topActivities: ActivityParticipation[] = activities
    .map((activity) => ({
      activityId: activity.id,
      title: activity.title.de || activity.title.en,
      categoryId: activity.categoryId,
      applicants: activity.stats.applicants,
      attendances: attendancesByActivity.get(activity.id) ?? 0,
    }))
    .sort((a, b) => b.attendances - a.attendances)
    .slice(0, 10)

  return {
    totalApplications,
    totalAttendances,
    attendanceRate: totalApplications > 0 ? totalAttendances / totalApplications : null,
    byCategory: [...byCategory.entries()]
      .map(([categoryId, value]) => ({ categoryId, ...value }))
      .sort((a, b) => b.count - a.count),
    topActivities,
    totalIpAwarded,
    distinctParticipants: participants.size,
    vouchersIssued: vouchers.length,
    vouchersValueCents: vouchers.reduce((sum, voucher) => sum + voucher.valueCents, 0),
  }
}

export { fetchOrgVouchers }
