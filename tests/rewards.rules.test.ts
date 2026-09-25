/**
 * Faz 4 güvenlik kuralı testleri — CLAUDE.md Bölüm 7, prompt item 8:
 * "Testler (bunlar olmadan faz bitmez): bütçe aşımı, eşzamanlı iki buyReward
 *  çağrısı, süresi geçmiş QR, ekran görüntüsüyle ikinci kullanım, başka
 *  kurumun kuponunu okutma, istemciden ledger'a yazma girişimi."
 *
 * Bu faz gerçek para içeriyor. Kupon basımını, bütçeyi ve defteri koruyan
 * tek katman `firestore.rules` (Blaze kapalı — docs/DECISIONS.md §10), yani
 * bu dosya "para güvende mi" sorusunun tek cevabı.
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CLAIMS, createTestEnv, ORG, UID } from './helpers'

let env: RulesTestEnvironment

const TEMPLATE = 'tpl_gift'
const VOUCHER = 'vch_alice'
const NONCE = 'LIVE-VOUCHER-NONCE-0001'

/** Şablon: 10 € değerinde, 100 IP, toplam bütçe 25 € (yani 2 kupon + artık). */
const VALUE_CENTS = 1000
const COST_IP = 100
const BUDGET_CENTS = 2500

const ALICE_STATS = {
  ip: 500,
  hours: 10,
  activitiesCompleted: 3,
  noShows: 0,
  categoriesCount: 1,
  level: 2,
  consecutiveNoShows: 0,
}

const future = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() + ms)
const past = (ms: number): Timestamp => Timestamp.fromMillis(Date.now() - ms)

function voucherPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    uid: UID.alice,
    templateId: TEMPLATE,
    orgId: ORG.neukoelln,
    kind: 'gift_voucher',
    title: { de: 'Gutschein', en: 'Voucher' },
    valueCents: VALUE_CENTS,
    discountPercent: 0,
    partnerOrgId: null,
    costIp: COST_IP,
    status: 'issued',
    issuedAt: serverTimestamp(),
    expiresAt: future(30 * 86_400_000),
    redeemedAt: null,
    redeemedBy: null,
    redemptionOrgId: null,
    holderName: 'Alice',
    holderPhotoURL: null,
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
      stats: ALICE_STATS,
    })
    await setDoc(doc(db, 'users', UID.bob), {
      displayName: 'Bob',
      email: 'bob@example.de',
      stats: { ...ALICE_STATS, ip: 10 },
    })

    await setDoc(doc(db, 'organizations', ORG.neukoelln), {
      name: 'Bezirksamt Berlin-Neukölln',
      verified: true,
      status: 'approved',
      // Parasal kupon KAPALI — Bölüm 7.6 varsayılanı.
      features: { cashVouchers: false },
    })
    await setDoc(doc(db, 'organizations', ORG.cafe), {
      name: 'Café Mosaik',
      verified: true,
      status: 'approved',
      features: { cashVouchers: false },
    })

    await setDoc(doc(db, 'rewardTemplates', TEMPLATE), {
      orgId: ORG.neukoelln,
      kind: 'gift_voucher',
      title: { de: 'Gutschein', en: 'Voucher' },
      description: { de: '', en: '' },
      valueCents: VALUE_CENTS,
      discountPercent: 0,
      partnerOrgId: null,
      costIp: COST_IP,
      validityDays: 90,
      totalBudgetCents: BUDGET_CENTS,
      spentCents: 0,
      issuedCount: 0,
      maxPerUserPerMonth: 1,
      active: true,
      createdBy: UID.orgAdmin,
    })
  })
})

