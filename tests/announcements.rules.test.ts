/**
 * Faz 6 kural testleri — duyurular ve bildirim tercihleri.
 *
 * Push GÖNDERİMİ sunucuda; burada kanıtlanan, duyuruyu kimin yazabildiği ve
 * `pushSent` bayrağının istemciden uydurulamadığı.
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

function announcement(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    orgId: ORG.neukoelln,
    orgName: 'Neukölln',
    title: { de: 'Neues Sprachcafé', en: 'New language café' },
    body: { de: 'Ab Montag jede Woche.', en: 'Every week from Monday.' },
    pinned: true,
    pushSent: false,
    linkActivityId: '',
    imageURL: null,
    createdBy: UID.staff,
    createdAt: serverTimestamp(),
    expiresAt: null,
    ...overrides,
  }
}

beforeAll(async () => {
  env = await createTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      verified: true,
      status: 'approved',
      features: { cashVouchers: false },
    })
  })
})

describe('duyurular', () => {
  it('kurum personeli duyuru yayınlayabilir', async () => {
    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertSucceeds(setDoc(doc(staff, 'announcements', 'a1'), announcement()))
  })

  it('🔒 sıradan kullanıcı duyuru yayınlayamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'announcements', 'a2'), announcement({ createdBy: UID.alice })),
    )
  })

  it('🔒 kurum BAŞKA kurumun adına duyuru yayınlayamaz', async () => {
    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertFails(
      setDoc(doc(staff, 'announcements', 'a3'), announcement({ orgId: ORG.cafe })),
    )
  })

  it('🔒 `pushSent` istemciden true yazılamaz', async () => {
    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()

    // Oluştururken:
    await assertFails(
      setDoc(doc(staff, 'announcements', 'a4'), announcement({ pushSent: true })),
    )

    // Sonradan:
    await assertSucceeds(setDoc(doc(staff, 'announcements', 'a5'), announcement()))
    await assertFails(updateDoc(doc(staff, 'announcements', 'a5'), { pushSent: true }))
  })

  it('duyuruyu giriş yapmış herkes okuyabilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'announcements', 'a6'), announcement())
    })
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(alice, 'announcements', 'a6')))
  })
})

describe('bildirim tercihleri', () => {
  it('kullanıcı kendi tercihlerini yazabilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'users', UID.alice, 'private', 'settings'), {
        announcements: true,
        deadlineReminders: false,
        monthlySummary: true,
        analyticsConsent: false,
        pushTokens: ['token-1'],
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('🔒 başkasının tercihleri ve push jetonları okunamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', UID.alice, 'private', 'settings'), {
        pushTokens: ['gizli-jeton'],
      })
    })
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(bob, 'users', UID.alice, 'private', 'settings')))
  })
})

describe('puan kuralları editörü', () => {
  it('🔒 sıradan kullanıcı config/scoring yazamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'config', 'scoring'), { maxIpPerActivity: 9999, version: 1 }),
    )
  })

  it('admin yazabilir ama sürüm numarası ARTMAK zorunda', async () => {
    const admin = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()

    await assertSucceeds(
      setDoc(doc(admin, 'config', 'scoring'), { maxIpPerActivity: 60, version: 1 }),
    )
    // Aynı sürümle tekrar yazmak: hangi kuralın geçerli olduğu belirsizleşir.
    await assertFails(
      updateDoc(doc(admin, 'config', 'scoring'), { maxIpPerActivity: 80, version: 1 }),
    )
    await assertSucceeds(
      updateDoc(doc(admin, 'config', 'scoring'), { maxIpPerActivity: 80, version: 2 }),
    )
  })
})
