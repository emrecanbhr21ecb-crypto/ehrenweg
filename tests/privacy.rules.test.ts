/**
 * Faz 7 güvenlik kuralı testleri — DSGVO hesap silme/dışa aktarma.
 *
 * Prompt item 6: "Silme ve dışa aktarma için test: silinen kullanıcıdan
 * hiçbir iz kalmadığını, ledger toplamlarının bozulmadığını kanıtla."
 *
 * Her blok bir SALDIRI ve bir MEŞRU işlem çiftidir: kullanıcı kendi izini
 * silebilmeli ama bir başkasınınkine ya da muhasebe alanlarına (ledger,
 * tutar, durum) asla dokunamamalı. docs/DECISIONS.md §13.
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

const ALICE_STATS = {
  ip: 120,
  hours: 24,
  activitiesCompleted: 8,
  noShows: 0,
  categoriesCount: 2,
  level: 3,
  consecutiveNoShows: 0,
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
    const db = ctx.firestore()

    await setDoc(doc(db, 'users', UID.alice), {
      displayName: 'Alice',
      email: 'alice@example.de',
      locale: 'de',
      interests: [],
      skills: [],
      languages: [],
      photoURL: null,
      bio: '',
      city: '',
      countryCode: 'DE',
      roleDisplay: 'participant',
      stats: ALICE_STATS,
      trainerStatus: 'none',
    })
    await setDoc(doc(db, 'users', UID.bob), {
      displayName: 'Bob',
      email: 'bob@example.de',
      stats: { ...ALICE_STATS, level: 1, activitiesCompleted: 0, hours: 0 },
      trainerStatus: 'none',
    })

    await setDoc(doc(db, 'attendanceRecords', 'sess_1_uid_alice'), {
      uid: UID.alice,
      activityId: 'act_1',
      sessionId: 'sess_1',
      orgId: ORG.neukoelln,
      method: 'qr',
      status: 'confirmed',
      awarded: true,
      displayName: 'Alice',
    })

    await setDoc(doc(db, 'activities', 'act_1'), {
      orgId: ORG.neukoelln,
      status: 'published',
      requiresApplication: true,
    })
    await setDoc(doc(db, 'activities', 'act_1', 'applicants', UID.alice), {
      uid: UID.alice,
      activityId: 'act_1',
      orgId: ORG.neukoelln,
      status: 'accepted',
      applicantName: 'Alice',
      attended: true,
    })

    await setDoc(doc(db, 'rewardTemplates', 'tmpl_1'), {
      orgId: ORG.neukoelln,
      kind: 'gift_voucher',
      valueCents: 500,
      active: true,
    })
    await setDoc(doc(db, 'vouchers', 'vch_1'), {
      uid: UID.alice,
      templateId: 'tmpl_1',
      orgId: ORG.neukoelln,
      kind: 'gift_voucher',
      valueCents: 500,
      costIp: 0,
      status: 'redeemed',
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
      holderName: 'Alice',
      holderPhotoURL: 'https://example.de/alice.jpg',
    })

    await setDoc(doc(db, 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      verified: true,
      status: 'approved',
    })
    await setDoc(doc(db, 'organizations', ORG.neukoelln, 'members', UID.alice), {
      uid: UID.alice,
      orgId: ORG.neukoelln,
      role: 'org_staff',
      displayName: 'Alice',
      email: 'alice@example.de',
    })

    await setDoc(doc(db, 'trainerApplications', UID.alice), {
      uid: UID.alice,
      status: 'approved',
      motivation: 'Ich möchte unterrichten.',
    })

    await setDoc(doc(db, 'ledger', 'tx_1'), {
      uid: UID.alice,
      type: 'ip_award',
      amount: 30,
      currency: 'IP',
      refId: 'entry_1',
      orgId: ORG.neukoelln,
      actorUid: UID.staff,
      reason: 'attendance',
    })
  })
})

describe('users/{uid} — hesap silme', () => {
  it('kullanıcı kendi profilini silebilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(deleteDoc(doc(alice, 'users', UID.alice)))
  })

  it("Bob, Alice'in profilini SİLEMEZ", async () => {
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(deleteDoc(doc(bob, 'users', UID.alice)))
  })
})

describe('attendanceRecords.displayName — iz silme', () => {
  it('kullanıcı kendi kaydındaki adını boşaltabilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      updateDoc(doc(alice, 'attendanceRecords', 'sess_1_uid_alice'), {
        displayName: '',
      }),
    )
  })

  it('başka bir alana (status, awarded) AYNI ANDA dokunamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'attendanceRecords', 'sess_1_uid_alice'), {
        displayName: '',
        status: 'rejected',
      }),
    )
  })

  it('boş olmayan bir ada DEĞİŞTİREMEZ (yalnız silme yönü açık)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'attendanceRecords', 'sess_1_uid_alice'), {
        displayName: 'Başka İsim',
      }),
    )
  })

  it("Bob, Alice'in kaydındaki adı silemez", async () => {
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(bob, 'attendanceRecords', 'sess_1_uid_alice'), {
        displayName: '',
      }),
    )
  })
})

describe('applicants.applicantName — iz silme', () => {
  it('kullanıcı kendi başvurusundaki adını boşaltabilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      updateDoc(doc(alice, 'activities', 'act_1', 'applicants', UID.alice), {
        applicantName: '',
      }),
    )
  })

  it('aynı yazımda kontenjan sayacını besleyen `status` alanına dokunamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'activities', 'act_1', 'applicants', UID.alice), {
        applicantName: '',
        status: 'withdrawn',
      }),
    )
  })
})

describe('vouchers.holderName/holderPhotoURL — iz silme, muhasebe kalır', () => {
  it('kullanıcı kendi kuponundaki kimlik alanlarını boşaltabilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      updateDoc(doc(alice, 'vouchers', 'vch_1'), {
        holderName: '',
        holderPhotoURL: null,
      }),
    )
  })

  it('tutarı veya durumu DEĞİŞTİREMEZ — finansal kayıt korunur', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'vouchers', 'vch_1'), {
        holderName: '',
        holderPhotoURL: null,
        valueCents: 999999,
      }),
    )
    await assertFails(updateDoc(doc(alice, 'vouchers', 'vch_1'), { status: 'issued' }))
  })
})

describe('organizations/{orgId}/members — kendi üyeliğini bırakma', () => {
  it('kullanıcı kendi üyeliğini silebilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      deleteDoc(doc(alice, 'organizations', ORG.neukoelln, 'members', UID.alice)),
    )
  })

  it('org_admin olmayan biri BAŞKASININ üyeliğini silemez', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'organizations', ORG.neukoelln, 'members', UID.bob),
        { uid: UID.bob, orgId: ORG.neukoelln, role: 'org_staff' },
      )
    })
    await assertFails(
      deleteDoc(doc(alice, 'organizations', ORG.neukoelln, 'members', UID.bob)),
    )
  })
})

describe('trainerApplications — kendi başvurusunu silme', () => {
  it('kullanıcı kendi başvurusunu silebilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(deleteDoc(doc(alice, 'trainerApplications', UID.alice)))
  })

  it('başkasının başvurusunu SİLEMEZ', async () => {
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(deleteDoc(doc(bob, 'trainerApplications', UID.alice)))
  })
})

describe('ledger — silmeden sonra bile DOKUNULAMAZ', () => {
  it('kullanıcı kendi defter kaydını güncelleyemez', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(updateDoc(doc(alice, 'ledger', 'tx_1'), { amount: 0 }))
  })

  it('kullanıcı kendi defter kaydını silemez', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(deleteDoc(doc(alice, 'ledger', 'tx_1')))
  })
})

describe('verifications — PDF doğrulama belgesi', () => {
  it('gerçek sayılarla kendi belgesini oluşturabilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'verifications', 'tok_1'), {
        displayName: 'Alice',
        locale: 'de',
        level: ALICE_STATS.level,
        hours: ALICE_STATS.hours,
        activitiesCompleted: ALICE_STATS.activitiesCompleted,
        issuedAt: serverTimestamp(),
      }),
    )
  })

  it('uydurma (daha yüksek) bir seviyeyle belge AÇAMAZ', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'verifications', 'tok_fake'), {
        displayName: 'Alice',
        locale: 'de',
        level: 5,
        hours: ALICE_STATS.hours,
        activitiesCompleted: ALICE_STATS.activitiesCompleted,
        issuedAt: serverTimestamp(),
      }),
    )
  })

  it('giriş yapmamış biri VAR OLAN belgeyi okuyabilir (QR herkese açık)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'verifications', 'tok_public'), {
        displayName: 'Alice',
        locale: 'de',
        level: ALICE_STATS.level,
        hours: ALICE_STATS.hours,
        activitiesCompleted: ALICE_STATS.activitiesCompleted,
        issuedAt: new Date(),
      })
    })
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, 'verifications', 'tok_public')))
  })
})
