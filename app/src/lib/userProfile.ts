/**
 * users/{uid} belgesinin okunması, oluşturulması ve güncellenmesi.
 *
 * ⚠️ MİMARİ SAPMA (DECISIONS.md §6): CLAUDE.md profil belgesinin `onUserCreate`
 * Cloud Function'ı tarafından oluşturulmasını öngörüyor. Cloud Functions Blaze
 * planı gerektiriyor; pilot öncesi maliyet kararı verilene kadar plan Spark'ta
 * kalıyor. Bu yüzden belgeyi istemci oluşturuyor ve güvenlik firestore.rules
 * tarafına yıkılıyor:
 *   - yalnız kendi uid'si,
 *   - `stats` sıfırdan farklı olamaz, `trainerStatus` 'none' olmak zorunda,
 *   - `orgId` / `roleDisplay` yazılamaz.
 * Böylece istemciden gelen belge kendine puan veya rol basamaz.
 * Blaze açıldığında bu dosyadaki `createUserProfile` blocking function'a taşınır.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/config/brand'
import { db } from '@/lib/firebase'
import { EMPTY_STATS, type EditableProfile, type UserDoc } from '@/types/user'

export const USERS_COLLECTION = 'users'

export function userDocRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid)
}

/**
 * Firestore anlık görüntüsünü UserDoc'a çevirir.
 *
 * Eksik alanlara varsayılan verilir: şema zamanla genişleyecek ve eski
 * belgelerin `undefined` alanları arayüzü çökertmemeli.
 */
function toUserDoc(snapshot: DocumentSnapshot): UserDoc | null {
  if (!snapshot.exists()) return null
  const data = snapshot.data() as Partial<UserDoc>

  return {
    displayName: data.displayName ?? '',
    bio: data.bio ?? '',
    city: data.city ?? '',
    locale: data.locale ?? DEFAULT_LOCALE,
    interests: data.interests ?? [],
    skills: data.skills ?? [],
    languages: data.languages ?? [],
    photoURL: data.photoURL ?? null,
    email: data.email ?? '',
    countryCode: data.countryCode ?? 'DE',
    roleDisplay: data.roleDisplay ?? 'participant',
    ...(data.orgId ? { orgId: data.orgId } : {}),
    stats: { ...EMPTY_STATS, ...(data.stats ?? {}) },
    trainerStatus: data.trainerStatus ?? 'none',
    createdAt: data.createdAt ?? null,
    lastActiveAt: data.lastActiveAt ?? null,
  }
}

export async function fetchUserProfile(uid: string): Promise<UserDoc | null> {
  return toUserDoc(await getDoc(userDocRef(uid)))
}

/** Profili canlı dinler — başka cihazdaki düzenleme veya sunucu puan güncellemesi anında yansır. */
export function watchUserProfile(
  uid: string,
  onChange: (profile: UserDoc | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snapshot) => onChange(toUserDoc(snapshot)),
    onError,
  )
}

function guessLocale(): Locale {
  const detected = navigator.language.split('-')[0]
  return SUPPORTED_LOCALES.find((code) => code === detected) ?? DEFAULT_LOCALE
}

/**
 * Kayıt sonrası ilk profil belgesi. Zaten varsa DOKUNMAZ — Google ile ikinci
 * kez giriş yapan kullanıcının doldurduğu profili sıfırlamak olurdu.
 */
export async function ensureUserProfile(
  user: User,
  overrides: Partial<Pick<EditableProfile, 'displayName' | 'locale'>> = {},
): Promise<UserDoc> {
  const existing = await fetchUserProfile(user.uid)
  if (existing) return existing

  const profile = {
    displayName: overrides.displayName ?? user.displayName ?? '',
    bio: '',
    city: '',
    locale: overrides.locale ?? guessLocale(),
    interests: [],
    skills: [],
    languages: [],
    photoURL: user.photoURL,
    email: user.email ?? '',
    countryCode: 'DE',
    roleDisplay: 'participant',
    stats: EMPTY_STATS,
    trainerStatus: 'none' as const,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  }

  await setDoc(userDocRef(user.uid), profile)

  const created = await fetchUserProfile(user.uid)
  if (!created) {
    throw new Error('[userProfile] Profil oluşturuldu ama geri okunamadı.')
  }
  return created
}

/**
 * Profilin düzenlenebilir alanlarını günceller.
 *
 * Yalnız `EditableProfile` alanları gönderilir; başka bir alan eklenirse
 * Firestore Rules tüm yazmayı reddeder (onlyFields kısıtı).
 */
export async function updateUserProfile(
  uid: string,
  patch: Partial<EditableProfile>,
): Promise<void> {
  await updateDoc(userDocRef(uid), { ...patch, lastActiveAt: serverTimestamp() })
}

/** Uygulama açılışında "son görülme" damgası. Hata yutulur — kritik değil. */
export async function touchLastActive(uid: string): Promise<void> {
  try {
    await updateDoc(userDocRef(uid), { lastActiveAt: serverTimestamp() })
  } catch {
    // Çevrimdışı olabiliriz; bu damga hiçbir akışı engellemez.
  }
}
