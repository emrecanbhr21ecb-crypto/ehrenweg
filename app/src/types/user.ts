/**
 * Kullanıcı profili tipleri ve doğrulama şemaları.
 *
 * CLAUDE.md Bölüm 5 `users/{uid}` şemasının birebir karşılığı.
 *
 * ⚠️ Bölüm 10 gereği burada oturum/ikamet statüsü, uyruk, din, etnik köken
 * veya sağlık alanı YOKTUR ve eklenmeyecektir (DSGVO Art. 9 özel kategori).
 */

import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

import { SUPPORTED_LOCALES } from '@/config/brand'
import { CATEGORY_IDS, CEFR_LEVELS, LANGUAGE_CODES, SKILL_IDS } from '@/config/catalog'

export const userLanguageSchema = z.object({
  code: z.enum(LANGUAGE_CODES),
  level: z.enum(CEFR_LEVELS),
})
export type UserLanguage = z.infer<typeof userLanguageSchema>

/** Yalnız sunucunun yazdığı sayaçlar (Firestore Rules bunu kilitler). */
export const userStatsSchema = z.object({
  ip: z.number().int().min(0),
  hours: z.number().min(0),
  activitiesCompleted: z.number().int().min(0),
  noShows: z.number().int().min(0),
  categoriesCount: z.number().int().min(0),
  level: z.number().int().min(1),
})
export type UserStats = z.infer<typeof userStatsSchema>

export const EMPTY_STATS: UserStats = {
  ip: 0,
  hours: 0,
  activitiesCompleted: 0,
  noShows: 0,
  categoriesCount: 0,
  level: 1,
}

export const trainerStatusSchema = z.enum(['none', 'pending', 'approved', 'rejected'])
export type TrainerStatus = z.infer<typeof trainerStatusSchema>

/**
 * Kullanıcının kendi düzenleyebildiği alanlar.
 *
 * Bu liste firestore.rules içindeki `onlyFields([...])` ile AYNI olmalı —
 * ayrılırlarsa kullanıcı kaydet'e basınca sessizce izin hatası alır.
 */
/**
 * Zod şemasındaki mesajlar çeviri ANAHTARIDIR, metin değil.
 *
 * Bu union sayesinde `t(issue.message)` tip denetiminden geçer; şemaya yeni
 * bir mesaj eklenip buraya eklenmezse derleyici değil ama `isValidationKey`
 * yakalar ve kullanıcı jenerik hata görür (sessiz boş mesaj yerine).
 */
export const VALIDATION_KEYS = [
  'validation.displayNameShort',
  'validation.displayNameLong',
  'validation.bioLong',
  'validation.cityLong',
] as const
export type ValidationKey = (typeof VALIDATION_KEYS)[number]

export function isValidationKey(value: string): value is ValidationKey {
  return (VALIDATION_KEYS as readonly string[]).includes(value)
}

export const editableProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'validation.displayNameShort')
    .max(60, 'validation.displayNameLong'),
  bio: z.string().trim().max(400, 'validation.bioLong'),
  city: z.string().trim().max(80, 'validation.cityLong'),
  locale: z.enum(SUPPORTED_LOCALES),
  interests: z.array(z.enum(CATEGORY_IDS)).max(10),
  skills: z.array(z.enum(SKILL_IDS)).max(16),
  languages: z.array(userLanguageSchema).max(8),
  photoURL: z.string().url().nullable(),
})
export type EditableProfile = z.infer<typeof editableProfileSchema>

/** Firestore'daki tam belge. `Timestamp` alanları istemcide salt okunur. */
export interface UserDoc extends EditableProfile {
  email: string
  countryCode: string
  roleDisplay: string
  orgId?: string
  stats: UserStats
  trainerStatus: TrainerStatus
  createdAt: Timestamp | null
  lastActiveAt: Timestamp | null
}

/**
 * Platform rolü — Firebase custom claim'den okunur.
 *
 * ⚠️ Bu değer ASLA Firestore'dan okunmaz. `users/{uid}` içindeki `roleDisplay`
 * yalnızca ekranda göstermek içindir; yetki kararı custom claim ile verilir
 * (CLAUDE.md Bölüm 14 kural 2).
 */
export const PLATFORM_ROLES = ['participant', 'trainer', 'platform_admin'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/**
 * Kurum rolleri — claim içinde `{ [orgId]: role }` haritası olarak gelir.
 * Liste `functions/src/common/roles.ts` ve `types/activity.ts` ile AYNI olmalı.
 */
export const ORG_ROLES = [
  'org_admin',
  'org_staff',
  'redemption_officer',
  'partner',
] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export interface UserClaims {
  role: PlatformRole
  orgs: Record<string, OrgRole>
  emailVerified: boolean
}

export const DEFAULT_CLAIMS: UserClaims = {
  role: 'participant',
  orgs: {},
  emailVerified: false,
}

/** Kullanıcının herhangi bir kurumda personel yetkisi var mı? */
export function hasOrgAccess(claims: UserClaims): boolean {
  return claims.role === 'platform_admin' || Object.keys(claims.orgs).length > 0
}

/**
 * Profil kurulumu tamamlanmış mı?
 *
 * Onboarding'i bitirmemiş kullanıcı uygulamanın içine alınmaz — aksi hâlde
 * adı boş, ilgi alanı olmayan profiller aktivite listesinde "sana uygun"
 * önerisini anlamsızlaştırır.
 */
export function isProfileComplete(profile: UserDoc | null): boolean {
  if (!profile) return false
  return (
    profile.displayName.trim().length >= 2 &&
    profile.interests.length > 0 &&
    profile.languages.length > 0
  )
}
