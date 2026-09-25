/**
 * Eğitmen kariyer yolu — CLAUDE.md Bölüm 8, Bölüm 5 `trainerApplications`.
 */

import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

import { CEFR_LEVELS, LANGUAGE_CODES, SKILL_IDS } from '@/config/catalog'

export const TRAINER_STATUSES = ['pending', 'approved', 'rejected'] as const
export type TrainerApplicationStatus = (typeof TRAINER_STATUSES)[number]

/**
 * Başvuru anındaki istatistik fotoğrafı.
 *
 * Neden kopyalanıyor: admin başvuruyu üç gün sonra inceliyor olabilir ve o
 * ana kadar kullanıcının sayaçları değişir. Karar, başvuru anındaki duruma
 * göre verilmeli — sonradan bakıldığında "bu neden onaylanmış" sorusunun
 * cevabı belgede durmalı.
 */
export interface TrainerSnapshot {
  level: number
  hours: number
  activitiesCompleted: number
  noShows: number
  noShowRate: number
  accountAgeDays: number
}

export interface TrainerApplication {
  /** Belge kimliği = uid. Bir kişi bir başvuru. */
  uid: string
  displayName: string
  email: string
  status: TrainerApplicationStatus
  /** Öğretmek istediği konular — sabit beceri sözlüğünden. */
  topics: string[]
  /** Dil eğitimi verecekse hangi dil ve hangi seviyede. */
  teachingLanguage: string
  teachingLanguageLevel: string
  motivation: string
  /**
   * B2+ dil belgesi — **data URL** olarak belgede.
   *
   * ⚠️ Bölüm 8 bunu Storage'a yüklemeyi söylüyor ("yalnız admin ve sahibi
   * görebilsin"). Storage Blaze istiyor (docs/DECISIONS.md §7), bu yüzden
   * fotoğraf istemcide küçültülüp belgeye gömülüyor. Görünürlük şartı
   * korunuyor: `trainerApplications` belgesini yalnız sahibi ve admin
   * okuyabiliyor.
   */
  certificateDataUrl: string
  snapshot: TrainerSnapshot
  submittedAt: Timestamp | null
  reviewedBy: string | null
  reviewedAt: Timestamp | null
  note: string
}

export const trainerApplicationSchema = z.object({
  topics: z.array(z.enum(SKILL_IDS)).min(1, 'validation.topicsRequired').max(6),
  teachingLanguage: z.enum(LANGUAGE_CODES).or(z.literal('')),
  teachingLanguageLevel: z.enum(CEFR_LEVELS).or(z.literal('')),
  motivation: z
    .string()
    .trim()
    .min(20, 'validation.motivationShort')
    .max(1000, 'validation.motivationLong'),
})
export type TrainerApplicationForm = z.infer<typeof trainerApplicationSchema>

/** Dil eğitimi verecekse belge şart (Bölüm 8). */
export function needsCertificate(form: { topics: string[] }): boolean {
  return form.topics.includes('teaching') || form.topics.includes('translating')
}

// --- Eğitim geri bildirimi (Bölüm 8) ---------------------------------------

/**
 * `activities/{activityId}/feedback/{uid}`
 *
 * "Eğitimlerine gelen katılımcı geri bildirimleri (1–5 yıldız + yorum)
 *  profilinde ortalama olarak görünür."
 *
 * Alt koleksiyon olmasının sebebi: kurum kendi eğitiminin geri bildirimini
 * görebilmeli ama başka eğitmenlerinkini değil. Aktivitenin altında durunca
 * yetki kuralı aktivitenin kurumundan türüyor.
 */
export interface TrainingFeedback {
  uid: string
  activityId: string
  trainerUid: string
  orgId: string
  rating: number
  comment: string
  displayName: string
  /** Kurum uygunsuz yorumu gizleyebilir (Bölüm 8). */
  hidden: boolean
  createdAt: Timestamp | null
}

export const MIN_RATING = 1
export const MAX_RATING = 5

export const feedbackSchema = z.object({
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  comment: z.string().trim().max(600),
})
export type FeedbackForm = z.infer<typeof feedbackSchema>

/** Eğitmenin ortalama puanı. Gizlenmiş yorumlar ortalamaya GİRMEZ. */
export function averageRating(entries: TrainingFeedback[]): {
  average: number
  count: number
} {
  const visible = entries.filter((entry) => !entry.hidden)
  if (visible.length === 0) return { average: 0, count: 0 }
  const total = visible.reduce((sum, entry) => sum + entry.rating, 0)
  return {
    average: Math.round((total / visible.length) * 10) / 10,
    count: visible.length,
  }
}

/** Belge kimliği — bir kişi bir eğitime bir geri bildirim. */
export function feedbackId(uid: string): string {
  return uid
}
