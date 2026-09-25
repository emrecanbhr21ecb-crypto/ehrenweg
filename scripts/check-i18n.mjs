#!/usr/bin/env node
/**
 * Çeviri bütünlüğü denetimi (CLAUDE.md Bölüm 11, P04 madde 1).
 *
 * Neden gerekli: tip güvenli i18n yalnız *Almanca* dosyayı referans alır
 * (i18next.d.ts). Yani Almanca'ya anahtar eklenip İngilizce'ye eklenmezse
 * derleme geçer, kullanıcı ise ekranda ham anahtar görür. Bu script o boşluğu
 * kapatır ve CI'da çalışır.
 *
 * Denetimler:
 *   1. Her dilde aynı anahtar kümesi var mı?
 *   2. Boş string bırakılmış mı? ("" = çevrilmemiş)
 *   3. Yer tutucular ({{name}}) diller arasında tutuyor mu?
 *
 * Çıkış kodu 1 = CI kırmızı.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'app',
  'src',
  'locales',
)

/** Referans dil — eksik anahtarlar buna göre ölçülür. */
const REFERENCE = 'de'

/** İç içe nesneyi "a.b.c" düz anahtarlara çevirir. */
function flatten(value, prefix = '', out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, out)
    } else {
      out.set(path, child)
    }
  }
  return out
}

/** {{name}} biçimindeki yer tutucuları çıkarır. */
function placeholders(text) {
  if (typeof text !== 'string') return new Set()
  return new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))
}

function loadLocale(locale) {
  const dir = join(LOCALES_DIR, locale)
  const namespaces = new Map()

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const ns = file.replace(/\.json$/, '')
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    namespaces.set(ns, flatten(raw))
  }
  return namespaces
}

const locales = readdirSync(LOCALES_DIR).filter((entry) =>
  statSync(join(LOCALES_DIR, entry)).isDirectory(),
)

if (!locales.includes(REFERENCE)) {
  console.error(`✖ Referans dil "${REFERENCE}" bulunamadı.`)
  process.exit(1)
}

const loaded = new Map(locales.map((locale) => [locale, loadLocale(locale)]))
const reference = loaded.get(REFERENCE)
const problems = []

for (const [locale, namespaces] of loaded) {
  // 1. Ad alanı eksik mi?
  for (const ns of reference.keys()) {
    if (!namespaces.has(ns)) {
      problems.push(`${locale}: "${ns}.json" dosyası yok`)
    }
  }

  for (const [ns, entries] of namespaces) {
    const referenceEntries = reference.get(ns)
    if (!referenceEntries) {
      problems.push(`${locale}/${ns}.json: ${REFERENCE} dilinde karşılığı yok`)
      continue
    }

    // 2. Eksik anahtarlar
    for (const key of referenceEntries.keys()) {
      if (!entries.has(key)) {
        problems.push(`${locale}/${ns}: EKSİK anahtar "${key}"`)
      }
    }

    // 3. Fazla anahtarlar (referansta olmayan) — ölü çeviri
    if (locale !== REFERENCE) {
      for (const key of entries.keys()) {
        if (!referenceEntries.has(key)) {
          problems.push(
            `${locale}/${ns}: FAZLA anahtar "${key}" (${REFERENCE} dilinde yok)`,
          )
        }
      }
    }

    // 4. Boş değer ve yer tutucu uyuşmazlığı
    for (const [key, value] of entries) {
      if (typeof value === 'string' && value.trim() === '') {
        problems.push(`${locale}/${ns}: BOŞ değer "${key}"`)
      }

      const referenceValue = referenceEntries.get(key)
      if (referenceValue === undefined) continue

      const expected = placeholders(referenceValue)
      const actual = placeholders(value)

      for (const name of expected) {
        if (!actual.has(name)) {
          problems.push(
            `${locale}/${ns}: "${key}" içinde {{${name}}} yer tutucusu kayıp`,
          )
        }
      }
      for (const name of actual) {
        if (!expected.has(name)) {
          problems.push(
            `${locale}/${ns}: "${key}" içinde fazladan {{${name}}} yer tutucusu`,
          )
        }
      }
    }
  }
}

const total = [...reference.values()].reduce((sum, map) => sum + map.size, 0)

if (problems.length > 0) {
  console.error(`✖ Çeviri denetimi başarısız — ${problems.length} sorun:\n`)
  for (const problem of problems) console.error(`  · ${problem}`)
  console.error(
    `\nDiller: ${locales.join(', ')} · Referans: ${REFERENCE} (${total} anahtar)`,
  )
  process.exit(1)
}

console.log(
  `✔ Çeviri denetimi temiz — ${locales.length} dil, ${total} anahtar, eksik yok.`,
)
