/**
 * Faz 5 güvenlik kuralı testleri — CLAUDE.md Bölüm 8, prompt item 7:
 * "trainer olmayan biri eğitim öneremesin, kimse kendi başvurusunu
 *  onaylayamasın."
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { Timestamp, doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

const TRAINING = 'act_training'

const future = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() + ms)
const past = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() - ms)

/** Eğitmenin önerdiği kurs taslağı. */
function trainingDraft(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    orgId: ORG.neukoelln,
    orgName: 'Neukölln',
    createdBy: UID.trainer,
    type: 'training',
    trainerUid: UID.trainer,
    title: { de: 'Deutschkurs', en: 'German course' },
    description: { de: 'x', en: 'x' },
    simpleDescription: { de: '', en: '' },
    categoryId: 'language_learning',
    skillsGained: [],
    languagesUsed: ['de'],
    location: { address: 'Karl-Marx-Str. 1', lat: null, lng: null },
    online: false,
    startAt: future(7 * 86_400_000),
    endAt: future(7 * 86_400_000 + 7_200_000),
    applicationDeadline: null,
    capacity: 12,
    requiresApplication: true,
    minLevel: 0,
    status: 'draft',
    rewards: { ip: 20 },
    hoursCredited: 2,
    coverImageURL: null,
    passportEnabled: true,
    stats: { applicants: 0, attendees: 0 },
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: '',
    ...overrides,
  }
}

function applicationPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uid: UID.alice,
    displayName: 'Alice',
    email: 'alice@example.de',
    status: 'pending',
    topics: ['teaching'],
    teachingLanguage: 'de',
    teachingLanguageLevel: 'C1',
    motivation: 'Ich möchte Deutsch unterrichten, weil es mir selbst geholfen hat.',
    certificateDataUrl: 'data:image/jpeg;base64,AAAA',
    snapshot: {
      level: 3,
      hours: 25,
      activitiesCompleted: 9,
      noShows: 0,
      noShowRate: 0,
      accountAgeDays: 90,
    },
    reviewedBy: null,
    reviewedAt: null,
    note: '',
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
    const db = ctx.firestore()

    await setDoc(doc(db, 'users', UID.alice), {
      displayName: 'Alice',
      email: 'alice@example.de',
      stats: {
        ip: 300,
        hours: 25,
        activitiesCompleted: 9,
        noShows: 0,
        categoriesCount: 3,
        level: 3,
        consecutiveNoShows: 0,
      },
      // Alice HENÜZ eğitmen değil.
      trainerStatus: 'none',
    })

    await setDoc(doc(db, 'users', UID.trainer), {
      displayName: 'Tarek',
      email: 'tarek@example.de',
      stats: {
        ip: 400,
        hours: 30,
        activitiesCompleted: 12,
        noShows: 0,
        categoriesCount: 3,
        level: 3,
        consecutiveNoShows: 0,
      },
      // Onaylı eğitmen — kural claim yoksa bu alana düşüyor.
      trainerStatus: 'approved',
    })

    await setDoc(doc(db, 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      verified: true,
      status: 'approved',
      features: { cashVouchers: false },
    })
  })
})

// ===========================================================================
// item 7 — eğitim önerme
// ===========================================================================

describe('eğitim önerme', () => {
  it('🔒 eğitmen OLMAYAN biri eğitim öneremez', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(alice, 'activities', TRAINING),
        trainingDraft({ createdBy: UID.alice, trainerUid: UID.alice }),
      ),
    )
  })

  it('onaylı eğitmen kendi adına TASLAK açabilir', async () => {
    const trainer = env
      .authenticatedContext(UID.trainer, CLAIMS.participantVerifiedOnly)
      .firestore()
    await assertSucceeds(setDoc(doc(trainer, 'activities', TRAINING), trainingDraft()))
  })

  it('🔒 eğitmen doğrudan YAYINA alamaz — kurum/admin onayı şart', async () => {
    const trainer = env
      .authenticatedContext(UID.trainer, CLAIMS.participantVerifiedOnly)
      .firestore()
    await assertFails(
      setDoc(
        doc(trainer, 'activities', TRAINING),
        trainingDraft({ status: 'published' }),
      ),
    )
  })

  it('🔒 eğitmen BAŞKASINI eğitmen göstererek kurs açamaz', async () => {
    const trainer = env
      .authenticatedContext(UID.trainer, CLAIMS.participantVerifiedOnly)
      .firestore()
    await assertFails(
      setDoc(
        doc(trainer, 'activities', TRAINING),
        trainingDraft({ trainerUid: UID.alice }),
      ),
    )
  })
})

// ===========================================================================
// item 7 — başvuru ve onay
// ===========================================================================

