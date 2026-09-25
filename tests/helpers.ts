/**
 * Kural testleri için ortak yardımcılar.
 *
 * Her test dosyası aynı emülatör örneğini paylaşır; `beforeEach` içinde
 * veri temizlenir.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

export const PROJECT_ID = 'demo-ehrenweg'

/** Test kimlikleri — okunabilir olsun diye sabit. */
export const UID = {
  alice: 'uid_alice', // sıradan katılımcı
  bob: 'uid_bob', // başka bir katılımcı
  trainer: 'uid_trainer', // onaylı eğitmen
  staff: 'uid_staff', // Neukölln org_staff
  orgAdmin: 'uid_orgadmin', // Neukölln org_admin
  cashier: 'uid_cashier', // Neukölln redemption_officer
  partner: 'uid_partner', // kafe partner
  admin: 'uid_admin', // platform_admin
} as const

export const ORG = {
  neukoelln: 'org_neukoelln',
  cafe: 'org_cafe_mosaik',
} as const

/**
 * Claim şekilleri — functions/src/common/roles.ts ile AYNI olmalı.
 *
 * `email` gerçek token'da her zaman bulunur ve profil oluşturma kuralı
 * (users create) belgedeki e-posta ile bunun eşleşmesini şart koşar.
 */
export const CLAIMS = {
  participant: {
    role: 'participant',
    email_verified: true,
    email: 'alice@example.de',
  },
  participantUnverified: { role: 'participant', email_verified: false },
  trainer: { role: 'trainer', email_verified: true },
  staff: {
    role: 'participant',
    email_verified: true,
    orgs: { [ORG.neukoelln]: 'org_staff' },
  },
  orgAdmin: {
    role: 'participant',
    email_verified: true,
    orgs: { [ORG.neukoelln]: 'org_admin' },
  },
  cashier: {
    role: 'participant',
    email_verified: true,
    orgs: { [ORG.neukoelln]: 'redemption_officer' },
  },
  partner: {
    role: 'participant',
    email_verified: true,
    orgs: { [ORG.cafe]: 'partner' },
  },
  admin: { role: 'platform_admin', email_verified: true },
} as const

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const rulesPath = fileURLToPath(new URL('../firestore.rules', import.meta.url))

  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(rulesPath, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}
