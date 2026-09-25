/**
 * Aktiviteler: oluşturma, taslak → onaya gönder → yayında akışı, listeleme.
 *
 * CLAUDE.md Bölüm 5 (veri modeli), Bölüm 9 (ekranlar), Bölüm 12 (fonksiyonlar).
 * Cloud Functions yerine istemci + kural modeli için bkz. `lib/backend.ts`.
 */

import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import type { CategoryId, LanguageCode, SkillId } from '@/config/catalog'
import { callOrLocal } from '@/lib/backend'
import { db } from '@/lib/firebase'
import { distanceKm, type GeoPoint } from '@/lib/geo'
import {
  EMPTY_TEXT,
  pickText,
  type Activity,
  type ActivityFilters,
  type ActivityFormValues,
  type ActivityStatus,
} from '@/types/activity'
import type { Locale } from '@/config/brand'

export const ACTIVITIES = 'activities'

export function activityRef(activityId: string) {
  return doc(db, ACTIVITIES, activityId)
}

export function toActivity(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): Activity {
  const data = snapshot.data() as Partial<Activity> | undefined
  const now = Timestamp.now()

  return {
    id: snapshot.id,
    orgId: data?.orgId ?? '',
    orgName: data?.orgName ?? '',
    createdBy: data?.createdBy ?? '',
    type: data?.type ?? 'volunteering',
    ...(data?.trainerUid ? { trainerUid: data.trainerUid } : {}),

    title: data?.title ?? EMPTY_TEXT,
    description: data?.description ?? EMPTY_TEXT,
    simpleDescription: data?.simpleDescription ?? EMPTY_TEXT,

    categoryId: data?.categoryId ?? 'other',
    skillsGained: data?.skillsGained ?? [],
    languagesUsed: data?.languagesUsed ?? [],

    location: {
      address: data?.location?.address ?? '',
      lat: data?.location?.lat ?? null,
      lng: data?.location?.lng ?? null,
    },
    online: data?.online === true,

    startAt: data?.startAt ?? now,
    endAt: data?.endAt ?? now,
    applicationDeadline: data?.applicationDeadline ?? null,
    capacity: data?.capacity ?? 0,
    requiresApplication: data?.requiresApplication !== false,
    minLevel: data?.minLevel ?? 0,

    status: data?.status ?? 'draft',
    rewards: { ip: data?.rewards?.ip ?? 0 },
    hoursCredited: data?.hoursCredited ?? 0,
    coverImageURL: data?.coverImageURL ?? null,
    passportEnabled: data?.passportEnabled !== false,

    stats: {
      applicants: data?.stats?.applicants ?? 0,
      attendees: data?.stats?.attendees ?? 0,
    },

    submittedAt: data?.submittedAt ?? null,
    reviewedBy: data?.reviewedBy ?? null,
    reviewedAt: data?.reviewedAt ?? null,
    reviewNote: data?.reviewNote ?? '',

    createdAt: data?.createdAt ?? null,
    ...(data?.seed ? { seed: true } : {}),
  }
}

/** `datetime-local` dizgesini Timestamp'e çevirir. Boşsa null. */
function toTimestamp(value: string): Timestamp | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

