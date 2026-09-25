/**
 * Faz 3 güvenlik kuralı testleri — CLAUDE.md Bölüm 14, prompt item 10 ve 11.
 *
 * item 10: "passportEntries, attendanceRecords, ledger ve users.stats
 *           istemciden kesinlikle yazılamasın. Bunu testlerle kanıtla."
 * item 11: süresi geçmiş kod, yanlış kod ve çift tarama senaryoları.
 *
 * Buradaki her test bir SALDIRIDIR. Yoklama akışının tamamı kurallarla
 * korunuyor (Blaze kapalı, sunucu yok — docs/DECISIONS.md §9), yani bu
 * dosya "güvenlik gerçekten çalışıyor mu" sorusunun tek cevabı.
 *
 * Not: iki tarayıcı pencereli Playwright testi yazılmadı; taramanın
 * doğrulandığı yer tarayıcı değil, kural. Aynı üç senaryo (expired /
 * wrong-code / çift tarama) burada, tam olarak karar verildiği katmanda
 * sınanıyor.
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { Timestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

const SESSION = 'sess_live'
const ACTIVITY = 'act_attend'
const NONCE = 'LIVE-NONCE-123456789012'
const MANUAL = '424242'

/** Kural belge kimliğini bu kalıpta bekliyor. */
const recordId = (uid: string): string => `${SESSION}_${uid}`

const future = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() + ms)
const past = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() - ms)

/** Alice'in gerçek sayaçları — tarama kaydındaki kopya bununla eşleşmeli. */
const ALICE_STATS = {
  ip: 100,
  hours: 10,
  activitiesCompleted: 3,
  noShows: 0,
  categoriesCount: 1,
  level: 2,
  consecutiveNoShows: 0,
}

function scanPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: UID.alice,
    activityId: ACTIVITY,
    sessionId: SESSION,
    orgId: ORG.neukoelln,
    method: 'qr',
    scannedAt: Timestamp.now(),
    status: 'confirmed',
    geoOk: null,
    displayName: 'Alice',
    awarded: false,
    statsSnapshot: {
      ip: ALICE_STATS.ip,
      hours: ALICE_STATS.hours,
      activitiesCompleted: ALICE_STATS.activitiesCompleted,
      categoriesCount: ALICE_STATS.categoriesCount,
    },
    isNewCategory: false,
    codeId: 'code_1',
    signature: NONCE,
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
      locale: 'de',
      stats: ALICE_STATS,
      trainerStatus: 'none',
    })

    await setDoc(doc(db, 'users', UID.bob), {
      displayName: 'Bob',
      email: 'bob@example.de',
      stats: {
        ...ALICE_STATS,
        ip: 0,
        activitiesCompleted: 0,
        categoriesCount: 0,
        level: 1,
      },
    })

    await setDoc(doc(db, 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      type: 'municipality',
      verified: true,
      status: 'approved',
      features: { cashVouchers: false },
    })

    await setDoc(doc(db, 'activities', ACTIVITY), {
      orgId: ORG.neukoelln,
      orgName: 'Bezirksamt Berlin-Neukölln',
      status: 'published',
      type: 'volunteering',
      title: { de: 'Hasenheide', en: 'Hasenheide' },
      categoryId: 'environment',
      capacity: 30,
      requiresApplication: true,
      startAt: past(2 * 3_600_000),
      endAt: past(3_600_000),
      applicationDeadline: null,
      rewards: { ip: 30 },
      hoursCredited: 3,
      minLevel: 0,
      stats: { applicants: 1, attendees: 0 },
      skillsGained: ['teamwork'],
    })

    await setDoc(doc(db, 'activities', ACTIVITY, 'applicants', UID.alice), {
      uid: UID.alice,
      activityId: ACTIVITY,
      orgId: ORG.neukoelln,
      status: 'accepted',
      attended: false,
    })

    await setDoc(doc(db, 'attendanceSessions', SESSION), {
      activityId: ACTIVITY,
      orgId: ORG.neukoelln,
      activityTitle: 'Hasenheide',
      startedBy: UID.staff,
      active: true,
      rotationSeconds: 30,
      requireGeo: false,
      geoRadiusMeters: 200,
      geoLat: null,
      geoLng: null,
    })

    // Okunamayan kod belgesi — kuralın doğrulama kaynağı.
    await setDoc(doc(db, 'attendanceSessions', SESSION, 'codes', 'current'), {
      codeId: 'code_1',
      nonce: NONCE,
      manualCode: MANUAL,
      expiresAt: future(30_000),
    })
  })
})

