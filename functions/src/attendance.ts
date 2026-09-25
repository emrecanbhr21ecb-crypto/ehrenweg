/**
 * Yoklama ve pasaport — CLAUDE.md Bölüm 12:
 *   startAttendanceSession, stopAttendanceSession, getCurrentCode,
 *   submitScan, approveLateScans, onAttendanceConfirmed, markNoShows
 *
 * ⚠️ BU FONKSİYONLAR HENÜZ DAĞITILMADI (Blaze kapalı, docs/DECISIONS.md §9).
 * Aynı iş şu an istemci + `firestore.rules` ile yapılıyor. Buradaki sürümün
 * iki gerçek üstünlüğü var ve Blaze açıldığı gün kazanılacak:
 *
 *   1. **HMAC'li kod.** Kod saklanmıyor, `ATTENDANCE_HMAC_SECRET` ile
 *      hesaplanıyor. Sır hiçbir istemciye gitmiyor.
 *   2. **Bonuslar.** Yeni kategori / ayda 4+ katılım bonusları kullanıcının
 *      TÜM kurumlardaki geçmişini okumayı gerektiriyor; istemci bunu
 *      yapamaz, kural da doğrulayamaz (bkz. app/src/lib/passport.ts).
 *
 * Geçiş: app/src/lib/backend.ts → CLOUD_FUNCTIONS_ENABLED = true, ardından
 * kuraldaki istemci yazma izinleri `if false` olur.
 *
 * Sır kurulumu (proje sahibi çalıştırır):
 *   firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-dev
 *   firebase functions:secrets:set ATTENDANCE_HMAC_SECRET --project ehrenweg-prod
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { z } from 'zod'

import { COL, FieldValue, Timestamp, db } from './common/admin'
import { writeAudit } from './common/audit'
import { ATTENDANCE_HMAC_SECRET, DEFAULT_ROTATION_SECONDS } from './common/config'
import {
  parseInput,
  requireAuth,
  requireOrgRole,
  requireVerifiedEmail,
} from './common/guards'

const CODES = 'codes'
const APPLICANTS = 'applicants'

/** QR ön eki — CLAUDE.md Bölüm 1A. İstemcideki sabitle AYNI olmalı. */
const QR_PREFIX = 'EHRENWEG:ATT:'

// --- Puan kuralları (CLAUDE.md Bölüm 6 varsayılanları) ---------------------

interface Scoring {
  maxIpPerActivity: number
  bonuses: { newCategory: number; monthlyFour: number; trainerMultiplier: number }
  penalties: { noShowIp: number; noShowStreakLimit: number; restrictionDays: number }
}

const DEFAULT_SCORING: Scoring = {
  maxIpPerActivity: 60,
  bonuses: { newCategory: 15, monthlyFour: 25, trainerMultiplier: 1.5 },
  penalties: { noShowIp: 5, noShowStreakLimit: 3, restrictionDays: 14 },
}

async function loadScoring(): Promise<Scoring> {
  const snapshot = await db.collection(COL.config).doc('scoring').get()
  if (!snapshot.exists) return DEFAULT_SCORING
  const data = snapshot.data() as Partial<Scoring>
  return {
    maxIpPerActivity: data.maxIpPerActivity ?? DEFAULT_SCORING.maxIpPerActivity,
    bonuses: { ...DEFAULT_SCORING.bonuses, ...(data.bonuses ?? {}) },
    penalties: { ...DEFAULT_SCORING.penalties, ...(data.penalties ?? {}) },
  }
}

/** Seviye eşikleri — Bölüm 6 tablosu. firestore.rules ile aynı mantık. */
function levelFor(stats: {
  activitiesCompleted: number
  hours: number
  categoriesCount: number
}): number {
  if (stats.activitiesCompleted >= 30 && stats.hours >= 120) return 5
  if (
    stats.activitiesCompleted >= 15 &&
    stats.hours >= 50 &&
    stats.categoriesCount >= 3
  ) {
    return 4
  }
  if (stats.activitiesCompleted >= 8 && stats.hours >= 20) return 3
  if (stats.activitiesCompleted >= 3) return 2
  return 1
}

// --- HMAC'li dönen kod -----------------------------------------------------

function sign(secret: string, sessionId: string, codeId: string, exp: number): string {
  return createHmac('sha256', secret)
    .update(`${sessionId}|${codeId}|${exp}`)
    .digest('base64url')
}

