/**
 * Duyurular ve bildirim tercihleri — CLAUDE.md Bölüm 9 ve 12.
 *
 * ⚠️ Push GÖNDERME sunucu işi (`sendAnnouncement`, FCM). Blaze kapalı, yani
 * bugün duyuru yazılıyor ve uygulama içinde görünüyor ama **telefona push
 * düşmüyor**. Fonksiyon `functions/src/notifications.ts` içinde yazılı ve
 * Blaze açıldığı gün `pushSent` bayrağını da o dolduracak. Arayüz bu farkı
 * kullanıcıdan gizlemiyor.
 */

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { EMPTY_TEXT } from '@/types/activity'
import {
  DEFAULT_SETTINGS,
  type Announcement,
  type AnnouncementForm,
  type NotificationSettings,
} from '@/types/announcement'

export const ANNOUNCEMENTS = 'announcements'
const PRIVATE = 'private'
const SETTINGS = 'settings'

function settingsRef(uid: string) {
  return doc(db, 'users', uid, PRIVATE, SETTINGS)
}

function toAnnouncement(snapshot: QueryDocumentSnapshot): Announcement {
  const data = snapshot.data() as Partial<Announcement>
  return {
    id: snapshot.id,
    orgId: data.orgId ?? '',
    orgName: data.orgName ?? '',
    title: data.title ?? EMPTY_TEXT,
    body: data.body ?? EMPTY_TEXT,
    pinned: data.pinned === true,
    pushSent: data.pushSent === true,
    linkActivityId: data.linkActivityId ?? '',
    imageURL: data.imageURL ?? null,
    createdBy: data.createdBy ?? '',
    createdAt: data.createdAt ?? null,
    expiresAt: data.expiresAt ?? null,
    ...(data.seed ? { seed: true } : {}),
  }
}

/** Ana ekran slider'ı ve duyuru listesi. */
export function watchAnnouncements(
  onChange: (items: Announcement[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ANNOUNCEMENTS),
    orderBy('createdAt', 'desc'),
    limit(30),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now()
      // Süresi geçmiş duyuru slider'ı kirletmesin; silmeye gerek yok.
      onChange(
        snapshot.docs
          .map(toAnnouncement)
          .filter((item) => !item.expiresAt || item.expiresAt.toMillis() > now),
      )
    },
    onError,
  )
}

export function watchOrgAnnouncements(
  orgId: string,
  onChange: (items: Announcement[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, ANNOUNCEMENTS), where('orgId', '==', orgId), limit(50))
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(toAnnouncement)),
    onError,
  )
}

export async function createAnnouncement(
  form: AnnouncementForm,
  context: { orgId: string; orgName: string; uid: string },
): Promise<string> {
  const ref = doc(collection(db, ANNOUNCEMENTS))
  await setDoc(ref, {
    orgId: context.orgId,
    orgName: context.orgName,
    title: { de: form.titleDe, en: form.titleEn },
    body: { de: form.bodyDe, en: form.bodyEn },
    pinned: form.pinned,
    // Push'u yalnız sunucu gönderebilir; istemci bu bayrağı yazamaz.
    pushSent: false,
    linkActivityId: form.linkActivityId,
    imageURL: form.imageURL === '' ? null : form.imageURL,
    createdBy: context.uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + form.lifetimeDays * 86_400_000),
  })
  return ref.id
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, ANNOUNCEMENTS, id))
}

// --- Bildirim tercihleri ---------------------------------------------------

export async function fetchSettings(uid: string): Promise<NotificationSettings> {
  const snapshot = await getDoc(settingsRef(uid))
  if (!snapshot.exists()) return DEFAULT_SETTINGS
  const data = snapshot.data() as Partial<NotificationSettings>
  return {
    announcements: data.announcements !== false,
    deadlineReminders: data.deadlineReminders !== false,
    monthlySummary: data.monthlySummary !== false,
    // Rıza alanında varsayılan HER ZAMAN kapalı (Bölüm 10).
    analyticsConsent: data.analyticsConsent === true,
    pushTokens: data.pushTokens ?? [],
    updatedAt: data.updatedAt ?? null,
  }
}

export function watchSettings(
  uid: string,
  onChange: (settings: NotificationSettings) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    settingsRef(uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(DEFAULT_SETTINGS)
        return
      }
      const data = snapshot.data() as Partial<NotificationSettings>
      onChange({
        announcements: data.announcements !== false,
        deadlineReminders: data.deadlineReminders !== false,
        monthlySummary: data.monthlySummary !== false,
        analyticsConsent: data.analyticsConsent === true,
        pushTokens: data.pushTokens ?? [],
        updatedAt: data.updatedAt ?? null,
      })
    },
    onError,
  )
}

export async function updateSettings(
  uid: string,
  patch: Partial<Omit<NotificationSettings, 'updatedAt'>>,
): Promise<void> {
  await setDoc(
    settingsRef(uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** FCM jetonu kaydet. Aynı kişi birden çok cihaz kullanabilir. */
export async function registerPushToken(uid: string, token: string): Promise<void> {
  const current = await fetchSettings(uid)
  if (current.pushTokens.includes(token)) return
  // Eski cihazlar birikmesin: en yeni beş jeton yeter.
  const next = [...current.pushTokens, token].slice(-5)
  await updateSettings(uid, { pushTokens: next })
}
