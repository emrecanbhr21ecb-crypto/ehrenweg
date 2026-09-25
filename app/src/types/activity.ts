/**
 * Kurum ve aktivite tipleri — CLAUDE.md Bölüm 5.
 *
 * Çok dilli metinler `{de, en}` nesnesi olarak saklanır; kurum bir dili boş
 * bırakabilir, arayüz o zaman dolu olana düşer (Faz 6'da AI çeviri önerecek).
 */

import type { Timestamp } from 'firebase/firestore'

import type { CategoryId, LanguageCode, SkillId } from '@/config/catalog'
import type { Locale } from '@/config/brand'

/** İki dilli metin. En az biri dolu olmalı. */
export interface LocalizedText {
  de: string
  en: string
}

/**
 * Kullanıcının diline göre metni seçer, boşsa diğerine düşer.
 * Hiçbiri yoksa boş dizge — arayüz "başlıksız aktivite" göstermez, gizler.
 */
export function pickText(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return ''
  const preferred = text[locale]
  if (preferred && preferred.trim()) return preferred
  const fallback = locale === 'de' ? text.en : text.de
  return fallback ?? ''
}

// --- Kurumlar --------------------------------------------------------------

export const ORG_TYPES = [
  'municipality',
  'state',
  'federal',
  'ngo',
  'partner_business',
] as const
export type OrgType = (typeof ORG_TYPES)[number]

export interface Organization {
  id: string
  name: string
  type: OrgType
  city: string
  country: string
  /** Platform admin onayı. Doğrulanmamış kurumun aktivitesi yayınlanamaz. */
  verified: boolean
  logoURL: string | null
  website: string
  contactEmail: string
  description: LocalizedText
  features: {
    /** CLAUDE.md Bölüm 10: parasal kupon varsayılan KAPALI. */
    cashVouchers: boolean
  }
  createdAt: Timestamp | null
  /** Seed verisi işareti — `npm run unseed` bunları tek komutla siler. */
  seed?: boolean
}

// --- Aktiviteler -----------------------------------------------------------

export const ACTIVITY_TYPES = ['volunteering', 'training'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'cancelled',
  'completed',
] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export interface ActivityLocation {
  address: string
  lat: number | null
  lng: number | null
}

export interface Activity {
  id: string
  orgId: string
  /** Kurum adı — liste ekranında her kart için ayrı okuma yapmamak adına kopyalanır. */
  orgName: string
  createdBy: string
  type: ActivityType
  trainerUid?: string

  title: LocalizedText
  description: LocalizedText
  /** Leichte Sprache — basit dille özet. Boşsa arayüzde anahtar gösterilmez. */
  simpleDescription: LocalizedText

  categoryId: CategoryId
  skillsGained: SkillId[]
  languagesUsed: LanguageCode[]

  location: ActivityLocation
  online: boolean

  startAt: Timestamp
  endAt: Timestamp
  applicationDeadline: Timestamp | null
  capacity: number
  requiresApplication: boolean
  /** 0 = herkes katılabilir. */
  minLevel: number

  status: ActivityStatus
  rewards: { ip: number }
  hoursCredited: number
  coverImageURL: string | null
  passportEnabled: boolean

  stats: { applicants: number; attendees: number }
  createdAt: Timestamp | null
  seed?: boolean
}

/** Yeni aktivite oluştururken formdan gelen alanlar. */
export type ActivityDraft = Omit<
  Activity,
  'id' | 'createdAt' | 'stats' | 'orgName' | 'createdBy' | 'seed'
>

// --- Başvurular ------------------------------------------------------------

export const APPLICATION_STATUSES = [
  'applied',
  'accepted',
  'rejected',
  'no_response',
  'withdrawn',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/**
 * Başvuru iki yerde tutulur:
 *  - `users/{uid}/applications/{activityId}` → kullanıcının "Başvurularım"ı
 *  - `activities/{id}/applicants/{uid}`      → kurumun başvuran listesi
 *
 * Neden iki kopya: Firestore'da "bir kullanıcının tüm başvuruları" ve "bir
 * aktivitenin tüm başvuranları" sorguları tek koleksiyondan verimli çıkmıyor;
 * collectionGroup ile çıkarılabilir ama o zaman kurumun listesi için kullanıcı
 * belgelerini okuma izni gerekirdi (veri minimizasyonu, Bölüm 10).
 */
export interface Application {
  activityId: string
  uid: string
  status: ApplicationStatus
  /** Başvuru mesajı — kuruma görünür, zorunlu değil. */
  message: string
  /** Kurumun katılımcıyı tanıması için kopyalanan asgari bilgi. */
  applicantName: string
  applicantLanguages: LanguageCode[]
  appliedAt: Timestamp | null
  decidedAt: Timestamp | null
  decidedBy: string | null
  attended: boolean
}

/** Aktivite listesi filtreleri. */
export interface ActivityFilters {
  categoryIds: CategoryId[]
  type: ActivityType | 'all'
  onlineOnly: boolean
  /** Yalnız gelecekteki aktiviteler (varsayılan açık). */
  upcomingOnly: boolean
  language: LanguageCode | 'all'
  search: string
}

export const DEFAULT_FILTERS: ActivityFilters = {
  categoryIds: [],
  type: 'all',
  onlineOnly: false,
  upcomingOnly: true,
  language: 'all',
  search: '',
}
