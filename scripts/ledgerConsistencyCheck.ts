/**
 * Defter tutarlılık kontrolü — CLAUDE.md Bölüm 7.3, Faz 4 item 7.
 *
 * "Kullanıcının IP bakiyesi ve kurumun harcaması ledger'dan yeniden
 *  hesaplanabilir olmalı."
 *
 * Bu script tam olarak onu yapıyor: `ledger` koleksiyonunu baştan okuyup
 * her kullanıcının IP bakiyesini ve her kurumun bağladığı bütçeyi yeniden
 * hesaplıyor, sonra saklanan değerlerle karşılaştırıyor.
 *
 * Tutmuyorsa iki ihtimal var ve ikisi de ciddi: ya bir kural delinmiş, ya da
 * bir commit yarım kalmış. Script hiçbir şeyi DÜZELTMEZ — yalnız raporlar.
 * Para tarafında sessizce "onarmak", asıl hatayı görünmez kılardı.
 *
 * Çalıştırma:
 *   npm run ledger:check                            (emülatör)
 *   npm run ledger:check -- --project ehrenweg-prod
 *
 * Çıkış kodu 1 = tutarsızlık var (CI'da kırmızı).
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

interface Entry {
  uid: string
  type: string
  amount: number
  currency: string
  orgId: string
}

async function check(): Promise<void> {
  console.log(`→ Proje: ${projectId}${emulator ? ' (emülatör)' : ''}`)

  const ledger = await db.collection('ledger').get()
  const entries: Entry[] = ledger.docs.map((doc) => ({
    uid: (doc.get('uid') as string | undefined) ?? '',
    type: (doc.get('type') as string | undefined) ?? '',
    amount: (doc.get('amount') as number | undefined) ?? 0,
    currency: (doc.get('currency') as string | undefined) ?? 'IP',
    orgId: (doc.get('orgId') as string | undefined) ?? '',
  }))

  // --- IP bakiyeleri -------------------------------------------------------
  const computed = new Map<string, number>()
  for (const entry of entries) {
    if (entry.currency !== 'IP') continue
    computed.set(entry.uid, (computed.get(entry.uid) ?? 0) + entry.amount)
  }

  const users = await db.collection('users').get()
  const stored = new Map<string, number>()
  for (const user of users.docs) {
    stored.set(user.id, (user.get('stats.ip') as number | undefined) ?? 0)
  }

  const uids = new Set([...computed.keys(), ...stored.keys()])
  const mismatches: string[] = []

  for (const uid of uids) {
    const a = stored.get(uid) ?? 0
    const b = computed.get(uid) ?? 0
    if (a !== b) mismatches.push(`  · ${uid}: users.stats.ip=${a}, ledger=${b}`)
  }

  // --- Kurum bütçeleri -----------------------------------------------------
  // `voucher_issue` bütçeyi bağlar, `voucher_revoke` serbest bırakır.
  // `voucher_redeem` bütçeyi ikinci kez düşürmez — basımda zaten bağlandı.
  const orgSpend = new Map<string, number>()
  for (const entry of entries) {
    if (entry.currency !== 'EUR') continue
    if (entry.type !== 'voucher_issue' && entry.type !== 'voucher_revoke') continue
    orgSpend.set(entry.orgId, (orgSpend.get(entry.orgId) ?? 0) + entry.amount)
  }

  const templates = await db.collection('rewardTemplates').get()
  const templateSpend = new Map<string, number>()
  for (const template of templates.docs) {
    const orgId = (template.get('orgId') as string | undefined) ?? ''
    const spent = (template.get('spentCents') as number | undefined) ?? 0
    templateSpend.set(orgId, (templateSpend.get(orgId) ?? 0) + spent)
  }

  const budgetIssues: string[] = []
  for (const [orgId, fromTemplates] of templateSpend) {
    const fromLedger = orgSpend.get(orgId) ?? 0
    // İptal edilen kuponlar defterde geri veriliyor ama şablon sayacında
    // kalıyor (bütçe bilerek serbest bırakılmıyor). Bu yüzden defterdeki
    // tutar şablondakinden KÜÇÜK olabilir; büyük olmamalı.
    if (fromLedger > fromTemplates) {
      budgetIssues.push(
        `  · ${orgId}: şablonlar ${fromTemplates} sent, defter ${fromLedger} sent`,
      )
    }
  }

  console.log(`  ${entries.length} defter kaydı, ${uids.size} hesap incelendi.`)

  if (mismatches.length === 0 && budgetIssues.length === 0) {
    console.log('✔ Defter tutarlı. Hiçbir sapma yok.')
    return
  }

  if (mismatches.length > 0) {
    console.error(`\n✖ ${mismatches.length} bakiye sapması:`)
    for (const line of mismatches) console.error(line)
  }
  if (budgetIssues.length > 0) {
    console.error(`\n✖ ${budgetIssues.length} bütçe sapması:`)
    for (const line of budgetIssues) console.error(line)
  }
  console.error('\nScript hiçbir şeyi düzeltmedi — sapmalar elden incelenmeli.')
  process.exit(1)
}

check()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('✖ Kontrol başarısız:', error)
    process.exit(1)
  })
