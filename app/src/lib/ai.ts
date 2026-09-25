/**
 * AI uçları — CLAUDE.md Bölüm 12.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 BU UÇLAR BUGÜN ÇALIŞMIYOR ve çalıştırılması MÜMKÜN DEĞİL.
 *
 * Anthropic API anahtarı **yalnızca sunucuda** durabilir (CLAUDE.md Bölüm 12:
 * "AI anahtarı yalnız sunucuda"). İstemciye koymak, anahtarı APK'yı indiren
 * herkese vermek demek — faturayı da, anahtarın kötüye kullanımını da.
 * Faz 2–5'teki "istemciye al, kuralla koru" çözümü burada UYGULANAMAZ:
 * bir sırrı kuralla koruyamazsınız.
 *
 * Bu yüzden:
 *   · Fonksiyonlar `functions/src/ai.ts` içinde tam olarak yazıldı.
 *   · Buradaki sarmalayıcı `CLOUD_FUNCTIONS_ENABLED` kapalıyken çağrı
 *     YAPMADAN `unavailable` döner; arayüz bunu dürüstçe gösterir.
 *   · Blaze açılınca tek bayrak değişimiyle hepsi canlanır.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { httpsCallable } from 'firebase/functions'

import { CLOUD_FUNCTIONS_ENABLED } from '@/lib/backend'
import { functions } from '@/lib/firebase'

export type AiResult<T> =
  { ok: true; data: T } | { ok: false; reason: 'unavailable' | 'limit' | 'error' }

/** Ortak çağrı — bayrak kapalıyken ağa hiç çıkmaz. */
async function call<TInput, TOutput>(
  name: string,
  input: TInput,
): Promise<AiResult<TOutput>> {
  if (!CLOUD_FUNCTIONS_ENABLED) return { ok: false, reason: 'unavailable' }

  try {
    const callable = httpsCallable<TInput, TOutput>(functions, name)
    const response = await callable(input)
    return { ok: true, data: response.data }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('resource-exhausted') || message.includes('dailyLimit')) {
      return { ok: false, reason: 'limit' }
    }
    console.error(`[ai] ${name} başarısız:`, error)
    return { ok: false, reason: 'error' }
  }
}

export interface AiMatchSuggestion {
  activityId: string
  /** Kullanıcının dilinde kısa gerekçe. */
  reason: string
}

/** `aiMatch` — ilgi alanı, beceri ve konuma göre öneriler. */
export function aiMatch(input: {
  locale: string
  limit: number
}): Promise<AiResult<{ suggestions: AiMatchSuggestion[] }>> {
  return call('aiMatch', input)
}

/** `aiTranslate` — DE ⇄ EN çeviri + Leichte Sprache özeti. */
export function aiTranslate(input: {
  text: string
  from: 'de' | 'en'
  to: 'de' | 'en'
  simplify: boolean
}): Promise<AiResult<{ translation: string; simple: string }>> {
  return call('aiTranslate', input)
}

/** `aiDraftApplication` — başvuru mesajı taslağı. */
export function aiDraftApplication(input: {
  activityId: string
  locale: string
}): Promise<AiResult<{ draft: string }>> {
  return call('aiDraftApplication', input)
}

/** `parseLink` — haber/etkinlik linkinden başlık, açıklama, görsel. */
export function parseLink(input: {
  url: string
}): Promise<AiResult<{ title: string; description: string; imageURL: string }>> {
  return call('parseLink', input)
}

/** `aiChat` — entegrasyon asistanı. Hukuki tavsiye VERMEZ. */
export function aiChat(input: {
  message: string
  locale: string
  history: { role: 'user' | 'assistant'; content: string }[]
}): Promise<AiResult<{ reply: string; referral: string | null }>> {
  return call('aiChat', input)
}
