/**
 * firebase-admin tekil kurulumu.
 * Her modül kendi initializeApp'ini çağırmasın diye tek yerden veriliyor.
 */

import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

if (getApps().length === 0) {
  initializeApp()
}

export const db = getFirestore()
export const auth = getAuth()
export const storage = getStorage()

export { FieldValue, Timestamp }

/**
 * Koleksiyon adları tek yerde. Yazım hatası derleme zamanında yakalansın diye
 * string sabitler yerine bu nesne kullanılır (CLAUDE.md Bölüm 5).
 */
export const COL = {
  users: 'users',
  organizations: 'organizations',
  categories: 'categories',
  activities: 'activities',
  attendanceSessions: 'attendanceSessions',
  attendanceRecords: 'attendanceRecords',
  passportEntries: 'passportEntries',
  pendingClaims: 'pendingClaims',
  rewardTemplates: 'rewardTemplates',
  vouchers: 'vouchers',
  ledger: 'ledger',
  trainerApplications: 'trainerApplications',
  announcements: 'announcements',
  slider: 'slider',
  feedback: 'feedback',
  certificates: 'certificates',
  auditLog: 'auditLog',
  config: 'config',
} as const

/** Alt koleksiyon adları. */
export const SUB = {
  /** users/{uid}/private/settings */
  userPrivate: 'private',
  /** users/{uid}/applications/{activityId} */
  userApplications: 'applications',
  /** organizations/{orgId}/members/{uid} */
  orgMembers: 'members',
  /** attendanceSessions/{sessionId}/codes/{codeId} */
  sessionCodes: 'codes',
} as const