describe('eğitmen başvurusu', () => {
  it('kullanıcı kendi başvurusunu gönderebilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'trainerApplications', UID.alice), {
        ...applicationPayload(),
        submittedAt: (await import('firebase/firestore')).serverTimestamp(),
      }),
    )
  })

  it('🔒 KİMSE kendi başvurusunu onaylayamaz', async () => {
    const { serverTimestamp } = await import('firebase/firestore')
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    // Doğrudan 'approved' göndermek:
    await assertFails(
      setDoc(doc(alice, 'trainerApplications', UID.alice), {
        ...applicationPayload({ status: 'approved' }),
        submittedAt: serverTimestamp(),
      }),
    )

    // Önce kurallara uygun gönderip sonra onaylamayı denemek:
    await assertSucceeds(
      setDoc(doc(alice, 'trainerApplications', UID.alice), {
        ...applicationPayload(),
        submittedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(alice, 'trainerApplications', UID.alice), {
        status: 'approved',
        reviewedBy: UID.alice,
        reviewedAt: serverTimestamp(),
        note: '',
      }),
    )
  })

  it('🔒 kullanıcı kendini eğitmen YAPAMAZ (trainerStatus kilitli)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { trainerStatus: 'approved' }),
    )
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { roleDisplay: 'trainer' }),
    )
  })

  it('platform admin onaylayabilir ve eğitmen yetkisi verir', async () => {
    const { serverTimestamp } = await import('firebase/firestore')

    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'trainerApplications', UID.alice),
        applicationPayload(),
      )
    })

    const admin = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'trainerApplications', UID.alice), {
        status: 'approved',
        reviewedBy: UID.admin,
        reviewedAt: serverTimestamp(),
        note: '',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(admin, 'users', UID.alice), {
        trainerStatus: 'approved',
        roleDisplay: 'trainer',
      }),
    )
  })

  it('🔒 başkasının başvurusu okunamaz (dil belgesi içeriyor)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'trainerApplications', UID.alice),
        applicationPayload(),
      )
    })

    const { getDoc } = await import('firebase/firestore')
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(bob, 'trainerApplications', UID.alice)))
  })
})

// ===========================================================================
// Eğitim geri bildirimi
// ===========================================================================

describe('eğitim geri bildirimi', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'activities', TRAINING), {
        ...trainingDraft({
          status: 'published',
          startAt: past(7_200_000),
          endAt: past(3_600_000),
        }),
      })
    })
  })

  function feedbackPayload(uid: string): Record<string, unknown> {
    return {
      uid,
      activityId: TRAINING,
      trainerUid: UID.trainer,
      orgId: ORG.neukoelln,
      rating: 5,
      comment: 'Sehr hilfreich.',
      displayName: 'Alice',
      hidden: false,
      createdAt: new Date(),
    }
  }

  it('🔒 KATILMAYAN biri puan veremez', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(alice, 'activities', TRAINING, 'feedback', UID.alice),
        feedbackPayload(UID.alice),
      ),
    )
  })

  it('katılan kişi puan verebilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      // Pasaport girdisi = katılımın kanıtı.
      await setDoc(
        doc(ctx.firestore(), 'passportEntries', `${TRAINING}_${UID.alice}`),
        {
          uid: UID.alice,
          activityId: TRAINING,
          orgId: ORG.neukoelln,
          status: 'completed',
        },
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(
        doc(alice, 'activities', TRAINING, 'feedback', UID.alice),
        feedbackPayload(UID.alice),
      ),
    )
  })

  it('🔒 kullanıcı kendi yorumunu GİZLEYEMEZ, kurum gizleyebilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'passportEntries', `${TRAINING}_${UID.alice}`), {
        uid: UID.alice,
        activityId: TRAINING,
        orgId: ORG.neukoelln,
        status: 'completed',
      })
      await setDoc(
        doc(db, 'activities', TRAINING, 'feedback', UID.alice),
        feedbackPayload(UID.alice),
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'activities', TRAINING, 'feedback', UID.alice), {
        hidden: true,
      }),
    )

    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertSucceeds(
      updateDoc(doc(staff, 'activities', TRAINING, 'feedback', UID.alice), {
        hidden: true,
      }),
    )
  })

  it('🔒 5 üstü puan verilemez', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'passportEntries', `${TRAINING}_${UID.alice}`),
        {
          uid: UID.alice,
          activityId: TRAINING,
          orgId: ORG.neukoelln,
          status: 'completed',
        },
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'activities', TRAINING, 'feedback', UID.alice), {
        ...feedbackPayload(UID.alice),
        rating: 99,
      }),
    )
  })
})