/** Bir alımın tamamı — kural bunların HEPSİNİ birlikte istiyor. */
function buyBatch(
  db: ReturnType<
    RulesTestEnvironment['authenticatedContext']
  >['firestore'] extends () => infer T
    ? T
    : never,
  options: { voucherId?: string; spentCents?: number; issuedCount?: number } = {},
) {
  const voucherId = options.voucherId ?? VOUCHER
  const batch = writeBatch(db)

  batch.set(doc(db, 'vouchers', voucherId), voucherPayload())
  batch.update(doc(db, 'rewardTemplates', TEMPLATE), {
    issuedCount: (options.issuedCount ?? 0) + 1,
    spentCents: (options.spentCents ?? 0) + VALUE_CENTS,
    lastVoucherId: voucherId,
  })
  batch.set(doc(db, 'rewardTemplates', TEMPLATE, 'holders', UID.alice), {
    uid: UID.alice,
    count: 1,
    periodStart: serverTimestamp(),
  })
  batch.update(doc(db, 'users', UID.alice), {
    'stats.ip': ALICE_STATS.ip - COST_IP,
    lastSpendId: voucherId,
  })
  batch.set(doc(db, 'ledger', `${voucherId}_spend`), {
    uid: UID.alice,
    type: 'ip_spend',
    amount: -COST_IP,
    currency: 'IP',
    refId: voucherId,
    orgId: ORG.neukoelln,
    actorUid: UID.alice,
    reason: 'reward_purchase',
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'ledger', `${voucherId}_issue`), {
    uid: UID.alice,
    type: 'voucher_issue',
    amount: VALUE_CENTS,
    currency: 'EUR',
    refId: voucherId,
    orgId: ORG.neukoelln,
    actorUid: UID.alice,
    reason: 'reward_purchase',
    createdAt: serverTimestamp(),
  })

  return batch
}

// ===========================================================================
// Ödül alma ve bütçe
// ===========================================================================

describe('ödül alma', () => {
  it('kurallara uyan alım kabul edilir', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(buyBatch(alice).commit())
  })

  it('🔒 BÜTÇE AŞILAMAZ', async () => {
    // Bütçenin tamamı bağlanmış olsun.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'rewardTemplates', TEMPLATE), {
        spentCents: BUDGET_CENTS,
        issuedCount: 2,
      })
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      buyBatch(alice, { spentCents: BUDGET_CENTS, issuedCount: 2 }).commit(),
    )
  })

  it('🔒 EŞZAMANLI iki alımda ikincisi düşer (bütçe son kuponu koruyor)', async () => {
    // Bütçede tek kupon kaldı.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'rewardTemplates', TEMPLATE), {
        spentCents: BUDGET_CENTS - VALUE_CENTS,
        issuedCount: 1,
      })
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    const base = BUDGET_CENTS - VALUE_CENTS

    // Birinci alım son kuponu kapar.
    await assertSucceeds(
      buyBatch(alice, {
        voucherId: 'vch_1',
        spentCents: base,
        issuedCount: 1,
      }).commit(),
    )

    // İkinci alım AYNI eski sayaç değerini kullanıyor — tıpkı eşzamanlı iki
    // istemcinin yapacağı gibi. Kural commit anındaki gerçek değere bakıyor
    // ve bu yazmayı reddediyor.
    await assertFails(
      buyBatch(alice, {
        voucherId: 'vch_2',
        spentCents: base,
        issuedCount: 1,
      }).commit(),
    )
  })

  it('🔒 IP düşmeden kupon basılamaz (bedava ödül yok)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    const batch = writeBatch(alice)

    batch.set(doc(alice, 'vouchers', VOUCHER), voucherPayload())
    batch.update(doc(alice, 'rewardTemplates', TEMPLATE), {
      issuedCount: 1,
      spentCents: VALUE_CENTS,
      lastVoucherId: VOUCHER,
    })
    // users güncellemesi YOK → IP düşmüyor.
    await assertFails(batch.commit())
  })

  it('🔒 şablondan FAZLA değerli kupon basılamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    const batch = writeBatch(alice)

    batch.set(
      doc(alice, 'vouchers', VOUCHER),
      voucherPayload({ valueCents: 50_000, costIp: COST_IP }),
    )
    batch.update(doc(alice, 'rewardTemplates', TEMPLATE), {
      issuedCount: 1,
      spentCents: VALUE_CENTS,
      lastVoucherId: VOUCHER,
    })
    await assertFails(batch.commit())
  })

  it('🔒 kullanıcı IP bakiyesini kendi artıramaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      updateDoc(doc(alice, 'users', UID.alice), { 'stats.ip': ALICE_STATS.ip + 5000 }),
    )
  })

  it('🔒 aylık sınır aşılamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'rewardTemplates', TEMPLATE, 'holders', UID.alice),
        { uid: UID.alice, count: 1, periodStart: past(86_400_000) },
      )
    })

    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    // maxPerUserPerMonth = 1 ve dönem sürüyor → ikinci alım yasak.
    await assertFails(
      updateDoc(doc(alice, 'rewardTemplates', TEMPLATE, 'holders', UID.alice), {
        count: 2,
      }),
    )
  })
})

