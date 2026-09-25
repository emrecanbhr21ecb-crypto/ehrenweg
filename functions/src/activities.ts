/**
 * Aktivite akışı — CLAUDE.md Bölüm 12:
 *   submitActivity, reviewActivity, applyToActivity, decideApplication
 *
 * ⚠️ BU FONKSİYONLAR HENÜZ DAĞITILMADI (Blaze kapalı, docs/DECISIONS.md §7).
 * Aynı iş şu an istemcide + `firestore.rules` ile yapılıyor. Kod burada
 * hazır duruyor ki geçiş günü yalnız bir bayrak değişsin:
 *   app/src/lib/backend.ts → CLOUD_FUNCTIONS_ENABLED = true
 *
 * Hata mesajları i18n ANAHTARIDIR ve istemcideki `ApplyFailure` anahtarlarıyla
 * birebir aynıdır — geçiş sonrası arayüzde hiçbir metin değişmez.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'

import { COL, FieldValue, Timestamp, db } from './common/admin'
import { writeAudit } from './common/audit'
import {
  parseInput,
  requireAuth,
  requireOrgRole,
  requirePlatformRole,
  requireVerifiedEmail,
  type AuthedContext,
} from './common/guards'

const APPLICANTS = 'applicants'

const idSchema = z.object({ activityId: z.string().min(1).max(64) })

const reviewSchema = z.object({
  activityId: z.string().min(1).max(64),
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).default(''),
})

const applySchema = z.object({
  activityId: z.string().min(1).max(64),
  message: z.string().max(500).default(''),
})

const decideSchema = z.object({
  activityId: z.string().min(1).max(64),
  applicantUid: z.string().min(1).max(128),
  decision: z.enum(['accept', 'reject']),
  note: z.string().max(300).default(''),
})

function activityRef(activityId: string) {
  return db.collection(COL.activities).doc(activityId)
}

/** Aktiviteyi okur; yoksa 404. Kurum yetkisi çağıran tarafta kontrol edilir. */
async function loadActivity(activityId: string) {
  const snapshot = await activityRef(activityId).get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'errors.notFound')
  return snapshot
}

/** `submitActivity` — taslağı moderasyon kuyruğuna gönderir. */
export const submitActivity = onCall(async (request) => {
  const ctx: AuthedContext = requireAuth(request)
  const input = parseInput(idSchema, request.data)

  const snapshot = await loadActivity(input.activityId)
  const orgId = snapshot.get('orgId') as string
  requireOrgRole(ctx, orgId, 'org_admin', 'org_staff')

  if (snapshot.get('status') !== 'draft') {
    throw new HttpsError('failed-precondition', 'errors.invalidState')
  }

  await activityRef(input.activityId).update({
    status: 'pending_review',
    submittedAt: FieldValue.serverTimestamp(),
    reviewNote: '',
  })

  return { ok: true }
})

/**
 * `reviewActivity` — platform admin yayınlar veya gerekçeyle geri gönderir.
 *
 * Doğrulanmamış kurumun aktivitesi YAYINLANAMAZ (CLAUDE.md Bölüm 4).
 * Reddedilen aktivite silinmez, `draft`'a döner ve `reviewNote` ile kuruma
 * ne düzelteceği söylenir.
 */
export const reviewActivity = onCall(async (request) => {
  const ctx = requireAuth(request)
  requirePlatformRole(ctx, 'platform_admin')
  const input = parseInput(reviewSchema, request.data)

  const snapshot = await loadActivity(input.activityId)
  if (snapshot.get('status') !== 'pending_review') {
    throw new HttpsError('failed-precondition', 'errors.invalidState')
  }

  const approved = input.decision === 'approve'

  if (approved) {
    const orgId = snapshot.get('orgId') as string
    const org = await db.collection(COL.organizations).doc(orgId).get()
    if (org.get('verified') !== true) {
      throw new HttpsError('failed-precondition', 'errors.organisation.notVerified')
    }
  }

  await activityRef(input.activityId).update({
    status: approved ? 'published' : 'draft',
    reviewedBy: ctx.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewNote: input.note,
  })

  await writeAudit({
    action: 'activity.reviewed',
    actorUid: ctx.uid,
    targetId: input.activityId,
    orgId: snapshot.get('orgId') as string,
    reason: input.note,
    meta: { decision: input.decision },
  })

  return { ok: true, published: approved }
})

/**
 * `applyToActivity` — kontenjan ve son başvuru kontrolü **transaction ile**.
 *
 * Transaction şart: iki kişi son kontenjana aynı anda başvurursa, okuma ile
 * yazma arasında kapasite değişmiş olur. Transaction ikinciyi yeniden dener
 * ve doğru sonucu verir.
 */
