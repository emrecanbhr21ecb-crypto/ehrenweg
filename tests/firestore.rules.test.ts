/**
 * Firestore güvenlik kuralları testleri (CLAUDE.md Bölüm 14 — ZORUNLU).
 *
 * Buradaki her test bir SALDIRI senaryosudur: "kötü niyetli bir istemci
 * doğrudan Firestore'a yazarak şunu yapabilir mi?" Cevap her zaman hayır
 * olmalı. Yeni koleksiyon eklendiğinde buraya da test eklenir.
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await createTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()

  // Kuralları atlayarak başlangıç verisini yaz (gerçek hayatta sunucu yazar).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    await setDoc(doc(db, 'users', UID.alice), {
      displayName: 'Alice',
      locale: 'de',
      city: 'Berlin',
      stats: { ip: 100, hours: 10, activitiesCompleted: 3, level: 2 },
      trainerStatus: 'none',
    })

    await setDoc(doc(db, 'users', UID.bob), {
      displayName: 'Bob',
      locale: 'en',
      stats: { ip: 0, hours: 0, activitiesCompleted: 0, level: 1 },
    })

    await setDoc(doc(db, 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      type: 'municipality',
      verified: true,
      features: { cashVouchers: false },
    })

    await setDoc(doc(db, 'organizations', 'org_unverified'), {
      name: 'Noch nicht geprüft e.V.',
      type: 'ngo',
      verified: false,
    })

    await setDoc(doc(db, 'activities', 'act_published'), {
      orgId: ORG.neukoelln,
      status: 'published',
      type: 'volunteering',
      title: { de: 'Hasenheide aufräumen', en: 'Clean up Hasenheide' },
      categoryId: 'environment',
    })

    await setDoc(doc(db, 'activities', 'act_draft'), {
      orgId: ORG.neukoelln,
      status: 'draft',
      type: 'volunteering',
      title: { de: 'Entwurf', en: 'Draft' },
      categoryId: 'environment',
    })

    await setDoc(doc(db, 'attendanceSessions', 'sess_1'), {
      activityId: 'act_published',
      orgId: ORG.neukoelln,
      active: true,
      rotationSeconds: 30,
    })

    await setDoc(doc(db, 'attendanceSessions', 'sess_1', 'codes', 'code_1'), {
      code: 'GEHEIM-123',
      expiresAt: new Date(Date.now() + 30_000),
    })

    await setDoc(doc(db, 'passportEntries', 'entry_1'), {
      uid: UID.alice,
      activityId: 'act_published',
      orgId: ORG.neukoelln,
      hours: 3,
      ipAwarded: 30,
      status: 'completed',
    })

    await setDoc(doc(db, 'vouchers', 'vch_1'), {
      uid: UID.alice,
      orgId: ORG.neukoelln,
      kind: 'gift_voucher',
      valueCents: 1000,
      status: 'issued',
    })

    await setDoc(doc(db, 'ledger', 'tx_1'), {
      uid: UID.alice,
      orgId: ORG.neukoelln,
      type: 'ip_award',
      amount: 30,
      currency: 'IP',
    })

    await setDoc(doc(db, 'auditLog', 'log_1'), {
      action: 'voucher.issued',
      actorUid: UID.staff,
    })

    await setDoc(doc(db, 'config', 'scoring'), { version: 1, ipPerHour: 10 })
  })
})

// ---------------------------------------------------------------------------

describe('users — profil', () => {
  it('kullanıcı kendi profilini okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'users', UID.alice)))
  })

  it('kullanıcı BAŞKASININ profilini okuyamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'users', UID.bob)))
  })

  it('platform admin herkesin profilini okur', async () => {
    const db = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertSucceeds(getDoc(doc(db, 'users', UID.alice)))
  })

  it('giriş yapmamış kimse profil okuyamaz', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users', UID.alice)))
  })

  it('kullanıcı izin verilen alanlarını güncelleyebilir', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', UID.alice), {
        displayName: 'Alice A.',
        bio: 'Hallo!',
        city: 'Berlin',
      }),
    )
  })

  it('🔒 kullanıcı KENDİ PUANINI artıramaz (stats sunucu alanı)', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(db, 'users', UID.alice), {
        stats: { ip: 999_999, hours: 999, activitiesCompleted: 99, level: 5 },
      }),
    )
  })

  it('🔒 kullanıcı kendini eğitmen yapamaz (trainerStatus sunucu alanı)', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(db, 'users', UID.alice), { trainerStatus: 'approved' }),
    )
  })

  it('🔒 izinli alanla birlikte yasaklı alan göndermek de reddedilir', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(db, 'users', UID.alice), {
        displayName: 'Alice',
        stats: { ip: 999_999 },
      }),
    )
  })

  it('🔒 kullanıcı başkasının profilini güncelleyemez', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(updateDoc(doc(db, 'users', UID.bob), { displayName: 'Gehackt' }))
  })

  it('🔒 kullanıcı kendine şişirilmiş puanla profil oluşturamaz', async () => {
    const db = env.authenticatedContext('uid_neu', CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'uid_neu'), {
        displayName: 'Neu',
        stats: { ip: 5000 },
      }),
    )
  })
})

/**
 * Kayıt akışı — profil belgesini istemci oluşturuyor (DECISIONS.md §6, Blaze
 * olmadığı için Cloud Functions devre dışı). Bu blok o kapının yalnızca
 * "temiz" bir belgeye açıldığını kanıtlar.
 */
