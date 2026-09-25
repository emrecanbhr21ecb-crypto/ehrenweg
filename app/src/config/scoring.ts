/**
 * Puan kuralları — CLAUDE.md Bölüm 6.
 *
 * Kurallar `config/scoring` Firestore belgesinden okunur; belge yoksa ya da
 * bir alanı eksikse buradaki varsayılanlara düşülür. Böylece admin puanları
 * yeniden dağıtım yapmadan değiştirebilir (Bölüm 9: "puan kuralları editörü"),
 * ama uygulama belge hiç yokken de çalışır.
 *
 * ⚠️ Buradaki değerler İSTEMCİDE hesap için kullanılıyor. Kötü niyetli bir
 * istemcinin kendine puan basmasını bu dosya değil `firestore.rules` engelliyor:
 * puan yazımı yalnız kurum personeline açık ve yazılan miktar aktivitenin ilan
 * ettiği değerle sınırlı (docs/DECISIONS.md §9).
 */

import {
  LEVEL_THRESHOLDS,
  type CategoryId,
  type LevelThreshold,
} from '@/config/catalog'

export interface ScoringConfig {
  /** Aktivite başına verilebilecek en yüksek temel IP. */
  maxIpPerActivity: number
  /** Varsayılan saat başı IP — kurum aktivitede ayrıca belirtir. */
  ipPerHour: number

  bonuses: {
    /** Yeni bir kategoride ilk katılım. */
    newCategory: number
    /** Aynı ay içinde 4. ve sonraki katılım. */
    monthlyFour: number
    /** Eğitmen olarak ders verme çarpanı. */
    trainerMultiplier: number
  }

  penalties: {
    /** Kabul edilip gelmeme. */
    noShowIp: number
    /** Kaç ardışık no-show'dan sonra kısıt. */
    noShowStreakLimit: number
    /** Kısıt süresi (gün). */
    restrictionDays: number
  }

  levels: readonly LevelThreshold[]
}

export const DEFAULT_SCORING: ScoringConfig = {
  maxIpPerActivity: 60,
  ipPerHour: 10,
  bonuses: {
    newCategory: 15,
    monthlyFour: 25,
    trainerMultiplier: 1.5,
  },
  penalties: {
    noShowIp: 5,
    noShowStreakLimit: 3,
    restrictionDays: 14,
  },
  levels: LEVEL_THRESHOLDS,
}

/**
 * Bonusların toplam üst sınırı — yalnız SUNUCU yolunda anlamlı.
 *
 * ⚠️ Bugün bu sabit kullanılmıyor. `firestore.rules` istemci yolunda
 * `ipAwarded == activity.rewards.ip` diyor, yani hiç bonus geçmiyor
 * (docs/DECISIONS.md §9.2: bonus hesabı kullanıcının tüm kurumlardaki
 * geçmişini okumayı gerektiriyor ve kural bunu doğrulayamıyor).
 *
 * Blaze açılıp `onAttendanceConfirmed` devreye girince bonuslar sunucuda
 * hesaplanacak; bu tavan oradaki hesabın üst sınırı olarak duruyor.
 */
export const MAX_BONUS_IP = 40

export interface AwardInput {
  baseIp: number
  hours: number
  categoryId: CategoryId
  /** Kullanıcının bu kategoride daha önce katılımı var mı? */
  isNewCategory: boolean
  /** Bu ay (bu katılım dahil) kaçıncı katılım? */
  monthlyCount: number
  /** Eğitmen olarak mı verdi? */
  asTrainer: boolean
}

export interface AwardResult {
  ip: number
  bonuses: string[]
}

/**
 * Bir katılımın kazandıracağı IP'yi hesaplar.
 *
 * Sıra önemli: temel puan önce aktivite üst sınırına kırpılır, bonuslar
 * SONRA eklenir. Aksi hâlde 60'lık tavan bonusları yutar ve "yeni kategori"
 * ödülü hiç hissedilmezdi.
 */