export const applyToActivity = onCall(async (request) => {
  const ctx = requireAuth(request)
  requireVerifiedEmail(ctx)
  const input = parseInput(applySchema, request.data)

  const userSnapshot = await db.collection(COL.users).doc(ctx.uid).get()
  const displayName = (userSnapshot.get('displayName') as string | undefined) ?? ''
  const languages =
    (userSnapshot.get('languages') as { code: string }[] | undefined)?.map(
      (entry) => entry.code,
    ) ?? []

  await db.runTransaction(async (transaction) => {
    const ref = activityRef(input.activityId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'errors.apply.notPublished')

    if (snapshot.get('status') !== 'published') {
      throw new HttpsError('failed-precondition', 'errors.apply.notPublished')
    }
    if (snapshot.get('requiresApplication') !== true) {
      throw new HttpsError('failed-precondition', 'errors.apply.notPublished')
    }

    const now = Timestamp.now()
    const startAt = snapshot.get('startAt') as
      InstanceType<typeof Timestamp> | undefined
    if (startAt && startAt.toMillis() <= now.toMillis()) {
      throw new HttpsError('failed-precondition', 'errors.apply.started')
    }

    const deadline = snapshot.get('applicationDeadline') as
      InstanceType<typeof Timestamp> | null | undefined
    if (deadline && deadline.toMillis() < now.toMillis()) {
      throw new HttpsError('failed-precondition', 'errors.apply.deadlinePassed')
    }

    const applicants = (snapshot.get('stats.applicants') as number | undefined) ?? 0
    const capacity = (snapshot.get('capacity') as number | undefined) ?? 0
    if (applicants >= capacity) {
      throw new HttpsError('resource-exhausted', 'errors.apply.full')
    }

    const applicantRef = ref.collection(APPLICANTS).doc(ctx.uid)
    const existing = await transaction.get(applicantRef)
    if (existing.exists && existing.get('status') !== 'withdrawn') {
      throw new HttpsError('already-exists', 'errors.apply.alreadyApplied')
    }

    transaction.set(applicantRef, {
      activityId: input.activityId,
      orgId: snapshot.get('orgId'),
      uid: ctx.uid,
      status: 'applied',
      message: input.message,
      applicantName: displayName,
      applicantLanguages: languages,
      activityTitle: snapshot.get('title'),
      activityStartAt: startAt ?? null,
      appliedAt: FieldValue.serverTimestamp(),
      decidedAt: null,
      decidedBy: null,
      decisionNote: '',
      withdrawnAt: null,
      attended: false,
    })

    transaction.update(ref, { 'stats.applicants': applicants + 1 })
  })

  return { ok: true }
})

/** Başvuruyu geri çekme — sayaç aynı transaction'da düşer. */
export const withdrawApplication = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(idSchema, request.data)

  await db.runTransaction(async (transaction) => {
    const ref = activityRef(input.activityId)
    const applicantRef = ref.collection(APPLICANTS).doc(ctx.uid)

    const [activity, application] = await Promise.all([
      transaction.get(ref),
      transaction.get(applicantRef),
    ])

    if (!application.exists || application.get('status') === 'withdrawn') return

    const applicants = (activity.get('stats.applicants') as number | undefined) ?? 0

    transaction.update(applicantRef, {
      status: 'withdrawn',
      withdrawnAt: FieldValue.serverTimestamp(),
    })
    transaction.update(ref, { 'stats.applicants': Math.max(0, applicants - 1) })
  })

  return { ok: true }
})

/** `decideApplication` — kurum kabul/red kararı. */
export const decideApplication = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(decideSchema, request.data)

  const snapshot = await loadActivity(input.activityId)
  const orgId = snapshot.get('orgId') as string
  requireOrgRole(ctx, orgId, 'org_admin', 'org_staff')

  const applicantRef = activityRef(input.activityId)
    .collection(APPLICANTS)
    .doc(input.applicantUid)

  const application = await applicantRef.get()
  if (!application.exists) throw new HttpsError('not-found', 'errors.notFound')
  if (application.get('status') !== 'applied') {
    throw new HttpsError('failed-precondition', 'errors.invalidState')
  }

  await applicantRef.update({
    status: input.decision === 'accept' ? 'accepted' : 'rejected',
    decidedAt: FieldValue.serverTimestamp(),
    decidedBy: ctx.uid,
    decisionNote: input.note,
  })

  await writeAudit({
    action: 'application.decided',
    actorUid: ctx.uid,
    targetId: `${input.activityId}/${input.applicantUid}`,
    orgId,
    meta: { decision: input.decision },
  })

  return { ok: true }
})