describe('users — kayıtta profil oluşturma (istemci)', () => {
  const NEW_UID = 'uid_neu'

  /** authService + userProfile'ın gönderdiği belgenin birebir aynısı. */
  function freshProfile(overrides: Record<string, unknown> = {}) {
    return {
      displayName: 'Neu Benutzer',
      bio: '',
      city: '',
      locale: 'de',
      interests: [],
      skills: [],
      languages: [],
      photoURL: null,
      email: 'alice@example.de',
      countryCode: 'DE',
      roleDisplay: 'participant',
      stats: {
        ip: 0,
        hours: 0,
        activitiesCompleted: 0,
        noShows: 0,
        categoriesCount: 0,
        level: 1,
      },
      trainerStatus: 'none',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      ...overrides,
    }
  }

  it('temiz bir profil oluşturabilir', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertSucceeds(setDoc(doc(db, 'users', NEW_UID), freshProfile()))
  })

  it('🔒 başlangıç puanı sıfırdan farklı olamaz', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', NEW_UID),
        freshProfile({
          stats: {
            ip: 9999,
            hours: 0,
            activitiesCompleted: 0,
            noShows: 0,
            categoriesCount: 0,
            level: 1,
          },
        }),
      ),
    )
  })

  it('🔒 kendini baştan 5. seviye yapamaz', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', NEW_UID),
        freshProfile({
          stats: {
            ip: 0,
            hours: 0,
            activitiesCompleted: 0,
            noShows: 0,
            categoriesCount: 0,
            level: 5,
          },
        }),
      ),
    )
  })

  it('🔒 kendini onaylı eğitmen olarak oluşturamaz', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'users', NEW_UID), freshProfile({ trainerStatus: 'approved' })),
    )
  })

  it('🔒 kendini admin olarak etiketleyemez', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', NEW_UID),
        freshProfile({ roleDisplay: 'platform_admin' }),
      ),
    )
  })

  it('🔒 kendini bir kuruma üye olarak oluşturamaz', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'users', NEW_UID), freshProfile({ orgId: ORG.neukoelln })),
    )
  })

  it('🔒 başkasının e-postasıyla profil oluşturamaz', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', NEW_UID),
        freshProfile({ email: 'chef@bezirksamt-neukoelln.de' }),
      ),
    )
  })

  it('🔒 şemada olmayan alan ekleyemez', async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'users', NEW_UID), freshProfile({ isAdmin: true })),
    )
  })

  it("🔒 başkasının uid'si için profil oluşturamaz", async () => {
    const db = env.authenticatedContext(NEW_UID, CLAIMS.participant).firestore()
    await assertFails(setDoc(doc(db, 'users', 'uid_fremd'), freshProfile()))
  })

  it('🔒 giriş yapmamış biri profil oluşturamaz', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'users', NEW_UID), freshProfile()))
  })
})

describe('users/private + applications', () => {
  it('kendi özel ayarlarını yazabilir', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'users', UID.alice, 'private', 'settings'), {
        pushEnabled: true,
      }),
    )
  })

  it('🔒 başkasının özel ayarlarını okuyamaz', async () => {
    const db = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'users', UID.alice, 'private', 'settings')))
  })

  it('🔒 başvuruyu doğrudan yazamaz (applyToActivity onCall gerekli)', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'users', UID.alice, 'applications', 'act_published'), {
        status: 'accepted',
        attended: true,
      }),
    )
  })
})

