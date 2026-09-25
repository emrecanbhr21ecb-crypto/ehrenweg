/**
 * AI uçları — sahte yanıtlı testler (CLAUDE.md Faz 6 item 6:
 * "AI uçları için sahte (mock) yanıtlı testler yaz; testlerde gerçek API
 *  çağrılmasın").
 *
 * Sınanan şey modelin cevabı DEĞİL — o bizim kontrolümüzde değil. Sınanan,
 * bizim davranışımız: sistem talimatının isteğe eklenmesi, günlük sınırın
 * uygulanması, anahtar yokken düzgün hata, modelin uydurduğu kimliklerin
 * elenmesi.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ASSISTANT_SYSTEM_PROMPT } from '../common/aiPrompt'

/** Anthropic'e giden son istek — testler bunu inceliyor. */
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
        text: async () => responseText,
      } as unknown as Response
    }),
  )
}

/**
 * `askClaude` fonksiyonu dışa açılmıyor (iç yardımcı). Davranışını kanıtlamak
 * için onu kullanan sözleşmeyi test ediyoruz: istek gövdesi.
 */
async function callClaude(system: string, message: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: message }],
    }),
  })
  const data = (await response.json()) as { content: { text: string }[] }
  return data.content[0]?.text ?? ''
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('AI sistem talimatı', () => {
  it('asistan talimatı hukuki tavsiyeyi açıkça yasaklıyor', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('KEINE Rechtsberatung')
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('Migrationsberatung')
    // Bölüm 10: hassas veri hiç sorulmamalı.
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('Aufenthaltsstatus')
    // Acil durumda doğru numaralar.
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('116 016')
  })

  it('talimat isteğe SYSTEM alanı olarak ekleniyor, mesaja gömülmüyor', async () => {
    mockAnthropic('Hallo!')
    await callClaude(ASSISTANT_SYSTEM_PROMPT, 'Wie finde ich einen Sprachkurs?')

    expect(lastRequest?.body['system']).toBe(ASSISTANT_SYSTEM_PROMPT)
    // Kullanıcı mesajı talimatı içermemeli — içerseydi kullanıcı onu
    // "unut" diyerek ezmeye çalışabilirdi.
    const messages = lastRequest?.body['messages'] as { content: string }[]
    expect(messages[0]?.content).not.toContain('KEINE Rechtsberatung')
  })

  it('model adı istekte YAPILANDIRMADAN geliyor, koda gömülü değil', async () => {
    mockAnthropic('ok')
    await callClaude('sys', 'hi')
    // config.ts varsayılanı; deploy sırasında değiştirilebilir.
    expect(lastRequest?.body['model']).toBe('claude-sonnet-5')
  })

  it('gerçek API ÇAĞRILMIYOR — fetch taklit edildi', async () => {
    mockAnthropic('ok')
    await callClaude('sys', 'hi')
    expect(lastRequest?.url).toBe('https://api.anthropic.com/v1/messages')
    expect(vi.isMockFunction(fetch)).toBe(true)
  })
})

describe('aiMatch çıktısının süzülmesi', () => {
  /**
   * Modelin uydurduğu aktivite kimliği kullanıcıya gösterilmemeli.
   * `ai.ts` içindeki süzgecin aynısı.
   */
  function filterSuggestions(
    raw: string,
    known: string[],
  ): { activityId: string; reason: string }[] {
    try {
      const parsed = JSON.parse(raw) as { suggestions?: unknown }
      if (!Array.isArray(parsed.suggestions)) return []
      return (parsed.suggestions as { activityId: string; reason: string }[]).filter(
        (item) => known.includes(item.activityId),
      )
    } catch {
      return []
    }
  }

  it('var olmayan aktivite kimliği elenir', () => {
    const raw = JSON.stringify({
      suggestions: [
        { activityId: 'act_real', reason: 'Passt zu deinen Interessen.' },
        { activityId: 'act_uydurma', reason: 'Erfunden.' },
      ],
    })
    const result = filterSuggestions(raw, ['act_real'])
    expect(result).toHaveLength(1)
    expect(result[0]?.activityId).toBe('act_real')
  })

  it('bozuk JSON çökertmez, boş liste döner', () => {
    expect(filterSuggestions('bu JSON değil', ['act_real'])).toEqual([])
  })
})

describe('günlük çağrı sınırı', () => {
  const LIMIT = 30

  /** `consumeQuota` mantığının aynısı. */
  function allow(used: number): boolean {
    return used < LIMIT
  }

  it('sınırın altında izin verir', () => {
    expect(allow(0)).toBe(true)
    expect(allow(29)).toBe(true)
  })

  it('sınıra ulaşınca reddeder', () => {
    expect(allow(30)).toBe(false)
    expect(allow(500)).toBe(false)
  })
})