/** Sabit süreli karşılaştırma — imza sızıntısına karşı. */
function signatureMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const sessionIdSchema = z.object({ sessionId: z.string().min(1).max(64) })

const startSchema = z.object({
  activityId: z.string().min(1).max(64),
  rotationSeconds: z.number().int().min(10).max(600).default(DEFAULT_ROTATION_SECONDS),
  requireGeo: z.boolean().default(false),
  geoRadiusMeters: z.number().int().min(10).max(20_000).default(200),
})

const scanSchema = z.object({
  payload: z.string().min(1).max(512),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
})

const manualSchema = z.object({
  activityId: z.string().min(1).max(64),
  code: z.string().min(4).max(10),
})

const approveSchema = z.object({
  recordIds: z.array(z.string().min(1).max(128)).min(1).max(200),
  decision: z.enum(['approve', 'reject']),
})

/** `startAttendanceSession` */
export const startAttendanceSession = onCall(
  { secrets: [ATTENDANCE_HMAC_SECRET] },
  async (request) => {
    const ctx = requireAuth(request)
    const input = parseInput(startSchema, request.data)

    const activity = await db.collection(COL.activities).doc(input.activityId).get()
    if (!activity.exists)
      throw new HttpsError('not-found', 'errors.scan.activityMissing')

    const orgId = activity.get('orgId') as string
    requireOrgRole(ctx, orgId, 'org_admin', 'org_staff')

    // Açık oturum varsa yenisini AÇMA: iki QR ekranı katılımcıları böler.
    const open = await db
      .collection(COL.attendanceSessions)
      .where('activityId', '==', input.activityId)
      .where('active', '==', true)
      .limit(1)
      .get()

    if (!open.empty) {
      const doc = open.docs[0]
      if (doc) return { sessionId: doc.id, reused: true }
    }

    const location = activity.get('location') as
      { lat: number | null; lng: number | null } | undefined

    const ref = await db.collection(COL.attendanceSessions).add({
      activityId: input.activityId,
      orgId,
      activityTitle: (activity.get('title.de') ??
        activity.get('title.en') ??
        '') as string,
      startedBy: ctx.uid,
      active: true,
      startedAt: FieldValue.serverTimestamp(),
      endedAt: null,
      rotationSeconds: input.rotationSeconds,
      requireGeo: input.requireGeo,
      geoRadiusMeters: input.geoRadiusMeters,
      geoLat: location?.lat ?? null,
      geoLng: location?.lng ?? null,
      // Manuel kod oturum boyunca sabit; QR'ın kısa ömrü güvenliği sağlıyor.
      manualCode: String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0'),
    })

    await writeAudit({
      action: 'attendance.session_started',
      actorUid: ctx.uid,
      targetId: ref.id,
      orgId,
    })

    return { sessionId: ref.id, reused: false }
  },
)

/** `stopAttendanceSession` */
export const stopAttendanceSession = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(sessionIdSchema, request.data)

  const ref = db.collection(COL.attendanceSessions).doc(input.sessionId)
  const session = await ref.get()
  if (!session.exists) throw new HttpsError('not-found', 'errors.notFound')

  requireOrgRole(ctx, session.get('orgId') as string, 'org_admin', 'org_staff')

  await ref.update({ active: false, endedAt: FieldValue.serverTimestamp() })
  await ref
    .collection(CODES)
    .doc('current')
    .delete()
    .catch(() => undefined)

  await writeAudit({
    action: 'attendance.session_stopped',
    actorUid: ctx.uid,
    targetId: input.sessionId,
    orgId: session.get('orgId') as string,
  })

  return { ok: true }
})

/**
 * `getCurrentCode` — her `rotationSeconds`'da yeni HMAC'li kod.
 *
 * Kod SAKLANMIYOR: pencere numarasından türetiliyor. Böylece yazma yükü yok
 * ve `submitScan` aynı hesabı tekrarlayarak doğruluyor.
 */