export function computeAward(
  input: AwardInput,
  config: ScoringConfig = DEFAULT_SCORING,
): AwardResult {
  const bonuses: string[] = []

  let base = Math.min(input.baseIp, config.maxIpPerActivity)
  if (input.asTrainer) {
    base = Math.round(base * config.bonuses.trainerMultiplier)
    bonuses.push('trainer')
  }

  let total = base

  if (input.isNewCategory) {
    total += config.bonuses.newCategory
    bonuses.push('newCategory')
  }

  if (input.monthlyCount >= 4) {
    total += config.bonuses.monthlyFour
    bonuses.push('monthlyFour')
  }

  // Kural tarafındaki tavanı hiçbir koşulda aşma — aşarsa yazma reddedilir
  // ve katılımcı puanını hiç alamaz. Sessizce kırpmak, hiç vermemekten iyi.
  const ceiling = Math.min(input.baseIp, config.maxIpPerActivity) + MAX_BONUS_IP
  return { ip: Math.min(total, ceiling), bonuses }
}

/**
 * Sayılara göre hak edilen seviye.
 *
 * `firestore.rules` içindeki `allowedLevel()` fonksiyonuyla AYNI mantık —
 * ayrılırlarsa istemci bir seviye yazar, kural reddeder ve katılım hiç
 * işlenmez.
 */
export function levelFor(
  stats: { activitiesCompleted: number; hours: number; categoriesCount: number },
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  let level = 1
  for (const threshold of config.levels) {
    if (
      stats.activitiesCompleted >= threshold.activities &&
      stats.hours >= threshold.hours &&
      stats.categoriesCount >= threshold.categories
    ) {
      level = Math.max(level, threshold.level)
    }
  }
  return level
}

// --- Rozetler (CLAUDE.md Bölüm 6) ------------------------------------------

export const BADGE_IDS = [
  'first_step', // İlk Adım — 1 katılım
  'regular', // Düzenli — 3
  'senior', // Kıdemli — 10
  'legend', // Efsane — 25
  'explorer', // Kaşif — 3 kategori
  'versatile', // Çok Yönlü — 5 kategori
  'language_bridge', // Dil Köprüsü — dil eğitiminde 5 katılım
  'neighbourhood_hero', // Mahalle Kahramanı — aynı kurumda 10 katılım
  'trainer', // Eğitmen — trainer onayı
] as const
export type BadgeId = (typeof BADGE_IDS)[number]

export interface BadgeContext {
  activitiesCompleted: number
  categoryIds: CategoryId[]
  /** Dil öğretme/öğrenme kategorisindeki katılım sayısı. */
  languageCount: number
  /** En çok katılım yapılan kurumdaki katılım sayısı. */
  topOrgCount: number
  isTrainer: boolean
}

/**
 * Kazanılmış rozetler.
 *
 * Rozetler Firestore'da SAKLANMIYOR, her açılışta pasaport girdilerinden
 * hesaplanıyor. Gerekçe: saklansaydı "rozet yazma" diye ayrı bir yazma yetkisi
 * açmak gerekirdi ve o yetki kurum personeline gitmek zorunda kalırdı. Türetilen
 * veri, türetildiği yerde kalsın (CLAUDE.md Bölüm 5: stats yalnız sunucu).
 */
export function earnedBadges(context: BadgeContext): BadgeId[] {
  const badges: BadgeId[] = []
  const categories = new Set(context.categoryIds)

  if (context.activitiesCompleted >= 1) badges.push('first_step')
  if (context.activitiesCompleted >= 3) badges.push('regular')
  if (context.activitiesCompleted >= 10) badges.push('senior')
  if (context.activitiesCompleted >= 25) badges.push('legend')

  if (categories.size >= 3) badges.push('explorer')
  if (categories.size >= 5) badges.push('versatile')

  if (context.languageCount >= 5) badges.push('language_bridge')
  if (context.topOrgCount >= 10) badges.push('neighbourhood_hero')
  if (context.isTrainer) badges.push('trainer')

  return badges
}

export const BADGE_EMOJI: Record<BadgeId, string> = {
  first_step: '👣',
  regular: '🔁',
  senior: '🏅',
  legend: '🏆',
  explorer: '🧭',
  versatile: '🎨',
  language_bridge: '🌉',
  neighbourhood_hero: '🦸',
  trainer: '🎓',
}
