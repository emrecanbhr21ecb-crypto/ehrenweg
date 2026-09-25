/**
 * Sabit sözlükler — kategoriler, beceriler, dil seviyeleri, seviye eşikleri.
 *
 * Neden burada: CLAUDE.md Bölüm 5 "skills: sabit sözlükten" diyor. Kullanıcı
 * serbest metin giremez; aksi hâlde aynı beceri 40 farklı yazımla dolaşır ve
 * eşleştirme/AI önerisi çalışmaz.
 *
 * Görünen metin YOK — yalnız kimlikler. Metinler her dilin catalog.json
 * dosyasından gelir (CLAUDE.md Bölüm 11: hiçbir arayüz metni koda gömülmez).
 */

/** CLAUDE.md Bölüm 5 — categories/{id} listesi. */
export const CATEGORY_IDS = [
  'environment',
  'elderly_care',
  'language_teaching',
  'language_learning',
  'children_youth',
  'culture',
  'sports',
  'digital_skills',
  'community',
  'other',
] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

/**
 * Kategori görselleştirmesi. Renkler yalnız ikon/rozet zeminidir; metin her
 * zaman üstüne koyu yazıyla gelir (WCAG kontrast — theme.css başlığı).
 */
export const CATEGORY_META: Record<CategoryId, { emoji: string; tint: string }> = {
  environment: { emoji: '🌱', tint: 'bg-emerald-100 dark:bg-emerald-900/40' },
  elderly_care: { emoji: '🤝', tint: 'bg-rose-100 dark:bg-rose-900/40' },
  language_teaching: { emoji: '📣', tint: 'bg-amber-100 dark:bg-amber-900/40' },
  language_learning: { emoji: '📚', tint: 'bg-sky-100 dark:bg-sky-900/40' },
  children_youth: { emoji: '🧒', tint: 'bg-violet-100 dark:bg-violet-900/40' },
  culture: { emoji: '🎭', tint: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
  sports: { emoji: '⚽', tint: 'bg-lime-100 dark:bg-lime-900/40' },
  digital_skills: { emoji: '💻', tint: 'bg-cyan-100 dark:bg-cyan-900/40' },
  community: { emoji: '🏘️', tint: 'bg-orange-100 dark:bg-orange-900/40' },
  other: { emoji: '✨', tint: 'bg-gray-100 dark:bg-ink-800' },
}

/** Beceri etiketleri — profilde seçilir, aktivitede `skillsGained` olarak kazanılır. */
export const SKILL_IDS = [
  'teamwork',
  'communication',
  'organisation',
  'first_aid',
  'cooking',
  'gardening',
  'childcare',
  'teaching',
  'translating',
  'it_support',
  'social_media',
  'photography',
  'music',
  'crafts',
  'driving',
  'event_support',
] as const
export type SkillId = (typeof SKILL_IDS)[number]

/**
 * Dil bilgisi. Kod ISO 639-1; seviye CEFR.
 *
 * Gizlilik notu (CLAUDE.md Bölüm 10): konuşulan dil hassas kategori DEĞİLDİR
 * ve eşleştirme için gereklidir. Uyruk/oturum statüsü ise hiç sorulmaz.
 */
export const LANGUAGE_CODES = [
  'de',
  'en',
  'ar',
  'tr',
  'fa',
  'ru',
  'uk',
  'ps',
  'so',
  'ti',
  'ku',
  'fr',
  'es',
  'sq',
  'ro',
  'pl',
  'other',
] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

/**
 * Seviye eşikleri — CLAUDE.md Bölüm 6 tablosu.
 *
 * İstemci bunu YALNIZCA göstermek için kullanır (ilerleme halkası, "bir
 * sonraki seviyeye X katılım kaldı"). Gerçek seviye hesabı sunucuda yapılır
 * ve `users/{uid}.stats.level` alanına yazılır; istemci onu doğrulamaz.
 */
export interface LevelThreshold {
  level: number
  activities: number
  hours: number
  categories: number
}

export const LEVEL_THRESHOLDS: readonly LevelThreshold[] = [
  { level: 1, activities: 0, hours: 0, categories: 0 },
  { level: 2, activities: 3, hours: 0, categories: 0 },
  { level: 3, activities: 8, hours: 20, categories: 0 },
  { level: 4, activities: 15, hours: 50, categories: 3 },
  { level: 5, activities: 30, hours: 120, categories: 0 },
]

export const MAX_LEVEL = 5

/** Bir sonraki seviyeye kalanları hesaplar; en üst seviyede null döner. */
export function nextLevelThreshold(level: number): LevelThreshold | null {
  return LEVEL_THRESHOLDS.find((t) => t.level === level + 1) ?? null
}

/**
 * Seviye ilerlemesi 0–1 arası. Birden fazla ölçüt varsa (katılım + saat +
 * kategori) en geride kalan belirler — kullanıcıya iyimser bir çubuk
 * göstermek yanıltıcı olur.
 */
export function levelProgress(
  stats: { activitiesCompleted: number; hours: number; categoriesCount: number },
  level: number,
): number {
  const next = nextLevelThreshold(level)
  if (!next) return 1

  const current = LEVEL_THRESHOLDS.find((t) => t.level === level)
  if (!current) return 0

  const ratios: number[] = []
  const add = (have: number, from: number, to: number): void => {
    if (to <= from) return
    ratios.push(Math.min(1, Math.max(0, (have - from) / (to - from))))
  }

  add(stats.activitiesCompleted, current.activities, next.activities)
  add(stats.hours, current.hours, next.hours)
  add(stats.categoriesCount, current.categories, next.categories)

  if (ratios.length === 0) return 0
  return Math.min(...ratios)
}