// ===========================================================================
// item 11 — tarama senaryoları
// ===========================================================================

describe('yoklama taraması', () => {
  it('geçerli kodla tarama kabul edilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
  })

  it('YANLIŞ kod reddedilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(alice, 'attendanceRecords', recordId(UID.alice)),
        scanPayload({ signature: 'UYDURMA-KOD-000000000000' }),
      ),
    )
  })

  it('SÜRESİ GEÇMİŞ kod reddedilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'attendanceSessions', SESSION, 'codes', 'current'),
        { codeId: 'code_1', nonce: NONCE, manualCode: MANUAL, expiresAt: past(1000) },
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
  })

  it('ÇİFT tarama reddedilir (kayıt kimliği sabit)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
    // İkinci yazma aynı belgeye gelir; create değil update olur ve
    // güncelleme yalnız kurum personeline açıktır.
    await assertFails(
      setDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
  })

  it('KAPALI oturuma tarama reddedilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'attendanceSessions', SESSION), {
        active: false,
      })
    })
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
  })

  it('başkasının adına tarama reddedilir', async () => {
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(bob, 'attendanceRecords', recordId(UID.alice)), scanPayload()),
    )
  })

  it('sayaç kopyası ŞİŞİRİLEMEZ (kural gerçek stats ile karşılaştırır)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(alice, 'attendanceRecords', recordId(UID.alice)),
        scanPayload({
          statsSnapshot: {
            ip: 9999,
            hours: 500,
            activitiesCompleted: 99,
            categoriesCount: 9,
          },
        }),
      ),
    )
  })

  it('manuel kod doğruysa kabul, yanlışsa reddedilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    await assertFails(
      setDoc(
        doc(alice, 'attendanceRecords', recordId(UID.alice)),
        scanPayload({ method: 'manual_code', signature: '000000' }),
      ),
    )

    await assertSucceeds(
      setDoc(
        doc(alice, 'attendanceRecords', recordId(UID.alice)),
        scanPayload({ method: 'manual_code', signature: MANUAL }),
      ),
    )
  })

  it('🔒 dönen kod belgesi HİÇ KİMSEYE okunmaz — admin dahil', async () => {
    const path = ['attendanceSessions', SESSION, 'codes', 'current'] as const

    for (const [uid, claims] of [
      [UID.alice, CLAIMS.participant],
      [UID.staff, CLAIMS.staff],
      [UID.admin, CLAIMS.admin],
    ] as const) {
      const db = env.authenticatedContext(uid, claims).firestore()
      await assertFails(getDoc(doc(db, ...path)))
    }
  })
})

// ===========================================================================
// item 10 — "istemciden KESİNLİKLE yazılamaz"
// ===========================================================================

