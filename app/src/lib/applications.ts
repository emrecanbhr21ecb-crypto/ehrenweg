/**
 * Başvurular: başvur, geri çek, kurum kararı, "Başvurularım".
 *
 * CLAUDE.md Bölüm 12: `applyToActivity` (kontenjan ve son başvuru kontrolü
 * **transaction ile**), `decideApplication`.
 *
 * Blaze kapalı olduğu için transaction istemcide çalışıyor; kontenjan ve son
 * başvuru tarihini asıl garanti eden `firestore.rules`. İstemci transaction'ı
 * iki iş yapar:
 *   1. yarış durumunu çözer (iki kişi son kontenjana aynı anda başvurursa
 *      Firestore transaction'ı birini yeniden dener, ikincisi kuralda düşer),
 *   2. sayaç ile başvuru belgesini ATOMİK yazar — biri yazılıp diğeri
 *      yazılmazsa kontenjan sonsuza kadar bozulurdu.
 * Ayrıntı: docs/DECISIONS.md §7 ve `lib/backend.ts`.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import type { LanguageCode } from '@/config/catalog'
import type { ApplyErrorKey } from '@/lib/errorKey'
import { ACTIVITIES, activityRef } from '@/lib/activities'
import { callOrLocal } from '@/lib/backend'
import { db } from '@/lib/firebase'
import {
  EMPTY_TEXT,
  type Activity,
  type Application,
  type ApplicationStatus,
} from '@/types/activity'

export const APPLICANTS = 'applicants'

/** Belge kimliği = kullanıcı kimliği → bir kişi bir aktiviteye bir kez başvurur. */
export function applicantRef(activityId: string, uid: string) {
  return doc(db, ACTIVITIES, activityId, APPLICANTS, uid)
}

function toApplication(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): Application {
  const data = snapshot.data() as Partial<Application> | undefined
  return {
    activityId: data?.activityId ?? '',
    orgId: data?.orgId ?? '',
    uid: data?.uid ?? snapshot.id,
    status: data?.status ?? 'applied',
    message: data?.message ?? '',
    applicantName: data?.applicantName ?? '',
    applicantLanguages: data?.applicantLanguages ?? [],
    activityTitle: data?.activityTitle ?? EMPTY_TEXT,
    activityStartAt: data?.activityStartAt as Application['activityStartAt'],
    appliedAt: data?.appliedAt ?? null,
    decidedAt: data?.decidedAt ?? null,
    decidedBy: data?.decidedBy ?? null,
    decisionNote: data?.decisionNote ?? '',
    withdrawnAt: data?.withdrawnAt ?? null,
    attended: data?.attended === true,
  }
}

/** Başvuru sırasında kuruma kopyalanan asgari kimlik (Bölüm 10). */
export interface ApplicantIdentity {
  uid: string
  displayName: string
  languages: LanguageCode[]
}

/**
 * Başvuru reddi.
 *
 * `message` doğrudan bir çeviri anahtarıdır (`errors` ad alanı) — sunucu ve
 * istemci aynı anahtarları kullanınca Blaze açıldığında arayüz hiç değişmez.
 */
export class ApplyFailure extends Error {
  // Parametre özelliği (`constructor(public key)`) kullanılmıyor: tsconfig'de
  // `erasableSyntaxOnly` açık — TypeScript söz dizimi çalışma zamanı davranışı
  // üretmemeli, yalnız silinebilir tip bilgisi olmalı.
  readonly key: ApplyErrorKey

  constructor(key: ApplyErrorKey) {
    super(key)
    this.name = 'ApplyFailure'
    this.key = key
  }
}

/**
 * `applyToActivity` — kontenjan ve son başvuru kontrolü transaction içinde.
 *
 * Aynı commit'te iki yazma:
 *   `activities/{id}/applicants/{uid}`  → yeni başvuru
 *   `activities/{id}.stats.applicants`  → +1
 * Kural ikincisini yalnız birincisi aynı commit'te oluşturulduğunda
 * (`getAfter`) kabul ediyor; yani kimse sayacı tek başına oynatamaz.
 */