/** Timestamp'i `datetime-local` girdisinin beklediği yerel dizgeye çevirir. */
export function toLocalInputValue(value: Timestamp | null): string {
  if (!value) return ''
  const date = value.toDate()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Formdan Firestore alanlarına. Sunucu alanları (stats, status) burada YOK. */
function formToFields(values: ActivityFormValues): Record<string, unknown> {
  const start = toTimestamp(values.startAt)
  const end = toTimestamp(values.endAt)
  if (!start || !end) throw new Error('[activities] Geçersiz tarih.')

  return {
    type: values.type,
    title: values.title,
    description: values.description,
    simpleDescription: values.simpleDescription,
    categoryId: values.categoryId as CategoryId,
    skillsGained: values.skillsGained as SkillId[],
    languagesUsed: values.languagesUsed as LanguageCode[],
    location: {
      address: values.online ? values.address : values.address,
      lat: values.lat,
      lng: values.lng,
    },
    online: values.online,
    startAt: start,
    endAt: end,
    applicationDeadline: toTimestamp(values.applicationDeadline),
    capacity: values.capacity,
    requiresApplication: values.requiresApplication,
    minLevel: values.minLevel,
    rewards: { ip: values.rewardIp },
    hoursCredited: values.hoursCredited,
    coverImageURL: values.coverImageURL === '' ? null : values.coverImageURL,
    passportEnabled: values.passportEnabled,
  }
}

/** Aktiviteyi TASLAK olarak oluşturur. Yayına girmesi için onay şarttır. */
export async function createActivityDraft(
  values: ActivityFormValues,
  context: { orgId: string; orgName: string; uid: string },
): Promise<string> {
  const ref = await addDoc(collection(db, ACTIVITIES), {
    ...formToFields(values),
    orgId: context.orgId,
    orgName: context.orgName,
    createdBy: context.uid,
    status: 'draft' satisfies ActivityStatus,
    stats: { applicants: 0, attendees: 0 },
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: '',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateActivityContent(
  activityId: string,
  values: ActivityFormValues,
): Promise<void> {
  await updateDoc(activityRef(activityId), formToFields(values))
}

/** Taslak silme — yalnız hiç yayınlanmamış aktivitede. */
export async function deleteActivityDraft(activityId: string): Promise<void> {
  await deleteDoc(activityRef(activityId))
}

// --- Durum geçişleri -------------------------------------------------------

/**
 * `submitActivity` — taslağı moderasyona gönderir (CLAUDE.md Bölüm 12).
 * Kural yalnız `draft → pending_review` geçişine izin verir.
 */
export async function submitActivity(activityId: string): Promise<void> {
  await callOrLocal('submitActivity', { activityId }, async ({ activityId: id }) => {
    await updateDoc(activityRef(id), {
      status: 'pending_review' satisfies ActivityStatus,
      submittedAt: serverTimestamp(),
      reviewNote: '',
    })
  })
}

/** Kurum incelemeden geri çeker (pending_review → draft). */
export async function withdrawFromReview(activityId: string): Promise<void> {
  await updateDoc(activityRef(activityId), {
    status: 'draft' satisfies ActivityStatus,
    submittedAt: null,
  })
}

/**
 * `reviewActivity` — platform admin onaylar veya gerekçeyle reddeder.
 *
 * Reddedilen aktivite SİLİNMEZ, `draft`'a döner ve `reviewNote` ile kuruma
 * ne düzelteceği söylenir. Bir belediye çalışanının emeğini sessizce çöpe
 * atmak, kurumu platformdan soğutur.
 */
export async function reviewActivity(
  activityId: string,
  decision: 'approve' | 'reject',
  reviewer: string,
  note = '',
): Promise<void> {
  await callOrLocal('reviewActivity', { activityId, decision, note }, async (input) => {
    await updateDoc(activityRef(input.activityId), {
      status: (input.decision === 'approve'
        ? 'published'
        : 'draft') satisfies ActivityStatus,
      reviewedBy: reviewer,
      reviewedAt: serverTimestamp(),
      reviewNote: input.note,
    })
  })
}

/** Yayındaki aktiviteyi iptal eder. Başvuranlar listede "iptal" görür. */
export async function cancelActivity(activityId: string): Promise<void> {
  await updateDoc(activityRef(activityId), {
    status: 'cancelled' satisfies ActivityStatus,
  })
}

// --- Okuma -----------------------------------------------------------------

export async function fetchActivity(activityId: string): Promise<Activity | null> {
  const snapshot = await getDoc(activityRef(activityId))
  return snapshot.exists() ? toActivity(snapshot) : null
}

export function watchActivity(
  activityId: string,
  onChange: (activity: Activity | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    activityRef(activityId),
    (snapshot) => onChange(snapshot.exists() ? toActivity(snapshot) : null),
    onError,
  )
}

/**
 * Yayındaki aktiviteler.
 *
 * Sorgu yalnız `status` + `startAt` üzerinden gider; kategori, dil, mesafe ve
 * arama istemcide süzülür. Gerekçe: her filtre birleşimi için ayrı bileşik
 * indeks açmak (kategori × dil × online × tarih) onlarca indeks demek olurdu.
 * Pilot ölçeğinde (bir ilçe, birkaç yüz aktivite) istemci süzgeci hem yeterli
 * hem de anında. Ölçek büyüyünce burası Faz 6'daki arama servisine taşınır.
 */
export function watchPublishedActivities(
  onChange: (activities: Activity[]) => void,
  onError?: (error: Error) => void,
  max = 200,
): Unsubscribe {
  const q = query(
    collection(db, ACTIVITIES),
    where('status', '==', 'published'),
    orderBy('startAt', 'asc'),
    limit(max),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toActivity)), onError)
}

/** Kurum panelindeki liste — her durumdaki kendi aktiviteleri. */
export function watchOrgActivities(
  orgId: string,
  onChange: (activities: Activity[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ACTIVITIES),
    where('orgId', '==', orgId),
    orderBy('startAt', 'desc'),
    limit(200),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toActivity)), onError)
}