describe('istemci sunucu alanlarına yazamaz', () => {
  it('kullanıcı kendi stats alanına dokunamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), {
        stats: { ...ALICE_STATS, ip: 999_999, level: 5 },
      }),
    )
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { 'stats.ip': 999_999 }),
    )
    await assertFails(updateDoc(doc(alice, 'users', UID.alice), { 'stats.level': 5 }))
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { 'stats.hours': 1000 }),
    )
  })

  it('kullanıcı no-show sayacını sıfırlayıp kısıttan kurtulamaz', async () => {
    // Önce gerçekten cezalı hâle getir — aksi hâlde "0'ı 0 yap" bir
    // DEĞİŞİKLİK değil ve kural haklı olarak işlemi boş geçer.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', UID.alice), {
        'stats.consecutiveNoShows': 3,
        'stats.noShows': 3,
        lastNoShowAt: past(86_400_000),
      })
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { 'stats.consecutiveNoShows': 0 }),
    )
    await assertFails(updateDoc(doc(alice, 'users', UID.alice), { 'stats.noShows': 0 }))
    // Kısıtın dayanağı olan damgayı geriye çekmek de yasak.
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), {
        lastNoShowAt: past(99 * 86_400_000),
      }),
    )
  })

  it('kullanıcı kendine pasaport girdisi açamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'passportEntries', `${ACTIVITY}_${UID.alice}`), {
        uid: UID.alice,
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        sessionId: SESSION,
        categoryId: 'environment',
        activityTitle: 'Hasenheide',
        hours: 3,
        ipAwarded: 30,
        skillsGained: [],
        source: 'attendance',
        status: 'completed',
        bonuses: [],
      }),
    )
  })

  it('kullanıcı ledger kaydı yazamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'ledger', 'tx_hack'), {
        uid: UID.alice,
        type: 'ip_award',
        amount: 10_000,
        currency: 'IP',
        refId: 'x',
        orgId: ORG.neukoelln,
        actorUid: UID.alice,
      }),
    )
  })

  it('kullanıcı yoklama kaydını "onaylı" yapamaz veya puanlandı işaretleyemez', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'attendanceRecords', recordId(UID.alice)),
        scanPayload({ status: 'pending_review', method: 'offline_late' }),
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), {
        status: 'confirmed',
      }),
    )
    await assertFails(
      updateDoc(doc(alice, 'attendanceRecords', recordId(UID.alice)), {
        awarded: true,
      }),
    )
  })

  it('kurum, olmayan bir katılım için pasaport girdisi açamaz', async () => {
    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    // Bob'un onaylı yoklama kaydı yok.
    await assertFails(
      setDoc(doc(staff, 'passportEntries', `${ACTIVITY}_${UID.bob}`), {
        uid: UID.bob,
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        sessionId: SESSION,
        categoryId: 'environment',
        activityTitle: 'Hasenheide',
        hours: 3,
        ipAwarded: 30,
        skillsGained: [],
        source: 'attendance',
        status: 'completed',
        bonuses: [],
      }),
    )
  })

  it('kurum ilan ettiğinden FAZLA puan veremez', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'attendanceRecords', recordId(UID.alice)),
        scanPayload(),
      )
    })

    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertFails(
      setDoc(doc(staff, 'passportEntries', `${ACTIVITY}_${UID.alice}`), {
        uid: UID.alice,
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        sessionId: SESSION,
        categoryId: 'environment',
        activityTitle: 'Hasenheide',
        // Aktivite 30 IP ilan ediyor.
        hours: 3,
        ipAwarded: 300,
        skillsGained: [],
        source: 'attendance',
        status: 'completed',
        bonuses: [],
      }),
    )
  })

  it('başka kurumun personeli bu aktiviteye puan yazamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'attendanceRecords', recordId(UID.alice)),
        scanPayload(),
      )
    })

    const partner = env.authenticatedContext(UID.partner, CLAIMS.partner).firestore()
    await assertFails(
      setDoc(doc(partner, 'passportEntries', `${ACTIVITY}_${UID.alice}`), {
        uid: UID.alice,
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        sessionId: SESSION,
        categoryId: 'environment',
        activityTitle: 'Hasenheide',
        hours: 3,
        ipAwarded: 30,
        skillsGained: [],
        source: 'attendance',
        status: 'completed',
        bonuses: [],
      }),
    )
  })

  it('pasaport girdisi bir kez yazılır, sonra DEĞİŞTİRİLEMEZ', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'passportEntries', `${ACTIVITY}_${UID.alice}`),
        {
          uid: UID.alice,
          activityId: ACTIVITY,
          orgId: ORG.neukoelln,
          ipAwarded: 30,
          hours: 3,
          status: 'completed',
        },
      )
    })

    const staff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertFails(
      updateDoc(doc(staff, 'passportEntries', `${ACTIVITY}_${UID.alice}`), {
        ipAwarded: 500,
      }),
    )
  })
})