describe('organizations', () => {
  it('doğrulanmış kurumu herkes görür', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', ORG.neukoelln)))
  })

  it('🔒 doğrulanmamış kurumu sıradan kullanıcı göremez', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'org_unverified')))
  })

  it('🔒 kullanıcı kendini kuruma üye yapamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', ORG.neukoelln, 'members', UID.alice), {
        role: 'org_admin',
      }),
    )
  })

  it('🔒 kurum kendi bütçesini doğrudan artıramaz', async () => {
    const db = env.authenticatedContext(UID.orgAdmin, CLAIMS.orgAdmin).firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', ORG.neukoelln), {
        budget: { currency: 'EUR', allocated: 1_000_000, spent: 0 },
      }),
    )
  })
})

describe('activities', () => {
  it('yayınlanmış aktiviteyi giriş yapan herkes okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'activities', 'act_published')))
  })

  it('🔒 taslağı sıradan kullanıcı okuyamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'activities', 'act_draft')))
  })

  it('kurum personeli kendi taslağını okur', async () => {
    const db = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertSucceeds(getDoc(doc(db, 'activities', 'act_draft')))
  })

  it('🔒 kurum personeli bile aktiviteyi doğrudan yazamaz (submitActivity gerekli)', async () => {
    const db = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    await assertFails(
      updateDoc(doc(db, 'activities', 'act_draft'), { status: 'published' }),
    )
  })

  it('🔒 kullanıcı kendine 9999 IP veren aktivite yaratamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'activities', 'act_hack'), {
        orgId: ORG.neukoelln,
        status: 'published',
        rewards: { ip: 9999 },
      }),
    )
  })
})

describe('attendanceSessions — yoklama', () => {
  it('🔒🔒 DÖNEN QR KODU HİÇ KİMSE OKUYAMAZ (en kritik kural)', async () => {
    // Kod okunabilseydi etkinliğe gitmeden yoklama verilebilirdi.
    const asParticipant = env
      .authenticatedContext(UID.alice, CLAIMS.participant)
      .firestore()
    const asStaff = env.authenticatedContext(UID.staff, CLAIMS.staff).firestore()
    const asAdmin = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()

    const path = ['attendanceSessions', 'sess_1', 'codes', 'code_1'] as const
    await assertFails(getDoc(doc(asParticipant, ...path)))
    await assertFails(getDoc(doc(asStaff, ...path)))
    await assertFails(getDoc(doc(asAdmin, ...path)))
  })

  it('🔒 kullanıcı yoklama oturumu başlatamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'attendanceSessions', 'sess_hack'), {
        activityId: 'act_published',
        orgId: ORG.neukoelln,
        active: true,
      }),
    )
  })

  it('🔒 kullanıcı kendine yoklama kaydı yazamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'attendanceRecords', `sess_1_${UID.alice}`), {
        uid: UID.alice,
        activityId: 'act_published',
        sessionId: 'sess_1',
        status: 'confirmed',
      }),
    )
  })
})

describe('passportEntries — Integrationspass', () => {
  it('kendi pasaport girdisini okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'passportEntries', 'entry_1')))
  })

  it('🔒 başkasının pasaport girdisini okuyamaz', async () => {
    const db = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'passportEntries', 'entry_1')))
  })

  it('🔒 kullanıcı kendine pasaport girdisi UYDURAMAZ', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'passportEntries', 'entry_hack'), {
        uid: UID.alice,
        activityId: 'act_published',
        orgId: ORG.neukoelln,
        hours: 500,
        ipAwarded: 5000,
        status: 'completed',
      }),
    )
  })

  it('🔒 mevcut girdinin saatini artıramaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(updateDoc(doc(db, 'passportEntries', 'entry_1'), { hours: 99 }))
  })
})

