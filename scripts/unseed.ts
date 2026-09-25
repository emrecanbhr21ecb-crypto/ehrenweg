/**
 * Demo içeriğini tek komutla siler.
 *
 * Proje sahibinin kararı: "Her demo belgesi `seed: true` işaretli; `unseed`
 * ile tek komutla silinecek." Bu script YALNIZCA o işareti taşıyan belgeleri
 * siler — gerçek kurumların ve gerçek kullanıcıların verisine dokunmaz.
 *
 * Çalıştırma:
 *   npm run unseed                          (emülatör)
 *   npm run unseed -- --project ehrenweg-dev
 */

import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const emulator = Boolean(process.env['FIRESTORE_EMULATOR_HOST'])
const projectId =
  arg('project') ?? process.env['GCLOUD_PROJECT'] ?? (emulator ? 'demo-ehrenweg' : '')

if (!projectId) {
  console.error('✖ Proje kimliği yok. --project <id> ver ya da emülatörde çalıştır.')
  process.exit(1)
}

const keyFile = arg('key') ?? process.env['GOOGLE_APPLICATION_CREDENTIALS']

/**
 * Kimlik iki biçimde gelebilir:
 *   · servis hesabı anahtarı  (`"type": "service_account"`)  → cert()
 *   · kullanıcı kimliği / ADC (`"type": "authorized_user"`)  → applicationDefault()
 * Yanlış olanı seçmek "must contain a string project_id" hatası verir, o
 * yüzden dosyanın kendisine bakıyoruz.
 */
function credentialFor(path: string | undefined) {
  if (!path) return applicationDefault()
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
  if (parsed['type'] === 'service_account') return cert(parsed)
  process.env['GOOGLE_APPLICATION_CREDENTIALS'] = path
  return applicationDefault()
}

initializeApp({
  projectId,
  ...(emulator ? {} : { credential: credentialFor(keyFile) }),
})

const db = getFirestore()

/** Seed damgası taşıyan belgeleri siler; alt koleksiyonları da temizler. */
async function clear(collection: string): Promise<number> {
  const snapshot = await db.collection(collection).where('seed', '==', true).get()
  if (snapshot.empty) return 0

  for (const doc of snapshot.docs) {
    // Alt koleksiyonlar (applicants, members) belge silinince kalıcı olurdu.
    await db.recursiveDelete(doc.ref)
  }
  return snapshot.size
}

async function unseed(): Promise<void> {
  console.log(`→ Proje: ${projectId}${emulator ? ' (emülatör)' : ' (GERÇEK)'}`)

  let total = 0
  for (const collection of ['activities', 'organizations', 'categories']) {
    const count = await clear(collection)
    console.log(`  ${collection}: ${count} belge silindi`)
    total += count
  }

  console.log(`✔ Toplam ${total} demo belgesi silindi. Gerçek veriye dokunulmadı.`)
}

unseed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('✖ Unseed başarısız:', error)
    process.exit(1)
  })
