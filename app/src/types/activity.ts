/**
 * Kurum, aktivite ve başvuru tipleri — CLAUDE.md Bölüm 4 ve 5.
 *
 * Çok dilli metinler `{de, en}` nesnesi olarak saklanır; kurum bir dili boş
 * bırakabilir, arayüz o zaman dolu olana düşer (Faz 6'da AI çeviri önerecek).
 */

import { z } from 'zod'
import type { Timestamp } from 'firebase/firestore'

import {
  CATEGORY_IDS,
  LANGUAGE_CODES,
  SKILL_IDS,
  type CategoryId,
  type LanguageCode,
  type SkillId,
} from '@/config/catalog'
import type { Locale } from '@/config/brand'
import type { OrgRole } from '@/types/user'

/** İki dilli metin. En az biri dolu olmalı. */
export interface LocalizedText {
  de: string
  en: string
}

export const localizedTextSchema = z.object({
  de: z.string().trim().max(4000),
  en: z.string().trim().max(4000),
})

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

/** Metnin en az bir dilde dolu olup olmadığı. */
export function hasText(text: LocalizedText | undefined): boolean {
  if (!text) return false
  return text.de.trim().length > 0 || text.en.trim().length > 0
}

export const EMPTY_TEXT: LocalizedText = { de: '', en: '' }

// --- Kurumlar --------------------------------------------------------------

export const ORG_TYPES = [
  'municipality',
  'state',
  'federal',
  'ngo',
  'partner_business',
] as const
export type OrgType = (typeof ORG_TYPES)[number]

/**
 * Kurum doğrulama durumu (CLAUDE.md Bölüm 4).
 *
 * "Bir kurum kendi başına kayıt olamaz" — başvuru `pending` olarak girer,
 * `platform_admin` resmi belge/e-posta alan adı kontrolüyle onaylar.
 * `verified` alanı yalnız `approved` durumunda true olur; kurallar aktivite
 * yayınını buna bağlar.
 */
export const ORG_STATUSES = ['pending', 'approved', 'rejected'] as const
export type OrgStatus = (typeof ORG_STATUSES)[number]

export interface Organization {
  id: string
  name: string
  type: OrgType
  city: string
  country: string
  /** Platform admin onayı. Doğrulanmamış kurumun aktivitesi yayınlanamaz. */
  verified: boolean
  status: OrgStatus
  logoURL: string | null
  website: string
  contactEmail: string
  description: LocalizedText
  features: {
    /** CLAUDE.md Bölüm 10: parasal kupon varsayılan KAPALI. */
    cashVouchers: boolean
  }
  /** Başvuruyu yapan kullanıcı — onaylanınca ilk `org_admin` olur. */
  appliedBy: string
  appliedAt: Timestamp | null
  reviewedBy: string | null
  reviewedAt: Timestamp | null
  /** Reddedildiyse gerekçe; kuruma gösterilir. */
  reviewNote: string
  createdAt: Timestamp | null
  /** Seed verisi işareti — `npm run unseed` bunları tek komutla siler. */
  seed?: boolean
}

/**
 * Bu dosyadaki zod şemalarının mesajları ÇEVİRİ ANAHTARIDIR, metin değil
 * (types/user.ts'teki `VALIDATION_KEYS` ile aynı yaklaşım). Bu union sayesinde
 * `t(issue.message)` tip denetiminden geçer ve `errors.json`'da karşılığı
 * olmayan bir anahtar derlemede yakalanır.
 */
export type ActivityValidationKey =
  | 'validation.orgNameShort'
  | 'validation.orgNameLong'
  | 'validation.cityRequired'
  | 'validation.cityLong'
  | 'validation.urlInvalid'
  | 'validation.emailInvalid'
  | 'validation.titleRequired'
  | 'validation.descriptionRequired'
  | 'validation.addressRequired'
  | 'validation.languageRequired'
  | 'validation.startRequired'
  | 'validation.endRequired'
  | 'validation.endBeforeStart'
  | 'validation.deadlineAfterStart'
  | 'validation.capacityRange'
  | 'validation.ipRange'
  | 'validation.uidRequired'