// ===========================================================================
// Parasal kupon — Bölüm 7.6 / Bölüm 10
// ===========================================================================

describe('parasal kupon kilidi', () => {
  it('🔒 kurum, cashVouchers kapalıyken cash_voucher şablonu açamaz', async () => {
    const orgAdmin = env.authenticatedContext(UID.orgAdmin, CLAIMS.orgAdmin).firestore()
    await assertFails(
      setDoc(doc(orgAdmin, 'rewardTemplates', 'tpl_cash'), {
        orgId: ORG.neukoelln,
        kind: 'cash_voucher',
        title: { de: 'Bar', en: 'Cash' },
        description: { de: '', en: '' },
        valueCents: 5000,
        discountPercent: 0,
        partnerOrgId: null,
        costIp: 500,
        validityDays: 90,
        totalBudgetCents: 100_000,
        spentCents: 0,
        issuedCount: 0,
        maxPerUserPerMonth: 1,
        active: true,
        createdBy: UID.orgAdmin,
      }),
    )
  })

  it('🔒 kurum kendi kurumunda cashVouchers bayrağını AÇAMAZ', async () => {
    const orgAdmin = env.authenticatedContext(UID.orgAdmin, CLAIMS.orgAdmin).firestore()
    await assertFails(
      updateDoc(doc(orgAdmin, 'organizations', ORG.neukoelln), {
        features: { cashVouchers: true },
      }),
    )
  })

  it('platform admin açınca cash_voucher şablonu açılabilir', async () => {
    const admin = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertSucceeds(
      updateDoc(doc(admin, 'organizations', ORG.neukoelln), {
        features: { cashVouchers: true },
        verified: true,
        status: 'approved',
        reviewedBy: UID.admin,
        reviewedAt: serverTimestamp(),
        reviewNote: 'hukuki onay alindi',
      }),
    )

    const orgAdmin = env.authenticatedContext(UID.orgAdmin, CLAIMS.orgAdmin).firestore()
    await assertSucceeds(
      setDoc(doc(orgAdmin, 'rewardTemplates', 'tpl_cash'), {
        orgId: ORG.neukoelln,
        kind: 'cash_voucher',
        title: { de: 'Bar', en: 'Cash' },
        description: { de: '', en: '' },
        valueCents: 5000,
        discountPercent: 0,
        partnerOrgId: null,
        costIp: 500,
        validityDays: 90,
        totalBudgetCents: 100_000,
        spentCents: 0,
        issuedCount: 0,
        maxPerUserPerMonth: 1,
        active: true,
        createdBy: UID.orgAdmin,
      }),
    )
  })
})

// ===========================================================================
// Kullanım (redemption)
// ===========================================================================

