/**
 * AI — TEK UÇ: `aiTranslate`.
 *
 * ⚠️ Bölüm 12'deki beş AI ucundan dördü proje sahibinin kararıyla
 * KALDIRILDI (docs/DECISIONS.md §12). Kalan tek uç, kurum formunda
 * DE ⇄ EN çeviri ve **Leichte Sprache** özeti öneriyor.
 *
 * 🔴 Bugün çalışmıyor ve çalıştırılması MÜMKÜN DEĞİL: Anthropic anahtarı
 * yalnızca sunucuda durabilir. Diğer fazlardaki "istemciye al, kuralla
 * koru" çözümü burada geçersiz — bir sırrı Firestore kuralıyla
 * koruyamazsınız. Bayrak kapalıyken ağa HİÇ çıkmadan `unavailable` döner.
 */

import { httpsCallable } from 'firebase/functions'

import { CLOUD_FUNCTIONS_ENABLED } from '@/lib/backend'
import { functions } from '@/lib/firebase'

export type AiFailure = 'unavailable' | 'limit' | 'error'

export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: AiFailure }

export interface TranslateResult {
  translation: string
  /** Leichte Sprache özeti. `simplify: false` ise boş. */
  simple: string
}

/**
 * `aiTranslate` — çeviri + kolay dil önerisi.
 *
 * HİÇBİR ŞEY KAYDETMEZ. Öneriyi kabul edip etmemek kurumun kararı
 * (CLAUDE.md Bölüm 12: "kurum onaylamadan kaydedilmesin").
 */
export async function aiTranslate(input: {
  text: string
  from: 'de' | 'en'
  to: 'de' | 'en'
  simplify: boolean
}): Promise<AiResult<TranslateResult>> {
  if (!CLOUD_FUNCTIONS_ENABLED) return { ok: false, reason: 'unavailable' }

  try {
    const callable = httpsCallable<typeof input, TranslateResult>(
      functions,
      'aiTranslate',
    )
    const response = await callable(input)
    return { ok: true, data: response.data }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('resource-exhausted') || message.includes('dailyLimit')) {
      return { ok: false, reason: 'limit' }
    }
    console.error('[ai] aiTranslate başarısız:', error)
    return { ok: false, reason: 'error' }
  }
}