export const getCurrentCode = onCall(
  { secrets: [ATTENDANCE_HMAC_SECRET] },
  async (request) => {
    const ctx = requireAuth(request)
    const input = parseInput(sessionIdSchema, request.data)

    const session = await db
      .collection(COL.attendanceSessions)
      .doc(input.sessionId)
      .get()
    if (!session.exists) throw new HttpsError('not-found', 'errors.scan.inactive')
    if (session.get('active') !== true) {
      throw new HttpsError('failed-precondition', 'errors.scan.inactive')
    }

    requireOrgRole(ctx, session.get('orgId') as string, 'org_admin', 'org_staff')

    const rotation =
      (session.get('rotationSeconds') as number) ?? DEFAULT_ROTATION_SECONDS
    const window = Math.floor(Date.now() / 1000 / rotation)
    const codeId = String(window)
    const exp = (window + 1) * rotation * 1000
    const signature = sign(ATTENDANCE_HMAC_SECRET.value(), input.sessionId, codeId, exp)

    return {
      payload: `${QR_PREFIX}v1.${input.sessionId}.${codeId}.${exp}.${signature}`,
      manualCode: session.get('manualCode') as string,
      expiresAt: exp,
      rotationSeconds: rotation,
    }
  },
)

/**
 * `submitScan` — CLAUDE.md Bölüm 12 hata kodları:
 * wrong-code / expired / inactive / activity-missing / geo-too-far.
 */
export const submitScan = onCall(
  { secrets: [ATTENDANCE_HMAC_SECRET] },
  async (request) => {
    const ctx = requireAuth(request)
    requireVerifiedEmail(ctx)
    const input = parseInput(scanSchema, request.data)

    if (!input.payload.startsWith(QR_PREFIX)) {
      throw new HttpsError('invalid-argument', 'errors.scan.wrongCode')
    }
    const parts = input.payload.slice(QR_PREFIX.length).split('.')
    if (parts.length !== 5 || parts[0] !== 'v1') {
      throw new HttpsError('invalid-argument', 'errors.scan.wrongCode')
    }
    const [, sessionId, codeId, expRaw, signature] = parts as [
      string,
      string,
      string,
      string,
      string,
    ]

    const exp = Number(expRaw)
    if (!Number.isFinite(exp)) {
      throw new HttpsError('invalid-argument', 'errors.scan.wrongCode')
    }
    // Sunucu saati — istemcininkine ASLA güvenilmez.
    if (Date.now() > exp)
      throw new HttpsError('failed-precondition', 'errors.scan.expired')

    const expected = sign(ATTENDANCE_HMAC_SECRET.value(), sessionId, codeId, exp)
    if (!signatureMatches(expected, signature)) {
      throw new HttpsError('permission-denied', 'errors.scan.wrongCode')
    }

    return recordAttendance(ctx.uid, sessionId, 'qr', input.lat, input.lng)
  },
)

/** Manuel 6 haneli kod girişi. */
export const submitManualCode = onCall(async (request) => {
  const ctx = requireAuth(request)
  requireVerifiedEmail(ctx)
  const input = parseInput(manualSchema, request.data)

  const open = await db
    .collection(COL.attendanceSessions)
    .where('activityId', '==', input.activityId)
    .where('active', '==', true)
    .limit(1)
    .get()

  const session = open.docs[0]
  if (!session) throw new HttpsError('failed-precondition', 'errors.scan.inactive')
  if (session.get('manualCode') !== input.code) {
    throw new HttpsError('permission-denied', 'errors.scan.wrongCode')
  }

  return recordAttendance(ctx.uid, session.id, 'manual_code', null, null)
})