describe('kupon kullanımı', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'vouchers', VOUCHER), voucherPayload())
      await setDoc(doc(db, 'vouchers', VOUCHER, 'qr', 'current'), {
        nonce: NONCE,
        expiresAt: future(60_000),
      })
    })
  })

  function redeem(
    db: ReturnType<typeof env.authenticatedContext>['firestore'] extends () => infer T
      ? T
      : never,
    nonce: string,
  ) {
    return updateDoc(doc(db, 'vouchers', VOUCHER), {
      status: 'redeemed',
      redeemedAt: serverTimestamp(),
      redeemedBy: UID.cashier,
      redemptionOrgId: ORG.neukoelln,
      presentedNonce: nonce,
    })
  }

  it('vezne geçerli token ile kuponu kullanabilir', async () => {
    const cashier = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()
    await assertSucceeds(redeem(cashier, NONCE))
  })

  it('🔒 SÜRESİ GEÇMİŞ QR reddedilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vouchers', VOUCHER, 'qr', 'current'), {
        nonce: NONCE,
        expiresAt: past(1000),
      })
    })

    const cashier = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()
    await assertFails(redeem(cashier, NONCE))
  })

  it('🔒 EKRAN GÖRÜNTÜSÜ ile ikinci kullanım reddedilir', async () => {
    const cashier = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()

    // Birinci kullanım geçerli.
    await assertSucceeds(redeem(cashier, NONCE))

    // Aynı QR tekrar okutuluyor — kupon artık 'redeemed'.
    await assertFails(redeem(cashier, NONCE))
  })

  it('🔒 YANLIŞ nonce reddedilir', async () => {
    const cashier = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()
    await assertFails(redeem(cashier, 'UYDURMA-NONCE-000000000'))
  })

  it('🔒 BAŞKA KURUMUN veznesi bu kuponu okutamaz', async () => {
    const partner = env.authenticatedContext(UID.partner, CLAIMS.partner).firestore()
    await assertFails(redeem(partner, NONCE))
  })

  it('🔒 kuponun sahibi kendi kuponunu "kullanıldı" yapamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(redeem(alice, NONCE))
  })

  it('🔒 token belgesi HİÇ KİMSEYE okunmaz — vezne ve admin dahil', async () => {
    for (const [uid, claims] of [
      [UID.alice, CLAIMS.participant],
      [UID.cashier, CLAIMS.cashier],
      [UID.admin, CLAIMS.admin],
    ] as const) {
      const db = env.authenticatedContext(uid, claims).firestore()
      await assertFails(getDoc(doc(db, 'vouchers', VOUCHER, 'qr', 'current')))
    }
  })

  it("🔒 başkası kuponun token'ını yenileyemez", async () => {
    const bob = env.authenticatedContext(UID.bob, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(bob, 'vouchers', VOUCHER, 'qr', 'current'), {
        nonce: 'BOBUN-UYDURDUGU-NONCE-1',
        expiresAt: future(60_000),
      }),
    )
  })

  it('🔒 sahibi UZUN ÖMÜRLÜ token üretemez (ekran görüntüsü yaşamasın)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()

    await assertSucceeds(
      setDoc(doc(alice, 'vouchers', VOUCHER, 'qr', 'current'), {
        nonce: 'YENI-GECERLI-NONCE-0001',
        expiresAt: future(55_000),
      }),
    )

    // Bir saatlik token — reddedilmeli.
    await assertFails(
      setDoc(doc(alice, 'vouchers', VOUCHER, 'qr', 'current'), {
        nonce: 'COK-UZUN-OMURLU-NONCE-1',
        expiresAt: future(3_600_000),
      }),
    )
  })

  it('🔒 süresi dolmuş kupon kullanılamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'vouchers', VOUCHER), {
        expiresAt: past(86_400_000),
      })
    })

    const cashier = env.authenticatedContext(UID.cashier, CLAIMS.cashier).firestore()
    await assertFails(redeem(cashier, NONCE))
  })
})

// ===========================================================================
// Defter — Bölüm 7.3
// ===========================================================================

describe('defter değişmez', () => {
  it('🔒 istemci kendi başına ledger kaydı yazamaz', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertFails(
      setDoc(doc(alice, 'ledger', 'tx_hack'), {
        uid: UID.alice,
        type: 'ip_award',
        amount: 99_999,
        currency: 'IP',
        refId: 'yok',
        orgId: ORG.neukoelln,
        actorUid: UID.alice,
        reason: 'hack',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('🔒 var olan defter kaydı DEĞİŞTİRİLEMEZ ve SİLİNEMEZ', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'ledger', 'tx_1'), {
        uid: UID.alice,
        type: 'ip_award',
        amount: 30,
        currency: 'IP',
        orgId: ORG.neukoelln,
      })
    })

    const admin = env.authenticatedContext(UID.admin, CLAIMS.admin).firestore()
    await assertFails(updateDoc(doc(admin, 'ledger', 'tx_1'), { amount: 9999 }))

    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(admin, 'ledger', 'tx_1')))
  })

  it('defterden bakiye yeniden hesaplanabilir (Bölüm 7.3)', async () => {
    const alice = env.authenticatedContext(UID.alice, CLAIMS.participant).firestore()
    await assertSucceeds(buyBatch(alice).commit())

    await env.withSecurityRulesDisabled(async (ctx) => {
      const spend = await getDoc(doc(ctx.firestore(), 'ledger', `${VOUCHER}_spend`))
      const issue = await getDoc(doc(ctx.firestore(), 'ledger', `${VOUCHER}_issue`))

      // IP hareketi kullanıcının bakiyesini, EUR hareketi kurumun bütçesini
      // besliyor. İkisinin toplamı kuponla birebir örtüşmeli.
      expect(spend.data()?.['amount']).toBe(-COST_IP)
      expect(issue.data()?.['amount']).toBe(VALUE_CENTS)

      const user = await getDoc(doc(ctx.firestore(), 'users', UID.alice))
      expect(user.get('stats.ip')).toBe(ALICE_STATS.ip - COST_IP)
    })
  })
})
