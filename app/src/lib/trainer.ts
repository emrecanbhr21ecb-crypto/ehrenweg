/**
 * Eğitmen başvurusu, inceleme ve eğitim geri bildirimi — CLAUDE.md Bölüm 8.
 *
 * ⚠️ MİMARİ SAPMA (docs/DECISIONS.md §11): Bölüm 8 onayı
 * `reviewTrainerApplication` fonksiyonuna ve `trainer` custom claim'ine
 * bağlıyor. Blaze kapalı → claim yazılamıyor. Faz 2'deki kurum rolü
 * çözümünün aynısı uygulanıyor: admin `users/{uid}.trainerStatus` alanını
 * 'approved' yapıyor ve `firestore.rules` claim'de `trainer` bulamazsa bu
 * alana düşüyor.
 *
 * Güvenlik eşdeğer: `trainerStatus` alanını kullanıcı YAZAMAZ (users update
 * kuralındaki izinli alan listesinde yok), yalnız platform admin yazabilir.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { ACTIVITIES } from '@/lib/activities'
import { db } from '@/lib/firebase'
import { userDocRef } from '@/lib/userProfile'
import type {
  TrainerApplication,
  TrainerApplicationForm,
  TrainerSnapshot,
  TrainingFeedback,
} from '@/types/trainer'

export const TRAINER_APPLICATIONS = 'trainerApplications'
export const FEEDBACK = 'feedback'

export function trainerApplicationRef(uid: string) {
  return doc(db, TRAINER_APPLICATIONS, uid)
}

function toApplication(snapshot: QueryDocumentSnapshot): TrainerApplication {
  const data = snapshot.data() as Partial<TrainerApplication>
  return {
    uid: data.uid ?? snapshot.id,
    displayName: data.displayName ?? '',
    email: data.email ?? '',
    status: data.status ?? 'pending',
    topics: data.topics ?? [],
    teachingLanguage: data.teachingLanguage ?? '',
    teachingLanguageLevel: data.teachingLanguageLevel ?? '',
    motivation: data.motivation ?? '',
    certificateDataUrl: data.certificateDataUrl ?? '',
    snapshot: data.snapshot ?? {
      level: 1,
      hours: 0,
      activitiesCompleted: 0,
      noShows: 0,
      noShowRate: 0,
      accountAgeDays: 0,
    },
    submittedAt: data.submittedAt ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
    note: data.note ?? '',
  }
}

export async function fetchMyTrainerApplication(
  uid: string,
): Promise<TrainerApplication | null> {
  const snapshot = await getDoc(trainerApplicationRef(uid))
  if (!snapshot.exists()) return null
  return toApplication(snapshot as QueryDocumentSnapshot)
}

/** Başvuru gönder. Kimlik = uid, yani bir kişi bir başvuru. */
export async function submitTrainerApplication(
  form: TrainerApplicationForm,
  applicant: { uid: string; displayName: string; email: string },
  snapshot: TrainerSnapshot,
  certificateDataUrl: string,
): Promise<void> {
  await setDoc(trainerApplicationRef(applicant.uid), {
    uid: applicant.uid,
    displayName: applicant.displayName,
    email: applicant.email,
    status: 'pending',
    topics: form.topics,
    teachingLanguage: form.teachingLanguage,
    teachingLanguageLevel: form.teachingLanguageLevel,
    motivation: form.motivation,
    certificateDataUrl,
    // Karar başvuru anındaki duruma göre verilsin (types/trainer.ts).
    snapshot,
    submittedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    note: '',
  })
}

export function watchPendingTrainerApplications(
  onChange: (applications: TrainerApplication[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, TRAINER_APPLICATIONS),
    where('status', '==', 'pending'),
    limit(100),
  )
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(toApplication)),
    onError,
  )
}

/**
 * `reviewTrainerApplication` — admin onaylar veya gerekçeyle reddeder.
 *
 * Onayda iki yazma: başvuru belgesi ve kullanıcının `trainerStatus` alanı.
 * İkincisi olmadan kullanıcı eğitmen YETKİSİ kazanmaz — kural o alana bakıyor.
 */
export async function reviewTrainerApplication(
  uid: string,
  decision: 'approve' | 'reject',
  reviewerUid: string,
  note = '',
): Promise<void> {
  const approved = decision === 'approve'

  await updateDoc(trainerApplicationRef(uid), {
    status: approved ? 'approved' : 'rejected',
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    note,
  })

  await updateDoc(userDocRef(uid), {
    trainerStatus: approved ? 'approved' : 'rejected',
    roleDisplay: approved ? 'trainer' : 'participant',
  })
}

// --- Eğitim geri bildirimi -------------------------------------------------

function toFeedback(snapshot: QueryDocumentSnapshot): TrainingFeedback {
  const data = snapshot.data() as Partial<TrainingFeedback>
  return {
    uid: data.uid ?? snapshot.id,
    activityId: data.activityId ?? '',
    trainerUid: data.trainerUid ?? '',
    orgId: data.orgId ?? '',
    rating: data.rating ?? 0,
    comment: data.comment ?? '',
    displayName: data.displayName ?? '',
    hidden: data.hidden === true,
    createdAt: data.createdAt ?? null,
  }
}

export async function submitFeedback(
  activityId: string,
  input: {
    uid: string
    displayName: string
    trainerUid: string
    orgId: string
    rating: number
    comment: string
  },
): Promise<void> {
  await setDoc(doc(db, ACTIVITIES, activityId, FEEDBACK, input.uid), {
    uid: input.uid,
    activityId,
    trainerUid: input.trainerUid,
    orgId: input.orgId,
    rating: input.rating,
    comment: input.comment,
    displayName: input.displayName,
    hidden: false,
    createdAt: serverTimestamp(),
  })
}

export async function fetchMyFeedback(
  activityId: string,
  uid: string,
): Promise<TrainingFeedback | null> {
  const snapshot = await getDoc(doc(db, ACTIVITIES, activityId, FEEDBACK, uid))
  if (!snapshot.exists()) return null
  return toFeedback(snapshot as QueryDocumentSnapshot)
}

export function watchActivityFeedback(
  activityId: string,
  onChange: (entries: TrainingFeedback[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ACTIVITIES, activityId, FEEDBACK),
    orderBy('createdAt', 'desc'),
    limit(200),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toFeedback)), onError)
}

/** Kurum uygunsuz yorumu gizler (Bölüm 8). Yorum SİLİNMEZ, gizlenir. */
export async function setFeedbackHidden(
  activityId: string,
  uid: string,
  hidden: boolean,
): Promise<void> {
  await updateDoc(doc(db, ACTIVITIES, activityId, FEEDBACK, uid), { hidden })
}

/**
 * Bir eğitmenin tüm geri bildirimleri — profilindeki ortalama için.
 * `collectionGroup` ile: eğitmen birden çok kurumda ders veriyor olabilir.
 */
export async function fetchTrainerFeedback(
  trainerUid: string,
): Promise<TrainingFeedback[]> {
  const { collectionGroup } = await import('firebase/firestore')
  const q = query(
    collectionGroup(db, FEEDBACK),
    where('trainerUid', '==', trainerUid),
    limit(500),
  )
  return (await getDocs(q)).docs.map(toFeedback)
}