/** Ortak kayıt yazımı — imza doğrulandıktan sonra. */
async function recordAttendance(
  uid: string,
  sessionId: string,
  method: 'qr' | 'manual_code',
  lat: number | null,
  lng: number | null,
): Promise<{ ok: true; recordId: string }> {
  const session = await db.collection(COL.attendanceSessions).doc(sessionId).get()
  if (!session.exists) throw new HttpsError('not-found', 'errors.scan.inactive')
  if (session.get('active') !== true) {
    throw new HttpsError('failed-precondition', 'errors.scan.inactive')
  }

  const activityId = session.get('activityId') as string
  if (!activityId) throw new HttpsError('not-found', 'errors.scan.activityMissing')

  let geoOk: boolean | null = null
  if (session.get('requireGeo') === true) {
    const sessionLat = session.get('geoLat') as number | null
    const sessionLng = session.get('geoLng') as number | null
    if (sessionLat !== null && sessionLng !== null) {
      if (lat === null || lng === null) {
        throw new HttpsError('failed-precondition', 'errors.scan.geoTooFar')
      }
      const meters = haversineMeters(lat, lng, sessionLat, sessionLng)
      geoOk = meters <= ((session.get('geoRadiusMeters') as number) ?? 200)
      if (!geoOk) throw new HttpsError('failed-precondition', 'errors.scan.geoTooFar')
    }
  }

  const recordId = `${sessionId}_${uid}`
  const ref = db.collection(COL.attendanceRecords).doc(recordId)
  if ((await ref.get()).exists) {
    throw new HttpsError('already-exists', 'errors.scan.alreadyScanned')
  }

  const user = await db.collection(COL.users).doc(uid).get()

  await ref.set({
    uid,
    activityId,
    sessionId,
    orgId: session.get('orgId'),
    method,
    scannedAt: FieldValue.serverTimestamp(),
    status: 'confirmed',
    geoOk,
    displayName: (user.get('displayName') as string | undefined) ?? '',
    awarded: false,
  })

  return { ok: true, recordId }
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** `approveLateScans` — geç/çevrimdışı taramaların toplu onayı. */
export const approveLateScans = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(approveSchema, request.data)

  const batch = db.batch()
  for (const recordId of input.recordIds) {
    const ref = db.collection(COL.attendanceRecords).doc(recordId)
    const record = await ref.get()
    if (!record.exists) continue
    requireOrgRole(ctx, record.get('orgId') as string, 'org_admin', 'org_staff')

    batch.update(ref, {
      status: input.decision === 'approve' ? 'confirmed' : 'rejected',
      method: input.decision === 'approve' ? 'staff_approved' : record.get('method'),
    })
  }
  await batch.commit()

  await writeAudit({
    action:
      input.decision === 'approve'
        ? 'attendance.manually_approved'
        : 'attendance.rejected',
    actorUid: ctx.uid,
    meta: { count: input.recordIds.length },
  })

  return { ok: true }
})

/**
 * `onAttendanceConfirmed` — pasaport girdisi + IP + ledger + seviye.
 *
 * CLAUDE.md Bölüm 12. Bonuslar BURADA hesaplanıyor: kullanıcının tüm
 * geçmişini okuyabilen tek yer burası.
 *
 * İdempotent: pasaport girdisi kimliği `{activityId}_{uid}`; varsa çıkılır.
 */
export const onAttendanceConfirmed = onDocumentWritten(
  'attendanceRecords/{recordId}',
  async (event) => {
    const after = event.data?.after
    if (!after?.exists) return
    if (after.get('status') !== 'confirmed') return
    if (after.get('awarded') === true) return

    const uid = after.get('uid') as string
    const activityId = after.get('activityId') as string
    const sessionId = after.get('sessionId') as string

    const activity = await db.collection(COL.activities).doc(activityId).get()
    if (!activity.exists) {
      logger.warn('Aktivite yok, puan yazılmadı', { activityId })
      return
    }

    const scoring = await loadScoring()
    const entryId = `${activityId}_${uid}`
    const entryRef = db.collection(COL.passportEntries).doc(entryId)

    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(entryRef)).exists) {
        transaction.update(after.ref, { awarded: true })
        return
      }

      const userRef = db.collection(COL.users).doc(uid)
      const user = await transaction.get(userRef)
      const stats = (user.get('stats') ?? {}) as {
        ip: number
        hours: number
        activitiesCompleted: number
        categoriesCount: number
      }

      const categoryId = activity.get('categoryId') as string
      const hours = (activity.get('hoursCredited') as number) ?? 0

      // --- Bonuslar (Bölüm 6) — yalnız burada hesaplanabilir -------------
      const previous = await db
        .collection(COL.passportEntries)
        .where('uid', '==', uid)
        .get()

      const isNewCategory = !previous.docs.some(
        (doc) => doc.get('categoryId') === categoryId,
      )

      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      const monthlyCount =
        previous.docs.filter((doc) => {
          const approvedAt = doc.get('approvedAt') as
            InstanceType<typeof Timestamp> | undefined
          return approvedAt ? approvedAt.toMillis() >= monthStart.getTime() : false
        }).length + 1

      const isTrainer = activity.get('trainerUid') === uid

      const bonuses: string[] = []
      let ip = Math.min(
        (activity.get('rewards.ip') as number) ?? 0,
        scoring.maxIpPerActivity,
      )
      if (isTrainer) {
        ip = Math.round(ip * scoring.bonuses.trainerMultiplier)
        bonuses.push('trainer')
      }
      if (isNewCategory) {
        ip += scoring.bonuses.newCategory
        bonuses.push('newCategory')
      }
      if (monthlyCount >= 4) {
        ip += scoring.bonuses.monthlyFour
        bonuses.push('monthlyFour')
      }

      const nextStats = {
        ip: (stats.ip ?? 0) + ip,
        hours: (stats.hours ?? 0) + hours,
        activitiesCompleted: (stats.activitiesCompleted ?? 0) + 1,
        categoriesCount: (stats.categoriesCount ?? 0) + (isNewCategory ? 1 : 0),
      }

      transaction.set(entryRef, {
        uid,
        activityId,
        orgId: activity.get('orgId'),
        sessionId,
        categoryId,
        activityTitle: activity.get('title.de') ?? activity.get('title.en') ?? '',
        hours,
        ipAwarded: ip,
        skillsGained: activity.get('skillsGained') ?? [],
        source: 'attendance',
        status: 'completed',
        approvedAt: FieldValue.serverTimestamp(),
        bonuses,
      })

      transaction.set(db.collection(COL.ledger).doc(`${entryId}_award`), {
        uid,
        type: 'ip_award',
        amount: ip,
        currency: 'IP',
        refId: entryId,
        orgId: activity.get('orgId'),
        actorUid: 'system',
        reason: 'attendance',
        createdAt: FieldValue.serverTimestamp(),
      })

      transaction.update(userRef, {
        stats: {
          ...stats,
          ...nextStats,
          noShows: (user.get('stats.noShows') as number) ?? 0,
          consecutiveNoShows: 0,
          level: levelFor(nextStats),
        },
        lastAwardId: entryId,
      })

      transaction.update(after.ref, { awarded: true })
    })
  },
)