/** Platform admin moderasyon kuyruğu. */
export function watchPendingActivities(
  onChange: (activities: Activity[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ACTIVITIES),
    where('status', '==', 'pending_review'),
    orderBy('createdAt', 'asc'),
    limit(100),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toActivity)), onError)
}

// --- İstemci tarafı süzgeç -------------------------------------------------

export interface FilterContext {
  locale: Locale
  origin: GeoPoint | null
  now?: Date
}

/** Aktiviteye kullanıcının konumundan mesafe (km). Ölçülemiyorsa null. */
export function activityDistance(
  activity: Activity,
  origin: GeoPoint | null,
): number | null {
  if (!origin) return null
  const { lat, lng } = activity.location
  if (lat === null || lng === null) return null
  return distanceKm(origin, { lat, lng })
}

export function applyFilters(
  activities: Activity[],
  filters: ActivityFilters,
  context: FilterContext,
): Activity[] {
  const now = context.now ?? new Date()
  const needle = filters.search.trim().toLocaleLowerCase(context.locale)
  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : null
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59`) : null

  return activities.filter((activity) => {
    const start = activity.startAt.toDate()

    if (filters.upcomingOnly && activity.endAt.toDate().getTime() < now.getTime()) {
      return false
    }
    if (from && start.getTime() < from.getTime()) return false
    if (to && start.getTime() > to.getTime()) return false

    if (
      filters.categoryIds.length > 0 &&
      !filters.categoryIds.includes(activity.categoryId)
    ) {
      return false
    }
    if (filters.type !== 'all' && activity.type !== filters.type) return false
    if (filters.onlineOnly && !activity.online) return false

    if (
      filters.language !== 'all' &&
      !activity.languagesUsed.includes(filters.language)
    ) {
      return false
    }

    if (filters.maxDistanceKm !== null && !activity.online) {
      const distance = activityDistance(activity, context.origin)
      // Konum yoksa mesafe filtresi kimseyi elemez — kullanıcı boş liste
      // karşısında neden boş olduğunu anlayamazdı.
      if (distance !== null && distance > filters.maxDistanceKm) return false
    }

    if (needle) {
      const haystack = [
        pickText(activity.title, context.locale),
        pickText(activity.description, context.locale),
        activity.orgName,
        activity.location.address,
      ]
        .join(' ')
        .toLocaleLowerCase(context.locale)
      if (!haystack.includes(needle)) return false
    }

    return true
  })
}

/** Başvuruya hâlâ açık mı? (kontenjan + son başvuru + durum) */
export function isOpenForApplication(activity: Activity, now = new Date()): boolean {
  if (activity.status !== 'published') return false
  if (activity.startAt.toDate().getTime() <= now.getTime()) return false
  if (
    activity.applicationDeadline &&
    activity.applicationDeadline.toDate().getTime() < now.getTime()
  ) {
    return false
  }
  return activity.stats.applicants < activity.capacity
}

export function remainingSpots(activity: Activity): number {
  return Math.max(0, activity.capacity - activity.stats.applicants)
}
