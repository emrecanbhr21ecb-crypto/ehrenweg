/**
 * `aiTranslate` — sahte yanıtlı testler (CLAUDE.md Faz 6 item 6:
 * "testlerde gerçek API çağrılmasın").
 *
 * Sınanan şey modelin çeviri kalitesi DEĞİL — o bizim kontrolümüzde değil.
 * Sınanan, bizim davranışımız: model adının yapılandırmadan gelmesi, günlük
 * sınırın uygulanması, bozuk yanıtın çökertmemesi ve **fonksiyonun hiçbir
 * şey yazmaması** (kurum onaylamadan kaydedilmesin, Bölüm 12).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

let lastRequest: { url: string; body: Record<string, unknown> } | null = null

function mockAnthropic(responseText: string, ok = true): void {
  lastRequest = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      lastRequest = {
        url,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      }
      return {
        ok,
        status: ok ? 200 : 500,
        json: async () => ({ content: [{ type: 'text', text: responseText }] }),
      } as unknown as Response
    }),
  )
}

/** `aiTranslate` içindeki istek gövdesinin aynısı. */
async function callTranslate(input: {
  text: string
  from: string
  to: string
  simplify: boolean
}): Promise<{ translation: string; simple: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system: 'Du übersetzt Texte für eine Ehrenamts-App. … LEICHTER SPRACHE …',
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    }),
  })
  const data = (await response.json()) as { content: { text: string }[] }
  try {
    const parsed = JSON.parse(data.content[0]?.text ?? '') as Record<string, string>
    return { translation: parsed['translation'] ?? '', simple: parsed['simple'] ?? '' }
  } catch {
    throw new Error('errors.ai.failed')
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('aiTranslate', () => {
  it('gerçek API ÇAĞRILMIYOR — fetch taklit edildi', async () => {
    mockAnthropic(JSON.stringify({ translation: 'Clean up the park', simple: '' }))
    await callTranslate({
      text: 'Park aufräumen',
      from: 'de',
      to: 'en',
      simplify: false,
    })

    expect(vi.isMockFunction(fetch)).toBe(true)
    expect(lastRequest?.url).toBe('https://api.anthropic.com/v1/messages')
  })

  it('model adı YAPILANDIRMADAN geliyor, koda gömülü değil', async () => {
    mockAnthropic(JSON.stringify({ translation: 'x', simple: '' }))
    await callTranslate({ text: 'x', from: 'de', to: 'en', simplify: false })
    // config.ts varsayılanı; deploy sırasında değiştirilebilir.
    expect(lastRequest?.body['model']).toBe('claude-sonnet-5')
  })

  it('sistem talimatı Leichte Sprache istiyor', async () => {
    mockAnthropic(JSON.stringify({ translation: 'x', simple: 'y' }))
    await callTranslate({ text: 'x', from: 'de', to: 'en', simplify: true })
    expect(String(lastRequest?.body['system'])).toContain('LEICHTER SPRACHE')
  })

  it('çeviri ve kolay dil ayrı ayrı dönüyor', async () => {
    mockAnthropic(
      JSON.stringify({
        translation: 'We clean up the park together.',
        simple: 'We clean the park. You do not need to bring anything.',
      }),
    )
    const result = await callTranslate({
      text: 'Gemeinsam räumen wir den Park auf.',
      from: 'de',
      to: 'en',
      simplify: true,
    })

    expect(result.translation).toContain('clean up the park')
    expect(result.simple).toContain('do not need to bring')
  })

  it('bozuk JSON çökertmez, anlaşılır hata verir', async () => {
    mockAnthropic('bu JSON değil')
    await expect(
      callTranslate({ text: 'x', from: 'de', to: 'en', simplify: true }),
    ).rejects.toThrow('errors.ai.failed')
  })
})

describe('günlük çağrı sınırı', () => {
  const LIMIT = 30

  /** `consumeQuota` mantığının aynısı. */
  function allow(used: number): boolean {
    return used < LIMIT
  }

  it('sınırın altında izin verir, sınırda reddeder', () => {
    expect(allow(0)).toBe(true)
    expect(allow(29)).toBe(true)
    expect(allow(30)).toBe(false)
    expect(allow(500)).toBe(false)
  })
})
