/**
 * AI uçları — CLAUDE.md Bölüm 12.
 *   aiMatch, aiTranslate, aiDraftApplication, parseLink, aiChat
 *
 * ⚠️ HENÜZ DAĞITILMADI (Blaze kapalı). Ama Faz 2–5'teki "istemciye al,
 * kuralla koru" çözümü burada UYGULANAMAZ: Anthropic anahtarı bir SIRDIR
 * ve bir sırrı Firestore kuralıyla koruyamazsınız. İstemciye koymak,
 * anahtarı APK'yı indiren herkese vermektir.
 *
 * Bu yüzden AI, Blaze açılana kadar gerçekten kapalıdır — istemci tarafı
 * (`app/src/lib/ai.ts`) bunu kullanıcıya dürüstçe söyler.
 *
 * Sistem talimatı `docs/AI_ASSISTANT.md` içinde ve TEK KAYNAK odur.
 *
 * Sır kurulumu:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY --project ehrenweg-prod
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { z } from 'zod'

import { COL, FieldValue, db } from './common/admin'
import { AI_MODEL, ANTHROPIC_API_KEY } from './common/config'
import { parseInput, requireAuth, type AuthedContext } from './common/guards'
import { ASSISTANT_SYSTEM_PROMPT } from './common/aiPrompt'

/** Kullanıcı başına günlük çağrı sınırı (Bölüm 12: "rate limit"). */
const AI_DAILY_LIMIT = 30

const AI_USAGE = 'aiUsage'

/**
 * Günlük sınırı sayar ve aşımda reddeder.
 *
 * Sayaç kullanıcı belgesinde değil ayrı bir koleksiyonda: `users` belgesi
 * istemciye okunuyor ve kotayı orada göstermek gereksiz bilgi sızdırırdı.
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

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Anthropic Messages API çağrısı.
 *
 * SDK yerine doğrudan `fetch`: tek uç kullanıyoruz ve fonksiyon paketine
 * ek bağımlılık koymak soğuk başlatmayı uzatır.
 */
async function askClaude(input: {
  system: string
  messages: AnthropicMessage[]
  maxTokens?: number
}): Promise<string> {
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
      max_tokens: input.maxTokens ?? 1024,
      system: input.system,
      messages: input.messages,
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
  return text
}

async function guard(
  request: Parameters<typeof requireAuth>[0],
): Promise<AuthedContext> {
  const ctx = requireAuth(request)
  await consumeQuota(ctx.uid)
  return ctx
}

// --- aiMatch ---------------------------------------------------------------

const matchSchema = z.object({
  locale: z.enum(['de', 'en']).default('de'),
  limit: z.number().int().min(1).max(10).default(5),
})

/** `aiMatch` — ilgi alanı, beceri ve konuma göre öneriler + gerekçe. */
export const aiMatch = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  const ctx = await guard(request)
  const input = parseInput(matchSchema, request.data)

  const user = await db.collection(COL.users).doc(ctx.uid).get()
  const activities = await db
    .collection(COL.activities)
    .where('status', '==', 'published')
    .orderBy('startAt', 'asc')
    .limit(40)
    .get()

  if (activities.empty) return { suggestions: [] }

  // Modele YALNIZ eşleştirme için gerekli alanlar gidiyor. Kişinin adı,
  // e-postası, konumu gönderilmiyor (Bölüm 10 veri minimizasyonu).
  const catalogue = activities.docs.map((doc) => ({
    id: doc.id,
    title: doc.get('title.de') ?? doc.get('title.en') ?? '',
    category: doc.get('categoryId'),
    languages: doc.get('languagesUsed') ?? [],
    online: doc.get('online') === true,
    city: (doc.get('location.address') as string | undefined)?.split(',').pop()?.trim(),
  }))

  const profile = {
    interests: user.get('interests') ?? [],
    skills: user.get('skills') ?? [],
    languages: ((user.get('languages') ?? []) as { code: string }[]).map((l) => l.code),
    city: user.get('city') ?? '',
  }

  const text = await askClaude({
    system:
      'Du ordnest ehrenamtliche Aktivitäten Personen zu. Antworte AUSSCHLIESSLICH ' +
      'mit JSON: {"suggestions":[{"activityId":"...","reason":"..."}]}. ' +
      `Die Begründung ist EIN kurzer Satz in der Sprache "${input.locale}". ` +
      'Erfinde keine activityId — nimm nur IDs aus der Liste.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ profile, activities: catalogue, limit: input.limit }),
      },
    ],
  })

  try {
    const parsed = JSON.parse(text) as { suggestions?: unknown }
    const valid = Array.isArray(parsed.suggestions)
      ? (parsed.suggestions as { activityId: string; reason: string }[]).filter(
          (item) => catalogue.some((entry) => entry.id === item.activityId),
        )
      : []
    return { suggestions: valid.slice(0, input.limit) }
  } catch {
    logger.warn('aiMatch JSON çözümlenemedi')
    return { suggestions: [] }
  }
})

// --- aiTranslate -----------------------------------------------------------

const translateSchema = z.object({
  text: z.string().min(1).max(4000),
  from: z.enum(['de', 'en']),
  to: z.enum(['de', 'en']),
  simplify: z.boolean().default(true),
})

/**
 * `aiTranslate` — DE ⇄ EN çeviri + Leichte Sprache özeti.
 *
 * Bölüm 12: "kurum onaylamadan kaydedilmesin." Bu yüzden fonksiyon HİÇBİR
 * ŞEY YAZMAZ, yalnız öneri döner; kaydetme kararı kurumda.
 */