/** Kurum başvuru formundan gelen alanlar. */
export const orgApplicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'validation.orgNameShort')
    .max(120, 'validation.orgNameLong'),
  type: z.enum(ORG_TYPES),
  city: z
    .string()
    .trim()
    .min(2, 'validation.cityRequired')
    .max(80, 'validation.cityLong'),
  website: z.string().trim().url('validation.urlInvalid').or(z.literal('')),
  contactEmail: z.string().trim().email('validation.emailInvalid'),
  description: localizedTextSchema,
})
export type OrgApplicationInput = z.infer<typeof orgApplicationSchema>

/**
 * organizations/{orgId}/members/{uid}
 *
 * Rol listesi tek yerde: `types/user.ts`. Aynı listenin iki kopyası olsaydı
 * biri güncellenip diğeri unutulduğunda yetki kontrolü sessizce ayrışırdı.
 */
export { ORG_ROLES } from '@/types/user'
export type { OrgRole }

export interface OrgMember {
  uid: string
  orgId: string
  role: OrgRole
  /** Listede göstermek için kopyalanır — kurum `users` belgesini okuyamaz. */
  displayName: string
  email: string
  addedBy: string
  addedAt: Timestamp | null
  seed?: boolean
}

/** Bu roller aktivite oluşturup yönetebilir. */
export const ORG_STAFF_ROLES: readonly OrgRole[] = ['org_admin', 'org_staff']

export function canManageActivities(role: OrgRole | undefined): boolean {
  return role !== undefined && ORG_STAFF_ROLES.includes(role)
}

// --- Kategoriler -----------------------------------------------------------

/**
 * categories/{id} belgesi.
 *
 * Kimlikler koddaki `CATEGORY_IDS` ile aynıdır; Firestore kopyası kurum
 * panelindeki seçim listesi ve ileride admin'in kategori eklemesi içindir.
 * Arayüz metni yine de i18n'den gelir (Bölüm 11: metin koda/veriye gömülmez),
 * buradaki `name` yalnız yedek ve rapor içindir.
 */
export interface Category {
  id: CategoryId
  name: LocalizedText
  icon: string
  color: string
  order: number
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

  /** Moderasyon izleri (CLAUDE.md Bölüm 9 — platform admin içerik moderasyonu). */
  submittedAt: Timestamp | null
  reviewedBy: string | null
  reviewedAt: Timestamp | null
  /** Reddedildiyse gerekçe — kurum bunu görüp düzeltir. */
  reviewNote: string

  createdAt: Timestamp | null
  seed?: boolean
}

/** Aktivite başına verilebilecek en yüksek IP (CLAUDE.md Bölüm 6). */
export const MAX_ACTIVITY_IP = 60
export const MAX_ACTIVITY_CAPACITY = 1000

/**
 * Kurum panelindeki form şeması.
 *
 * Tarihler forma `datetime-local` dizgesi olarak girilir; Firestore'a
 * `Timestamp`e çevrilerek yazılır (`lib/activities.ts`).
 */
export const activityFormSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    title: localizedTextSchema,
    description: localizedTextSchema,
    simpleDescription: localizedTextSchema,
    categoryId: z.enum(CATEGORY_IDS),
    skillsGained: z.array(z.enum(SKILL_IDS)).max(8),
    languagesUsed: z
      .array(z.enum(LANGUAGE_CODES))
      .min(1, 'validation.languageRequired')
      .max(6),
    online: z.boolean(),
    address: z.string().trim().max(200),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    startAt: z.string().min(1, 'validation.startRequired'),
    endAt: z.string().min(1, 'validation.endRequired'),
    applicationDeadline: z.string(),
    capacity: z
      .number()
      .int()
      .min(1, 'validation.capacityRange')
      .max(MAX_ACTIVITY_CAPACITY, 'validation.capacityRange'),
    requiresApplication: z.boolean(),
    minLevel: z.number().int().min(0).max(5),
    rewardIp: z.number().int().min(0).max(MAX_ACTIVITY_IP, 'validation.ipRange'),
    hoursCredited: z.number().min(0).max(24),
    coverImageURL: z.string().trim().url('validation.urlInvalid').or(z.literal('')),
    passportEnabled: z.boolean(),
  })
  // Başlık en az bir dilde dolu olmalı — iki dili de boş bırakılan aktivite
  // listede görünmez bir kabuk olurdu.
  .refine((v) => hasText(v.title), {
    message: 'validation.titleRequired',
    path: ['title'],
  })
  .refine((v) => hasText(v.description), {
    message: 'validation.descriptionRequired',
    path: ['description'],
  })
  // Çevrimiçi değilse adres şart: katılımcı nereye gideceğini bilmeli.
  .refine((v) => v.online || v.address.trim().length >= 5, {
    message: 'validation.addressRequired',
    path: ['address'],
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: 'validation.endBeforeStart',
    path: ['endAt'],
  })
  .refine(
    (v) =>
      v.applicationDeadline === '' ||
      new Date(v.applicationDeadline).getTime() <= new Date(v.startAt).getTime(),
    { message: 'validation.deadlineAfterStart', path: ['applicationDeadline'] },
  )