describe('pendingClaims — "katıldım" iddiası', () => {
  // ⚠️ Faz 3'te kural sıkılaştı: belge kimliği `{activityId}_{uid}` olmak
  // zorunda, `orgId` aktivitenin kurumuyla eşleşmeli, aktivite BİTMİŞ olmalı
  // ve kanıt fotoğrafı belgede (Storage yok — docs/DECISIONS.md §7).
  // Ayrıntılı senaryolar tests/attendance.rules.test.ts içinde.
  it('doğrulanmış kullanıcı bitmiş aktivite için kendi iddiasını oluşturabilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'activities', 'act_finished'), {
        orgId: ORG.neukoelln,
        status: 'completed',
        title: { de: 'Biten', en: 'Finished' },
        categoryId: 'environment',
        startAt: new Date(Date.now() - 7_200_000),
        endAt: new Date(Date.now() - 3_600_000),
        rewards: { ip: 10 },
        hoursCredited: 2,
        stats: { applicants: 0, attendees: 0 },
      })
    })

    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'pendingClaims', `act_finished_${UID.alice}`), {
        uid: UID.alice,
        displayName: 'Alice',
        activityId: 'act_finished',
        orgId: ORG.neukoelln,
        activityTitle: 'Biten',
        note: '',
        photoDataUrl: 'data:image/jpeg;base64,AAAA',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
      }),
    )
  })

  it('🔒 aktivite BİTMEDEN iddia açılamaz (önce git, yoklama ver)', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'pendingClaims', `act_published_${UID.alice}`), {
        uid: UID.alice,
        displayName: 'Alice',
        activityId: 'act_published',
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

  it('🔒 e-postası doğrulanmamış kullanıcı iddia oluşturamaz', async () => {
    const db = env
      .authenticatedContext(UID.alice, CLAIMS.participantUnverified)
      .firestore()
    await assertFails(
      setDoc(doc(db, 'pendingClaims', 'claim_2'), {
        uid: UID.alice,
        activityId: 'act_published',
        status: 'pending',
      }),
    )
  })

  it('🔒 iddiayı doğrudan "onaylandı" olarak oluşturamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'pendingClaims', 'claim_3'), {
        uid: UID.alice,
        activityId: 'act_published',
        status: 'approved',
      }),
    )
  })

  it('🔒 başkası adına iddia oluşturamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'pendingClaims', 'claim_4'), {
        uid: UID.bob,
        activityId: 'act_published',
        status: 'pending',
      }),
    )
  })
})

describe('vouchers + ledger — para 💶', () => {
  it('kendi kuponunu okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'vouchers', 'vch_1')))
  })

  it('🔒 başkasının kuponunu okuyamaz', async () => {
    const db = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'vouchers', 'vch_1')))
  })

  it('🔒 KULLANICI KENDİNE KUPON BASAMAZ', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'vouchers', 'vch_hack'), {
        uid: UID.alice,
        orgId: ORG.neukoelln,
        kind: 'cash_voucher',
        valueCents: 50_000,
        status: 'issued',
      }),
    )
  })

  it('🔒 kullanılmış kuponu "issued"a geri çeviremez', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(updateDoc(doc(db, 'vouchers', 'vch_1'), { status: 'issued' }))
  })

  it('🔒 vezne görevlisi bile kuponu doğrudan işaretleyemez (redeemVoucher gerekli)', async () => {
    const db = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()
    await assertFails(updateDoc(doc(db, 'vouchers', 'vch_1'), { status: 'redeemed' }))
  })

  it('kendi ledger satırını okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'ledger', 'tx_1')))
  })

  it('🔒 LEDGER SATIRI EKLENEMEZ', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(db, 'ledger', 'tx_hack'), {
        uid: UID.alice,
        type: 'ip_award',
        amount: 100_000,
        currency: 'IP',
      }),
    )
  })

  it('🔒 LEDGER SATIRI DEĞİŞTİRİLEMEZ (defter değişmezdir)', async () => {
    const db = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertFails(updateDoc(doc(db, 'ledger', 'tx_1'), { amount: 0 }))
  })
})

describe('auditLog + config', () => {
  it('admin denetim kaydını okur', async () => {
    const db = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertSucceeds(getDoc(doc(db, 'auditLog', 'log_1')))
  })

  it('🔒 sıradan kullanıcı denetim kaydını okuyamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'auditLog', 'log_1')))
  })

  it('🔒 denetim kaydı silinemez/değiştirilemez', async () => {
    const db = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertFails(updateDoc(doc(db, 'auditLog', 'log_1'), { action: 'nichts' }))
  })

  it('puan kurallarını herkes okur', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(getDoc(doc(db, 'config', 'scoring')))
  })

  it('🔒 kullanıcı puan kurallarını değiştiremez', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(updateDoc(doc(db, 'config', 'scoring'), { ipPerHour: 10_000 }))
  })
})

describe('bilinmeyen koleksiyonlar', () => {
  it('🔒 kurallarda tanımsız koleksiyona yazılamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(setDoc(doc(db, 'was_auch_immer', 'x'), { a: 1 }))
  })

  it('🔒 kurallarda tanımsız koleksiyon okunamaz', async () => {
    const db = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(getDoc(doc(db, 'was_auch_immer', 'x')))
  })
})

describe('sağlık kontrolü', () => {
  it('test ortamı ayakta', () => {
    expect(env).toBeDefined()
  })
})
