/**
 * Demo hesabı — yatırımcı gösterimi için hazır, doğrulanmış kullanıcı.
 *
 * Neden var: demo APK'sında kayıt/e-posta doğrulama akışı gösterimi
 * bölüyor (ve dev projesinde e-posta sağlayıcısı henüz sorunlu). Bu hesap
 * `VITE_DEMO_AUTOLOGIN` açıkken uygulama tarafından otomatik açılır.
 *
 * ⚠️ YALNIZCA ehrenweg-dev. Üretimde çalıştırma.
 *   npx tsx scripts/demoAccount.ts --project ehrenweg-dev
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv[process.argv.indexOf('--project') + 1]
if (!projectId || false) {
  console.error('✖ --project ehrenweg-dev ver (prod yasak).')
  process.exit(1)
}

initializeApp({ projectId, credential: applicationDefault() })
const auth = getAuth()
const db = getFirestore()

export const DEMO_EMAIL = 'demo@ehrenweg.de'
export const DEMO_PASSWORD = 'EhrenwegDemo2026!'
const ORG = 'seed_org_neukoelln'

async function main(): Promise<void> {
  let uid: string
  try {
    uid = (await auth.getUserByEmail(DEMO_EMAIL)).uid
    await auth.updateUser(uid, { password: DEMO_PASSWORD, emailVerified: true })
    console.log('→ Mevcut demo hesabı güncellendi')
  } catch {
    uid = (
      await auth.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        emailVerified: true,
        displayName: 'Demo Nutzer',
      })
    ).uid
    console.log('→ Demo hesabı oluşturuldu')
  }

  // Her şeyi görebilsin: platform admin + Neukölln kurum yöneticisi.
  await auth.setCustomUserClaims(uid, {
    role: 'platform_admin',
    orgs: { [ORG]: 'org_admin' },
  })

  // Profil TAM olmalı, yoksa uygulama /setup ekranında kilitler.
  await db.doc(`users/${uid}`).set(
    {
      displayName: 'Demo Nutzer',
      bio: 'Demo-Konto für die Vorstellung von Ehrenweg.',
      city: 'Berlin-Neukölln',
      locale: 'de',
      interests: ['environment', 'language_learning', 'community'],
      skills: ['teamwork', 'communication', 'teaching'],
      languages: [
        { code: 'de', level: 'B1' },
        { code: 'en', level: 'C1' },
        { code: 'tr', level: 'native' },
      ],
      photoURL: null,
      email: DEMO_EMAIL,
      countryCode: 'DE',
      roleDisplay: 'participant',
      orgId: ORG,
      stats: {
        ip: 0,
        hours: 0,
        activitiesCompleted: 0,
        noShows: 0,
        categoriesCount: 0,
        level: 1,
      },
      trainerStatus: 'none',
      createdAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp(),
      seed: true,
    },
    { merge: true },
  )

  await db.doc(`organizations/${ORG}/members/${uid}`).set(
    {
      uid,
      orgId: ORG,
      role: 'org_admin',
      displayName: 'Demo Nutzer',
      email: DEMO_EMAIL,
      addedBy: 'seed',
      addedAt: FieldValue.serverTimestamp(),
      seed: true,
    },
    { merge: true },
  )

  console.log(`✔ uid=${uid}  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  console.log('  Roller: platform_admin + Neukölln org_admin')
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