export const aiTranslate = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  await guard(request)
  const input = parseInput(translateSchema, request.data)

  const text = await askClaude({
    system:
      'Du übersetzt Texte für eine Ehrenamts-App. Antworte AUSSCHLIESSLICH mit ' +
      'JSON: {"translation":"...","simple":"..."}. ' +
      '"translation" ist die Übersetzung. "simple" ist eine Fassung in Leichter ' +
      'Sprache in der ZIELsprache: kurze Sätze, keine Fremdwörter, keine ' +
      'Nebensätze. Wenn simplify false ist, lass "simple" leer.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ],
  })

  try {
    const parsed = JSON.parse(text) as { translation?: string; simple?: string }
    return { translation: parsed.translation ?? '', simple: parsed.simple ?? '' }
  } catch {
    throw new HttpsError('internal', 'errors.ai.failed')
  }
})

// --- aiDraftApplication ----------------------------------------------------

const draftSchema = z.object({
  activityId: z.string().min(1).max(64),
  locale: z.enum(['de', 'en']).default('de'),
})

/** `aiDraftApplication` — başvuru mesajı taslağı. */
export const aiDraftApplication = onCall(
  { secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    const ctx = await guard(request)
    const input = parseInput(draftSchema, request.data)

    const activity = await db.collection(COL.activities).doc(input.activityId).get()
    if (!activity.exists) throw new HttpsError('not-found', 'errors.notFound')

    const user = await db.collection(COL.users).doc(ctx.uid).get()

    const draft = await askClaude({
      maxTokens: 400,
      system:
        'Du schreibst eine kurze Bewerbungsnachricht für ein Ehrenamt. ' +
        'Drei bis fünf Sätze. Einfache Sprache, freundlich, ohne Übertreibung. ' +
        'Erfinde KEINE Erfahrungen, die nicht in den Daten stehen. ' +
        `Schreibe in der Sprache "${input.locale}". Antworte nur mit dem Text.`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            activity: {
              title: activity.get('title.de') ?? activity.get('title.en'),
              description: activity.get('description.de'),
              category: activity.get('categoryId'),
            },
            person: {
              skills: user.get('skills') ?? [],
              languages: ((user.get('languages') ?? []) as { code: string }[]).map(
                (l) => l.code,
              ),
            },
          }),
        },
      ],
    })

    return { draft: draft.trim() }
  },
)

// --- parseLink -------------------------------------------------------------

const linkSchema = z.object({ url: z.string().url().max(500) })

/**
 * `parseLink` — haber/etkinlik linkinden başlık, açıklama, görsel.
 *
 * Önce sayfanın meta etiketlerini okumayı dener; bu genelde yeter ve AI
 * çağrısı yapmaz. Yalnız meta yoksa modele düşer — gereksiz maliyet ve
 * gereksiz gecikme olmasın.
 */
export const parseLink = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  await guard(request)
  const input = parseInput(linkSchema, request.data)

  let html = ''
  try {
    const response = await fetch(input.url, {
      headers: { 'user-agent': 'EhrenwegBot/1.0 (+https://ehrenweg.de)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(String(response.status))
    html = (await response.text()).slice(0, 120_000)
  } catch (error) {
    logger.warn('parseLink sayfayı alamadı', { error })
    throw new HttpsError('invalid-argument', 'errors.ai.linkFailed')
  }

  const meta = (property: string): string => {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    )
    return pattern.exec(html)?.[1] ?? ''
  }

  const title = meta('og:title') || /<title>([^<]+)<\/title>/i.exec(html)?.[1] || ''
  const description = meta('og:description') || meta('description')
  const imageURL = meta('og:image')

  if (title && description) {
    return { title: title.trim(), description: description.trim(), imageURL }
  }

  // Meta yoksa modelden çıkar.
  const text = await askClaude({
    maxTokens: 500,
    system:
      'Du extrahierst aus HTML die Kerninformation einer Veranstaltung. ' +
      'Antworte AUSSCHLIESSLICH mit JSON: ' +
      '{"title":"...","description":"...","imageURL":"..."}.',
    messages: [{ role: 'user', content: html.slice(0, 20_000) }],
  })

  try {
    const parsed = JSON.parse(text) as Record<string, string>
    return {
      title: parsed['title'] ?? title,
      description: parsed['description'] ?? description,
      imageURL: parsed['imageURL'] ?? imageURL,
    }
  } catch {
    return { title, description, imageURL }
  }
})

// --- aiChat ----------------------------------------------------------------

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  locale: z.enum(['de', 'en']).default('de'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .default([]),
})

/**
 * `aiChat` — entegrasyon asistanı.
 *
 * Sistem talimatı `docs/AI_ASSISTANT.md` içinde ve `common/aiPrompt.ts`
 * üzerinden okunuyor. Asistan hukuki tavsiye VERMEZ, doğru kuruma
 * yönlendirir; gerekçesi o dosyada.
 */
export const aiChat = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  await guard(request)
  const input = parseInput(chatSchema, request.data)

  const reply = await askClaude({
    maxTokens: 800,
    system: ASSISTANT_SYSTEM_PROMPT,
    messages: [...input.history, { role: 'user', content: input.message }],
  })

  // Yönlendirme yapıldıysa arayüz ayrı bir kutuda göstersin diye işaretle.
  const referral =
    /MBE|Migrationsberatung|Jugendmigrationsdienst|JMD|Ausländerbehörde|Jobcenter|Verbraucherzentrale/i.exec(
      reply,
    )?.[0] ?? null

  return { reply: reply.trim(), referral }
})