/**
 * `markNoShows` — aktivite bitiminden 24 saat sonra (CLAUDE.md Bölüm 12).
 *
 * Kabul edilip gelmeyene −5 IP ve `noShows++`; 3 ardışık no-show'da 14 gün
 * başvuru kısıtı (Bölüm 6). Kısıt ayrı bir alan değil, `lastNoShowAt` +
 * `consecutiveNoShows` üzerinden kuralda hesaplanıyor.
 */
export const markNoShows = onSchedule(
  { schedule: 'every 6 hours', timeZone: 'Europe/Berlin' },
  async () => {
    const now = Date.now()
    const windowStart = Timestamp.fromMillis(now - 72 * 60 * 60 * 1000)
    const windowEnd = Timestamp.fromMillis(now - 24 * 60 * 60 * 1000)

    const activities = await db
      .collection(COL.activities)
      .where('endAt', '>=', windowStart)
      .where('endAt', '<=', windowEnd)
      .get()

    const scoring = await loadScoring()

    for (const activity of activities.docs) {
      const applicants = await activity.ref
        .collection(APPLICANTS)
        .where('status', '==', 'accepted')
        .get()

      for (const applicant of applicants.docs) {
        const uid = applicant.get('uid') as string
        if (applicant.get('attended') === true) continue

        const attended = await db
          .collection(COL.attendanceRecords)
          .where('activityId', '==', activity.id)
          .where('uid', '==', uid)
          .where('status', '==', 'confirmed')
          .limit(1)
          .get()
        if (!attended.empty) continue

        // Bir kez işaretle: zamanlayıcı 6 saatte bir dönüyor.
        if (applicant.get('noShowMarked') === true) continue

        await db.runTransaction(async (transaction) => {
          const userRef = db.collection(COL.users).doc(uid)
          const user = await transaction.get(userRef)
          const currentIp = (user.get('stats.ip') as number) ?? 0

          transaction.update(userRef, {
            'stats.ip': Math.max(0, currentIp - scoring.penalties.noShowIp),
            'stats.noShows': FieldValue.increment(1),
            'stats.consecutiveNoShows': FieldValue.increment(1),
            lastNoShowAt: FieldValue.serverTimestamp(),
            lastNoShowActivityId: activity.id,
          })
          transaction.update(applicant.ref, { noShowMarked: true })
        })

        logger.info('No-show işlendi', { uid, activityId: activity.id })
      }
    }
  },
)