export async function applyToActivity(
  activity: Activity,
  applicant: ApplicantIdentity,
  message = '',
): Promise<void> {
  await callOrLocal(
    'applyToActivity',
    { activityId: activity.id, message },
    async (input) => {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(activityRef(input.activityId))
        if (!snapshot.exists()) throw new ApplyFailure('apply.notPublished')

        const data = snapshot.data() as Partial<Activity>
        if (data.status !== 'published') {
          throw new ApplyFailure('apply.notPublished')
        }

        const now = Date.now()
        if (data.startAt && data.startAt.toDate().getTime() <= now) {
          throw new ApplyFailure('apply.started')
        }
        if (
          data.applicationDeadline &&
          data.applicationDeadline.toDate().getTime() < now
        ) {
          throw new ApplyFailure('apply.deadlinePassed')
        }

        const applicants = data.stats?.applicants ?? 0
        const capacity = data.capacity ?? 0
        if (applicants >= capacity) throw new ApplyFailure('apply.full')

        const existingRef = applicantRef(input.activityId, applicant.uid)
        const existing = await transaction.get(existingRef)
        if (existing.exists() && existing.data()['status'] !== 'withdrawn') {
          throw new ApplyFailure('apply.alreadyApplied')
        }

        transaction.set(existingRef, {
          activityId: input.activityId,
          orgId: data.orgId ?? '',
          uid: applicant.uid,
          status: 'applied' satisfies ApplicationStatus,
          message: input.message,
          applicantName: applicant.displayName,
          applicantLanguages: applicant.languages,
          activityTitle: data.title ?? EMPTY_TEXT,
          activityStartAt: data.startAt ?? null,
          appliedAt: serverTimestamp(),
          decidedAt: null,
          decidedBy: null,
          decisionNote: '',
          withdrawnAt: null,
          attended: false,
        })

        transaction.update(activityRef(input.activityId), {
          stats: { applicants: applicants + 1, attendees: data.stats?.attendees ?? 0 },
        })
      })
    },
  )
}

/**
 * Başvuruyu geri çekme.
 *
 * Belge SİLİNMEZ, `withdrawn` olur: kurum "üç kişi başvurup vazgeçti" bilgisini
 * görebilmeli, ayrıca silme kontenjan sayacını kurala kanıtlatmayı
 * imkânsızlaştırırdı (silinen belgenin `getAfter`'ı yok).
 */
export async function withdrawApplication(
  activityId: string,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const activitySnapshot = await transaction.get(activityRef(activityId))
    const applicationSnapshot = await transaction.get(applicantRef(activityId, uid))

    if (!applicationSnapshot.exists()) return
    const status = applicationSnapshot.data()['status'] as ApplicationStatus
    if (status === 'withdrawn') return

    const stats = (activitySnapshot.data()?.['stats'] ?? {
      applicants: 0,
      attendees: 0,
    }) as { applicants: number; attendees: number }

    transaction.update(applicantRef(activityId, uid), {
      status: 'withdrawn' satisfies ApplicationStatus,
      withdrawnAt: serverTimestamp(),
    })

    transaction.update(activityRef(activityId), {
      stats: {
        applicants: Math.max(0, stats.applicants - 1),
        attendees: stats.attendees,
      },
    })
  })
}

/** `decideApplication` — kurum kabul/red kararı. */
export async function decideApplication(
  activityId: string,
  applicantUid: string,
  decision: 'accept' | 'reject',
  deciderUid: string,
  note = '',
): Promise<void> {
  await callOrLocal(
    'decideApplication',
    { activityId, applicantUid, decision, note },
    async (input) => {
      await updateDoc(applicantRef(input.activityId, input.applicantUid), {
        status: (input.decision === 'accept'
          ? 'accepted'
          : 'rejected') satisfies ApplicationStatus,
        decidedAt: serverTimestamp(),
        decidedBy: deciderUid,
        decisionNote: input.note,
      })
    },
  )
}

// --- Okuma -----------------------------------------------------------------

export async function fetchMyApplication(
  activityId: string,
  uid: string,
): Promise<Application | null> {
  const snapshot = await getDoc(applicantRef(activityId, uid))
  return snapshot.exists() ? toApplication(snapshot) : null
}

export function watchMyApplication(
  activityId: string,
  uid: string,
  onChange: (application: Application | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    applicantRef(activityId, uid),
    (snapshot) => onChange(snapshot.exists() ? toApplication(snapshot) : null),
    onError,
  )
}

/** Kurum panelindeki başvuran listesi. */
export function watchApplicants(
  activityId: string,
  onChange: (applications: Application[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ACTIVITIES, activityId, APPLICANTS),
    orderBy('appliedAt', 'asc'),
  )
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(toApplication)),
    onError,
  )
}

/**
 * "Başvurularım" — collection group sorgusu.
 *
 * Sıralama istemcide: `orderBy` eklemek collection group için ayrı bileşik
 * indeks isterdi ve bir kullanıcının başvuru sayısı zaten iki haneli.
 */
export function watchMyApplications(
  uid: string,
  onChange: (applications: Application[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collectionGroup(db, APPLICANTS), where('uid', '==', uid))
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map(toApplication)
      rows.sort((a, b) => {
        const left = a.activityStartAt?.toMillis?.() ?? 0
        const right = b.activityStartAt?.toMillis?.() ?? 0
        return right - left
      })
      onChange(rows)
    },
    onError,
  )
}
