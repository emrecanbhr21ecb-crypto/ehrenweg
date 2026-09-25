/**
 * Eğitmen kariyer yolu — CLAUDE.md Bölüm 8, Bölüm 12
 * `reviewTrainerApplication`.
 *
 * ⚠️ HENÜZ DAĞITILMADI (Blaze kapalı, docs/DECISIONS.md §11). Bu sürümün
 * istemci yoluna göre tek üstünlüğü **custom claim yazabilmesi**: bugün
 * eğitmen yetkisi `users/{uid}.trainerStatus` alanından okunuyor, Blaze
 * gelince `role: 'trainer'` claim'i devreye girer ve kural okuması ucuzlar.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'

import { COL, FieldValue, auth, db } from './common/admin'
import { writeAudit } from './common/audit'
import { parseInput, requireAuth, requirePlatformRole } from './common/guards'
import { readClaims } from './common/roles'

const reviewSchema = z.object({
  uid: z.string().min(1).max(128),
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).default(''),
})

/** `reviewTrainerApplication` — onayla / gerekçeyle reddet. */
export const reviewTrainerApplication = onCall(async (request) => {
  const ctx = requireAuth(request)
  requirePlatformRole(ctx, 'platform_admin')
  const input = parseInput(reviewSchema, request.data)

  const ref = db.collection(COL.trainerApplications).doc(input.uid)
  const application = await ref.get()
  if (!application.exists) throw new HttpsError('not-found', 'errors.notFound')
  if (application.get('status') !== 'pending') {
    throw new HttpsError('failed-precondition', 'errors.invalidState')
  }

  const approved = input.decision === 'approve'

  await ref.update({
    status: approved ? 'approved' : 'rejected',
    reviewedBy: ctx.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    note: input.note,
  })

  await db
    .collection(COL.users)
    .doc(input.uid)
    .update({
      trainerStatus: approved ? 'approved' : 'rejected',
      roleDisplay: approved ? 'trainer' : 'participant',
    })

  if (approved) {
    // Claim'i koru: kurum rolleri ezilmemeli.
    const user = await auth.getUser(input.uid)
    const existing = readClaims(
      user.customClaims as Record<string, unknown> | undefined,
    )
    await auth.setCustomUserClaims(input.uid, {
      ...existing,
      role: 'trainer',
    })
  }

  await writeAudit({
    action: 'trainer.reviewed',
    actorUid: ctx.uid,
    targetId: input.uid,
    reason: input.note,
    meta: { decision: input.decision },
  })

  return { ok: true, approved }
})
