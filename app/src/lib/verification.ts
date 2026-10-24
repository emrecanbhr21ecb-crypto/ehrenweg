/**
 * PDF Integrationspass doğrulama sayfası — CLAUDE.md Bölüm 1A:
 * "PDF pasaport: doğrulama adresi https://ehrenweg.de/verify/{id}".
 *
 * Belge PDF oluşturulurken bir kez yazılır (bkz. lib/passportPdf.ts) ve bir
 * anlık görüntüdür — bkz. firestore.rules `verifications/{token}` bloğu.
 */

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'

import type { Locale } from '@/config/brand'
import { db } from '@/lib/firebase'
import type { UserStats } from '@/types/user'

export const VERIFICATIONS = 'verifications'

export interface VerificationDoc {
  displayName: string
  locale: Locale
  level: number
  hours: number
  activitiesCompleted: number
  issuedAt: Timestamp | null
}

/** 128 bit rastgele token — tahmin edilemez, URL'de güvenle taşınır. */
function randomToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Doğrulama belgesini oluşturur. Değerler `firestore.rules`teki
 * `verifications` kuralında kullanıcının GERÇEK `users/{uid}.stats`'ı ile
 * birebir karşılaştırılır — burada uydurulan bir sayı yazılamaz.
 */
export async function createVerification(
  displayName: string,
  stats: UserStats,
  locale: Locale,
): Promise<string> {
  const token = randomToken()
  await setDoc(doc(db, VERIFICATIONS, token), {
    displayName,
    locale,
    level: stats.level,
    hours: stats.hours,
    activitiesCompleted: stats.activitiesCompleted,
    issuedAt: serverTimestamp(),
  })
  return token
}

export async function fetchVerification(
  token: string,
): Promise<VerificationDoc | null> {
  const snapshot = await getDoc(doc(db, VERIFICATIONS, token))
  if (!snapshot.exists()) return null
  const data = snapshot.data() as Partial<VerificationDoc>
  return {
    displayName: data.displayName ?? '',
    locale: data.locale === 'en' ? 'en' : 'de',
    level: data.level ?? 1,
    hours: data.hours ?? 0,
    activitiesCompleted: data.activitiesCompleted ?? 0,
    issuedAt: data.issuedAt ?? null,
  }
}
