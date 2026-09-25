/**
 * Kurum doğrulama ve üyelik — CLAUDE.md Bölüm 4 ve 12.
 *
 * ⚠️ BU FONKSİYONLAR HENÜZ DAĞITILMADI. Cloud Functions Blaze planı istiyor,
 * proje Spark'ta (docs/DECISIONS.md §7). Kod yazıldı ve derleniyor; Blaze
 * açıldığı gün `app/src/lib/backend.ts` içindeki `CLOUD_FUNCTIONS_ENABLED`
 * true yapılıp `firestore.rules` içindeki karşılık gelen istemci yazma
 * izinleri kapatılacak. O ana kadar aynı işi istemci + kurallar yapıyor.
 *
 * Buradaki sürümün istemci sürümüne göre TEK üstünlüğü custom claim
 * yazabilmesi — claim'i istemci hiçbir koşulda yazamaz.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { z } from 'zod'

import { COL, FieldValue, SUB, auth, db } from './common/admin'
import { writeAudit } from './common/audit'
import {
  parseInput,
  requireAuth,
  requirePlatformRole,
  requireOrgRole,
} from './common/guards'
import { MAX_ORG_CLAIMS, isOrgRole, readClaims, type OrgRole } from './common/roles'

const reviewSchema = z.object({
  orgId: z.string().min(1).max(64),
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).default(''),
})

const memberSchema = z.object({
  orgId: z.string().min(1).max(64),
  uid: z.string().min(1).max(128),
  role: z.enum(['org_admin', 'org_staff', 'redemption_officer', 'partner']),
  displayName: z.string().max(120).default(''),
  email: z.string().max(200).default(''),
})

const removeSchema = z.object({
  orgId: z.string().min(1).max(64),
  uid: z.string().min(1).max(128),
})

/**
 * Kullanıcının `orgs` claim haritasını tazeler.
 *
 * Claim toplamı 1000 bayt ile sınırlı; MAX_ORG_CLAIMS'i aşan üyelikler
 * claim'e yazılmaz, kurallar o durumda üyelik belgesine düşer.
 */
async function syncOrgClaims(uid: string): Promise<void> {
  const memberships = await db
    .collectionGroup(SUB.orgMembers)
    .where('uid', '==', uid)
    .limit(MAX_ORG_CLAIMS)
    .get()

  const orgs: Record<string, OrgRole> = {}
  for (const doc of memberships.docs) {
    const orgId = doc.get('orgId') as unknown
    const role = doc.get('role') as unknown
    if (typeof orgId === 'string' && isOrgRole(role)) orgs[orgId] = role
  }

  const user = await auth.getUser(uid)
  const existing = readClaims(user.customClaims as Record<string, unknown> | undefined)

  await auth.setCustomUserClaims(uid, {
    role: existing.role,
    ...(Object.keys(orgs).length > 0 ? { orgs } : {}),
  })
}

/**
 * `approveOrganization` — platform admin kurumu doğrular veya reddeder.
 *
 * Onaylanınca:
 *   · `verified: true` → kurum aktivite yayınlayabilir, rozet görünür
 *   · başvuran kişi `org_admin` olarak claim'e yazılır
 */
export const approveOrganization = onCall(async (request) => {
  const ctx = requireAuth(request)
  requirePlatformRole(ctx, 'platform_admin')
  const input = parseInput(reviewSchema, request.data)

  const ref = db.collection(COL.organizations).doc(input.orgId)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'errors.notFound')

  const approved = input.decision === 'approve'

  await ref.update({
    verified: approved,
    status: approved ? 'approved' : 'rejected',
    reviewedBy: ctx.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewNote: input.note,
  })

  const appliedBy = snapshot.get('appliedBy') as unknown
  if (approved && typeof appliedBy === 'string' && appliedBy.length > 0) {
    await ref
      .collection(SUB.orgMembers)
      .doc(appliedBy)
      .set(
        {
          uid: appliedBy,
          orgId: input.orgId,
          role: 'org_admin' satisfies OrgRole,
          addedBy: ctx.uid,
          addedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    await syncOrgClaims(appliedBy)
  }

  await writeAudit({
    action: approved ? 'organization.approved' : 'organization.rejected',
    actorUid: ctx.uid,
    targetId: input.orgId,
    orgId: input.orgId,
    reason: input.note,
  })

  return { ok: true, verified: approved }
})

/** Kurum ekibine üye ekler / rolünü değiştirir. Yalnız `org_admin`. */
export const setOrgMember = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(memberSchema, request.data)
  requireOrgRole(ctx, input.orgId, 'org_admin')

  await db
    .collection(COL.organizations)
    .doc(input.orgId)
    .collection(SUB.orgMembers)
    .doc(input.uid)
    .set(
      {
        uid: input.uid,
        orgId: input.orgId,
        role: input.role,
        displayName: input.displayName,
        email: input.email,
        addedBy: ctx.uid,
        addedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

  await syncOrgClaims(input.uid)

  await writeAudit({
    action: 'role.set',
    actorUid: ctx.uid,
    targetId: input.uid,
    orgId: input.orgId,
    meta: { role: input.role },
  })

  return { ok: true }
})

/**
 * Kurum ekibinden çıkarır.
 * Son `org_admin` çıkarılamaz — kurum sahipsiz kalırsa kimse aktivite
 * yönetemez ve düzeltmek için platform admin gerekir.
 */
export const removeOrgMember = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(removeSchema, request.data)
  requireOrgRole(ctx, input.orgId, 'org_admin')

  const members = db
    .collection(COL.organizations)
    .doc(input.orgId)
    .collection(SUB.orgMembers)

  const target = await members.doc(input.uid).get()
  if (!target.exists) return { ok: true }

  if (target.get('role') === 'org_admin') {
    const admins = await members.where('role', '==', 'org_admin').get()
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'errors.lastOrgAdmin')
    }
  }

  await members.doc(input.uid).delete()
  await syncOrgClaims(input.uid)

  await writeAudit({
    action: 'role.set',
    actorUid: ctx.uid,
    targetId: input.uid,
    orgId: input.orgId,
    meta: { role: 'removed' },
  })

  return { ok: true }
})