export type ActivityFormValues = z.infer<typeof activityFormSchema>

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
 * Başvuru TEK yerde tutulur: `activities/{activityId}/applicants/{uid}`.
 *
 * Kullanıcının "Başvurularım" listesi `collectionGroup('applicants')` +
 * `where('uid','==',me)` ile çıkar. İkinci bir kopya (users altında) tutmanın
 * bedeli, kurum bir kararı yazarken kullanıcının belgesine de yazabilmesi
 * olurdu — bu, kurum personeline `users` koleksiyonunda yazma yetkisi açmak
 * demekti (veri minimizasyonu, CLAUDE.md Bölüm 10). Tek kaynak + collection
 * group sorgusu bu yetkiyi hiç açmadan aynı sonucu veriyor.
 *
 * Kuruma görünen alanlar bilinçli olarak asgari: ad ve konuşulan diller.
 * Profil belgesi kuruma HİÇ açılmaz.
 */
export interface Application {
  activityId: string
  orgId: string
  uid: string
  status: ApplicationStatus
  /** Başvuru mesajı — kuruma görünür, zorunlu değil. */
  message: string
  applicantName: string
  applicantLanguages: LanguageCode[]
  /** Liste ekranı için kopya — iptal edilmiş aktivitede bile başlık görünsün. */
  activityTitle: LocalizedText
  activityStartAt: Timestamp
  appliedAt: Timestamp | null
  decidedAt: Timestamp | null
  decidedBy: string | null
  decisionNote: string
  withdrawnAt: Timestamp | null
  attended: boolean
}

/**
 * Ekranda gösterilecek durum.
 *
 * `no_response`, kurumun karar vermediği ve aktivitenin geçtiği başvurudur.
 * Bunu zamanlanmış bir fonksiyon (Bölüm 12 `markNoShows` komşusu) yazacak;
 * o gelene kadar görüntüleme tarafında hesaplanıyor — kullanıcı "başvurdum"
 * yazan, tarihi geçmiş bir kartla baş başa kalmasın.
 */
export function effectiveApplicationStatus(
  application: Pick<Application, 'status' | 'activityStartAt'>,
  now: Date = new Date(),
): ApplicationStatus {
  if (application.status !== 'applied') return application.status
  const start = application.activityStartAt?.toDate?.()
  if (start && start.getTime() < now.getTime()) return 'no_response'
  return 'applied'
}

// --- Liste filtreleri ------------------------------------------------------

/** Mesafe filtresi seçenekleri (km). `null` = sınırsız. */
export const DISTANCE_OPTIONS = [2, 5, 10, 25] as const
export type DistanceKm = (typeof DISTANCE_OPTIONS)[number]

export interface ActivityFilters {
  categoryIds: CategoryId[]
  type: ActivityType | 'all'
  onlineOnly: boolean
  /** Yalnız gelecekteki aktiviteler (varsayılan açık). */
  upcomingOnly: boolean
  language: LanguageCode | 'all'
  /** Kullanıcının konumundan/şehrinden en fazla kaç km. null = hepsi. */
  maxDistanceKm: DistanceKm | null
  /** ISO tarih (YYYY-MM-DD); boşsa tarih sınırı yok. */
  fromDate: string
  toDate: string
  search: string
}

export const DEFAULT_FILTERS: ActivityFilters = {
  categoryIds: [],
  type: 'all',
  onlineOnly: false,
  upcomingOnly: true,
  language: 'all',
  maxDistanceKm: null,
  fromDate: '',
  toDate: '',
  search: '',
}

export function isFilterActive(filters: ActivityFilters): boolean {
  return (
    filters.categoryIds.length > 0 ||
    filters.type !== 'all' ||
    filters.onlineOnly ||
    filters.language !== 'all' ||
    filters.maxDistanceKm !== null ||
    filters.fromDate !== '' ||
    filters.toDate !== '' ||
    filters.search.trim() !== ''
  )
}
