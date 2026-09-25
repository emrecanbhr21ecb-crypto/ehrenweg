/**
 * AI — TEK UÇ: `aiTranslate` (CLAUDE.md Bölüm 12).
 *
 * ⚠️ SPESİFİKASYONDAN BİLİNÇLİ SAPMA (docs/DECISIONS.md §12).
 * Bölüm 12 beş AI ucu istiyor: aiMatch, aiTranslate, aiDraftApplication,
 * parseLink, aiChat. Proje sahibiyle 26 Eyl'de yapılan değerlendirmede
 * **dördü kaldırıldı**, yalnız `aiTranslate` bırakıldı. Gerekçeler
 * DECISIONS §12'de; özeti:
 *
 *   · aiMatch  → bir ilçede 12 aktivite var; basit ilgi alanı eşleşmesi
 *                hem anında, hem bedava, hem de açıklanabilir.
 *   · parseLink→ işe yarayan kısmı (og: etiketleri) zaten AI istemiyordu.
 *   · aiDraftApplication → küçük fayda, herkesin aynı taslağı göndermesi riski.
 *   · aiChat   → sistem talimatının neredeyse tamamı "şunu cevaplama"ydı;
 *                geriye kalan "uygulamayı nasıl kullanırım" sorusunu iyi bir
 *                arayüz zaten cevaplamalı. Buna karşılık yanlış cevabın
 *                bedelini kullanıcı ödüyordu. Dar fayda, ağır risk.
 *
 * `aiTranslate` neden KALDI: bir belediye çalışanı her aktivite için
 * Almanca + İngilizce + Leichte Sprache yazmaz. Yazmayınca o alanlar boş
 * kalır — ve **Leichte Sprache tam olarak hedef kitlenin en çok ihtiyaç
 * duyduğu şey.** Burada AI süs değil, erişilebilirlik aracı.
 *
 * ⚠️ HENÜZ DAĞITILMADI (Blaze kapalı). Anahtar istemciye KONULAMAZ: bir
 * sırrı Firestore kuralıyla koruyamazsınız.
 *
 * Sır kurulumu:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY --project ehrenweg-prod
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { z } from 'zod'

import { FieldValue, db } from './common/admin'
import { AI_DAILY_LIMIT, AI_MODEL, ANTHROPIC_API_KEY } from './common/config'
import { parseInput, requireAuth } from './common/guards'

const AI_USAGE = 'aiUsage'

/**
 * Günlük sınırı sayar ve aşımda reddeder (Bölüm 12 "rate limit").
 *
 * Sayaç `users` belgesinde değil ayrı koleksiyonda: `users` istemciye
 * okunuyor ve kotayı orada göstermek gereksiz bilgi sızdırırdı.
 */
async function consumeQuota(uid: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const ref = db.collection(AI_USAGE).doc(`${uid}_${today}`)

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const used = (snapshot.get('count') as number | undefined) ?? 0
    if (used >= AI_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'errors.ai.dailyLimit')
    }
    transaction.set(
      ref,
      { uid, day: today, count: used + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  })
}

const translateSchema = z.object({
  text: z.string().min(1).max(4000),
  from: z.enum(['de', 'en']),
  to: z.enum(['de', 'en']),
  simplify: z.boolean().default(true),
})

/**
 * `aiTranslate` — DE ⇄ EN çeviri + Leichte Sprache özeti.
 *
 * 🔒 Bu fonksiyon HİÇBİR ŞEY YAZMAZ, yalnız öneri döner. Bölüm 12:
 * "kurum onaylamadan kaydedilmesin." Kaydetme kararı her zaman kurumda.
 */
export const aiTranslate = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  const ctx = requireAuth(request)
  await consumeQuota(ctx.uid)
  const input = parseInput(translateSchema, request.data)

  const key = ANTHROPIC_API_KEY.value()
  if (!key) throw new HttpsError('failed-precondition', 'errors.ai.unavailable')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      // Model adı KODA SABİTLENMEZ (CLAUDE.md Bölüm 3).
      model: AI_MODEL.value(),
      max_tokens: 1500,
      system:
        'Du übersetzt Texte für eine Ehrenamts-App. Antworte AUSSCHLIESSLICH ' +
        'mit JSON: {"translation":"...","simple":"..."}. ' +
        '"translation" ist die Übersetzung in die Zielsprache. ' +
        '"simple" ist eine Fassung in LEICHTER SPRACHE in der ZIELsprache: ' +
        'kurze Hauptsätze, ein Gedanke pro Satz, keine Fremdwörter, keine ' +
        'Nebensätze, keine Abkürzungen. Zielgruppe sind Menschen, die die ' +
        'Sprache gerade lernen. Wenn simplify false ist, lass "simple" leer. ' +
        'Erfinde keine Informationen, die nicht im Text stehen.',
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    }),
  })

  if (!response.ok) {
    logger.error('Anthropic hatası', { status: response.status })
    throw new HttpsError('internal', 'errors.ai.failed')
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[]
  }
  const text = data.content?.find((part) => part.type === 'text')?.text
  if (!text) throw new HttpsError('internal', 'errors.ai.failed')

  try {
    const parsed = JSON.parse(text) as { translation?: string; simple?: string }
    return { translation: parsed.translation ?? '', simple: parsed.simple ?? '' }
  } catch {
    logger.warn('aiTranslate JSON çözümlenemedi')
    throw new HttpsError('internal', 'errors.ai.failed')
  }
})
