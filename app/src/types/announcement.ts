/**
 * Duyurular ve bildirim tercihleri — CLAUDE.md Bölüm 5 (`announcements`,
 * `slider`, `users/{uid}/private/settings`) ve Bölüm 12 (`sendAnnouncement`).
 */

import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

import type { LocalizedText } from '@/types/activity'

export interface Announcement {
  id: string
  /** Kurum duyurusu ise kurum kimliği; platform duyurusunda boş. */
  orgId: string
  orgName: string
  title: LocalizedText
  body: LocalizedText
  /** Ana ekran slider'ında görünsün mü (Bölüm 9). */
  pinned: boolean
  /** Push gönderildi mi — `sendAnnouncement` işaretler. */
  pushSent: boolean
  /** Tıklanınca gidilecek yer; boşsa duyuru metniyle kalır. */
  linkActivityId: string
  imageURL: string | null
  createdBy: string
  createdAt: Timestamp | null
  /** Bu tarihten sonra slider'da gösterilmez. */
  expiresAt: Timestamp | null
  seed?: boolean
}

export const announcementSchema = z
  .object({
    titleDe: z.string().trim().max(120),
    titleEn: z.string().trim().max(120),
    bodyDe: z.string().trim().max(1200),
    bodyEn: z.string().trim().max(1200),
    pinned: z.boolean(),
    linkActivityId: z.string().trim().max(64),
    imageURL: z.string().trim().url('validation.urlInvalid').or(z.literal('')),
    /** Kaç gün sonra slider'dan düşsün. */
    lifetimeDays: z.number().int().min(1).max(365),
  })
  .refine((v) => v.titleDe.trim() !== '' || v.titleEn.trim() !== '', {
    message: 'validation.titleRequired',
    path: ['titleDe'],
  })
  .refine((v) => v.bodyDe.trim() !== '' || v.bodyEn.trim() !== '', {
    message: 'validation.bodyRequired',
    path: ['bodyDe'],
  })

export type AnnouncementForm = z.infer<typeof announcementSchema>

// --- Bildirim tercihleri (users/{uid}/private/settings) --------------------

/**
 * CLAUDE.md Bölüm 12: "Bildirim tercihleri ayarlarda: duyurular, son başvuru
 * hatırlatıcıları, aylık özet."
 *
 * ⚠️ `analyticsConsent` Bölüm 10 gereği **varsayılan KAPALI** ve kullanıcı
 * açmadan hiçbir analitik toplanmaz.
 */
export interface NotificationSettings {
  announcements: boolean
  deadlineReminders: boolean
  monthlySummary: boolean
  analyticsConsent: boolean
  /** FCM cihaz jetonları — aynı kişi birden çok cihaz kullanabilir. */
  pushTokens: string[]
  updatedAt: Timestamp | null
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  announcements: true,
  deadlineReminders: true,
  monthlySummary: true,
  // Bölüm 10: "Analytics varsayılan kapalı ve rızaya bağlı."
  analyticsConsent: false,
  pushTokens: [],
  updatedAt: null,
}