// ===========================================================================
// Nachtrag ve no-show kısıtı
// ===========================================================================

describe('katılım nachtrağı ve no-show kısıtı', () => {
  it('kullanıcı bitmiş aktivite için iddia açabilir, başkası adına açamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    await assertSucceeds(
      setDoc(doc(alice, 'pendingClaims', `${ACTIVITY}_${UID.alice}`), {
        uid: UID.alice,
        displayName: 'Alice',
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        activityTitle: 'Hasenheide',
        note: 'Telefonum bitmişti',
        photoDataUrl: 'data:image/jpeg;base64,AAAA',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
      }),
    )

    await assertFails(
      setDoc(doc(alice, 'pendingClaims', `${ACTIVITY}_${UID.bob}`), {
        uid: UID.bob,
        displayName: 'Bob',
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        activityTitle: 'Hasenheide',
        note: '',
        photoDataUrl: 'data:image/jpeg;base64,AAAA',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
      }),
    )
  })

  it('kullanıcı kendi iddiasını onaylayamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pendingClaims', `${ACTIVITY}_${UID.alice}`), {
        uid: UID.alice,
        activityId: ACTIVITY,
        orgId: ORG.neukoelln,
        status: 'pending',
      })
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'pendingClaims', `${ACTIVITY}_${UID.alice}`), {
        status: 'approved',
        reviewedBy: UID.alice,
        reviewedAt: Timestamp.now(),
        reviewNote: '',
      }),
    )
  })

  it('3 ardışık no-show sonrası başvuru KAPANIR, 14 gün sonra açılır', async () => {
    const OTHER = 'act_future'

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'activities', OTHER), {
        orgId: ORG.neukoelln,
        orgName: 'Neukölln',
        status: 'published',
        title: { de: 'Yeni', en: 'New' },
        categoryId: 'community',
        capacity: 10,
        requiresApplication: true,
        startAt: future(7 * 86_400_000),
        endAt: future(7 * 86_400_000 + 3_600_000),
        applicationDeadline: null,
        rewards: { ip: 10 },
        hoursCredited: 2,
        minLevel: 0,
        stats: { applicants: 0, attendees: 0 },
      })

      await setDoc(doc(db, 'users', UID.alice), {
        displayName: 'Alice',
        email: 'alice@example.de',
        stats: { ...ALICE_STATS, noShows: 3, consecutiveNoShows: 3 },
        lastNoShowAt: past(86_400_000), // dün
      })
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    const application = {
      uid: UID.alice,
      activityId: OTHER,
      orgId: ORG.neukoelln,
      status: 'applied',
      message: '',
      applicantName: 'Alice',
      applicantLanguages: ['de'],
      activityTitle: { de: 'Yeni', en: 'New' },
      activityStartAt: future(7 * 86_400_000),
      appliedAt: Timestamp.now(),
      decidedAt: null,
      decidedBy: null,
      decisionNote: '',
      withdrawnAt: null,
      attended: false,
    }

    await assertFails(
      setDoc(doc(alice, 'activities', OTHER, 'applicants', UID.alice), application),
    )

    // 15 gün geçmişse kısıt kalkar.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', UID.alice), {
        lastNoShowAt: past(15 * 86_400_000),
      })
    })

    await assertSucceeds(
      setDoc(doc(alice, 'activities', OTHER, 'applicants', UID.alice), application),
    )
  })
})
