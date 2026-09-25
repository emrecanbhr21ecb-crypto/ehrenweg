/**
 * "Katıldım ama yoklama alınmadı" iddiaları — CLAUDE.md Bölüm 2 onay akışı,
 * Bölüm 5 `pendingClaims` (BazaltGo: `bekleyenOnaylar`).
 *
 * Akış: katılımcı fotoğraflı iddia açar → kurum personeli onaylar →
 * pasaporta `source: 'admin'` olarak işlenir (lib/passport.ts `awardClaim`).
 *
 * ⚠️ Fotoğraf Storage'a DEĞİL, belgeye data URL olarak yazılıyor: Storage
 * Blaze planı istiyor (docs/DECISIONS.md §7). Bu yüzden görsel istemcide
 * agresif küçültülüyor — Firestore belge sınırı 1 MB ve aşan yazma sessizce
 * değil, hata ile döner.
 */

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import {
  MAX_CLAIM_PHOTO_BYTES,
  type ClaimStatus,
  type PendingClaim,
} from '@/types/attendance'

export const CLAIMS = 'pendingClaims'

/** Bir kişi bir aktivite için tek iddia açabilir. */
export function claimId(activityId: string, uid: string): string {
  return `${activityId}_${uid}`
}

function toClaim(snapshot: QueryDocumentSnapshot): PendingClaim {
  const data = snapshot.data() as Partial<PendingClaim>
  return {
    id: snapshot.id,
    uid: data.uid ?? '',
    activityId: data.activityId ?? '',
    orgId: data.orgId ?? '',
    activityTitle: data.activityTitle ?? '',
    displayName: data.displayName ?? '',
    note: data.note ?? '',
    photoDataUrl: data.photoDataUrl ?? '',
    status: data.status ?? 'pending',
    createdAt: data.createdAt ?? null,
    reviewedBy: data.reviewedBy ?? null,
    reviewedAt: data.reviewedAt ?? null,
    reviewNote: data.reviewNote ?? '',
  }
}

/**
 * Fotoğrafı küçültüp JPEG data URL'e çevirir.
 *
 * Telefon kamerası 4 MB'lık dosya üretiyor; olduğu gibi yazmak hem belge
 * sınırını aşar hem de mobil veriyi yakar. 800 piksel, kalite 0,6 tipik
 * olarak 60–120 kB veriyor ve "orada olduğumu gösteren fotoğraf" için
 * fazlasıyla yeterli.
 */
export async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)

  const maxEdge = 800
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('[claims] Canvas bağlamı alınamadı.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Sınırı aşarsa kaliteyi düşürerek tekrar dene; üç denemede olmuyorsa
  // kullanıcıya "daha küçük bir fotoğraf seç" demek gerekir.
  for (const quality of [0.6, 0.45, 0.3]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_CLAIM_PHOTO_BYTES) return dataUrl
  }
  throw new Error('[claims] Fotoğraf küçültülemedi.')
}

export async function submitClaim(input: {
  uid: string
  displayName: string
  activityId: string
  orgId: string
  activityTitle: string
  note: string
  photoDataUrl: string
}): Promise<void> {
  await setDoc(doc(db, CLAIMS, claimId(input.activityId, input.uid)), {
    uid: input.uid,
    displayName: input.displayName,
    activityId: input.activityId,
    orgId: input.orgId,
    activityTitle: input.activityTitle,
    note: input.note,
    photoDataUrl: input.photoDataUrl,
    status: 'pending' satisfies ClaimStatus,
    createdAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: '',
  })
}

/** Kurum panelindeki bekleyen iddialar. */
export function watchOrgClaims(
  orgId: string,
  onChange: (claims: PendingClaim[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, CLAIMS),
    where('orgId', '==', orgId),
    where('status', '==', 'pending'),
    limit(100),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toClaim)), onError)
}

export function watchMyClaims(
  uid: string,
  onChange: (claims: PendingClaim[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, CLAIMS), where('uid', '==', uid), limit(50))
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toClaim)), onError)
}

export async function fetchMyClaim(
  activityId: string,
  uid: string,
): Promise<PendingClaim | null> {
  const q = query(
    collection(db, CLAIMS),
    where('uid', '==', uid),
    where('activityId', '==', activityId),
    limit(1),
  )
  const snapshot = await getDocs(q)
  const first = snapshot.docs[0]
  return first ? toClaim(first) : null
}

/** Kurum kararı. Onayda puan `awardClaim` ile ayrıca yazılır. */
export async function reviewClaim(
  id: string,
  decision: 'approve' | 'reject',
  reviewerUid: string,
  note = '',
): Promise<void> {
  await updateDoc(doc(db, CLAIMS, id), {
    status: (decision === 'approve' ? 'approved' : 'rejected') satisfies ClaimStatus,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    reviewNote: note,
  })
}
