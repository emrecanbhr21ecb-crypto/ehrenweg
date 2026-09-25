/**
 * Push, duyurular ve zamanlanmış bildirimler — CLAUDE.md Bölüm 12.
 *   sendAnnouncement, deadlineReminders, monthlySummary
 *
 * ⚠️ HENÜZ DAĞITILMADI (Blaze kapalı). İstemci tarafı jetonları şimdiden
 * topluyor (`app/src/lib/push.ts`), yani Blaze açıldığı gün mevcut
 * kullanıcılara da ulaşılabiliyor.
 *
 * Bildirim tercihleri `users/{uid}/private/settings` içinde ve gönderim
 * HER ZAMAN tercihe bakıyor: kapalı diyene bildirim gitmiyor.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getMessaging } from 'firebase-admin/messaging'
import { logger } from 'firebase-functions'
import { z } from 'zod'

import { COL, FieldValue, SUB, Timestamp, db } from './common/admin'
import { writeAudit } from './common/audit'
import { parseInput, requireAuth, requireOrgRole } from './common/guards'

type PreferenceKey = 'announcements' | 'deadlineReminders' | 'monthlySummary'

interface Recipient {
  uid: string
  tokens: string[]
  locale: 'de' | 'en'
}

/**
 * Bildirim gönderilecek kullanıcıları toplar.
 *
 * Tercih kapalıysa kişi listeye HİÇ girmiyor — "gönder sonra filtrele"
 * yapmıyoruz ki yanlışlıkla gönderim imkânsız olsun.
 */
async function recipientsFor(
  preference: PreferenceKey,
  uids?: string[],
): Promise<Recipient[]> {
  const users = uids
    ? await Promise.all(uids.map((uid) => db.collection(COL.users).doc(uid).get()))
    : (await db.collection(COL.users).limit(5000).get()).docs

  const result: Recipient[] = []

  for (const user of users) {
    if (!user.exists) continue
    const settings = await db
      .collection(COL.users)
      .doc(user.id)
      .collection(SUB.userPrivate)
      .doc('settings')
      .get()

    if (!settings.exists) continue
    if (settings.get(preference) === false) continue

    const tokens = (settings.get('pushTokens') as string[] | undefined) ?? []
    if (tokens.length === 0) continue

    result.push({
      uid: user.id,
      tokens,
      locale: (user.get('locale') as 'de' | 'en' | undefined) ?? 'de',
    })
  }

  return result
}

/** FCM'e yollar; ölü jetonları temizler. */
async function push(
  recipients: Recipient[],
  build: (recipient: Recipient) => { title: string; body: string },
  data: Record<string, string> = {},
): Promise<number> {
  if (recipients.length === 0) return 0
  const messaging = getMessaging()
  let sent = 0

  for (const recipient of recipients) {
    const content = build(recipient)
    for (const token of recipient.tokens) {
      try {
        await messaging.send({
          token,
          notification: { title: content.title, body: content.body },
          data,
          android: { priority: 'high' },
        })
        sent += 1
      } catch (error) {
        // Kaldırılmış uygulamanın jetonu sonsuza kadar kalmamalı.
        logger.info('Jeton geçersiz, temizleniyor', { uid: recipient.uid })
        await db
          .collection(COL.users)
          .doc(recipient.uid)
          .collection(SUB.userPrivate)
          .doc('settings')
          .update({ pushTokens: FieldValue.arrayRemove(token) })
          .catch(() => undefined)
      }
    }
  }

  return sent
}

// --- sendAnnouncement ------------------------------------------------------

const announcementSchema = z.object({ announcementId: z.string().min(1).max(64) })

/** `sendAnnouncement` — duyuruyu push olarak gönderir. */
export const sendAnnouncement = onCall(async (request) => {
  const ctx = requireAuth(request)
  const input = parseInput(announcementSchema, request.data)

  const ref = db.collection(COL.announcements).doc(input.announcementId)
  const announcement = await ref.get()
  if (!announcement.exists) throw new HttpsError('not-found', 'errors.notFound')

  const orgId = (announcement.get('orgId') as string | undefined) ?? ''
  if (orgId) requireOrgRole(ctx, orgId, 'org_admin', 'org_staff')
  else if (ctx.claims.role !== 'platform_admin') {
    throw new HttpsError('permission-denied', 'errors.permissionDenied')
  }

  // İki kez göndermek kullanıcıyı rahatsız eder ve geri alınamaz.
  if (announcement.get('pushSent') === true) {
    throw new HttpsError('failed-precondition', 'errors.alreadySent')
  }

  const recipients = await recipientsFor('announcements')
  const sent = await push(
    recipients,
    (recipient) => ({
      title:
        (announcement.get(`title.${recipient.locale}`) as string | undefined) ||
        (announcement.get('title.de') as string) ||
        '',
      body:
        (announcement.get(`body.${recipient.locale}`) as string | undefined) ||
        (announcement.get('body.de') as string) ||
        '',
    }),
    { announcementId: input.announcementId },
  )

  await ref.update({ pushSent: true, pushSentAt: FieldValue.serverTimestamp() })
  await writeAudit({
    action: 'announcement.sent' as never,
    actorUid: ctx.uid,
    targetId: input.announcementId,
    orgId,
    meta: { recipients: recipients.length, sent },
  })

  return { ok: true, recipients: recipients.length, sent }
})

// --- deadlineReminders -----------------------------------------------------

/**
 * `deadlineReminders` — son başvurudan bir gün önce (Bölüm 12).
 *
 * Yerel bildirimden (lib/reminders.ts) farkı: o kullanıcının kendi kurduğu
 * hatırlatma, bu ise henüz BAŞVURMAMIŞ ama ilgilenebilecek kişiler için
 * son şans uyarısı. İkisi çakışmıyor.
 */
export const deadlineReminders = onSchedule(
  { schedule: 'every day 09:00', timeZone: 'Europe/Berlin' },
  async () => {
    const now = Date.now()
    const windowStart = Timestamp.fromMillis(now + 23 * 3_600_000)
    const windowEnd = Timestamp.fromMillis(now + 25 * 3_600_000)

    const activities = await db
      .collection(COL.activities)
      .where('status', '==', 'published')
      .where('applicationDeadline', '>=', windowStart)
      .where('applicationDeadline', '<=', windowEnd)
      .get()

    if (activities.empty) return

    for (const activity of activities.docs) {
      // Zaten başvurmuş olana hatırlatma gitmesin.
      const applicants = await activity.ref.collection('applicants').get()
      const applied = new Set(applicants.docs.map((doc) => doc.id))

      const recipients = (await recipientsFor('deadlineReminders')).filter(
        (recipient) => !applied.has(recipient.uid),
      )

      await push(
        recipients,
        (recipient) => ({
          title:
            recipient.locale === 'en'
              ? 'Sign-up closes tomorrow'
              : 'Anmeldeschluss morgen',
          body:
            (activity.get(`title.${recipient.locale}`) as string | undefined) ||
            (activity.get('title.de') as string) ||
            '',
        }),
        { activityId: activity.id },
      )
    }
  },
)

// --- monthlySummary --------------------------------------------------------

/**
 * `monthlySummary` — her ayın 1'i 03:00 (Bölüm 6).
 * "Bu ay X saat, Y IP" bildirimi.
 */
export const monthlySummary = onSchedule(
  { schedule: '0 3 1 * *', timeZone: 'Europe/Berlin' },
  async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

    const entries = await db
      .collection(COL.passportEntries)
      .where('approvedAt', '>=', Timestamp.fromDate(monthStart))
      .where('approvedAt', '<', Timestamp.fromDate(monthEnd))
      .get()

    if (entries.empty) return

    const byUser = new Map<string, { hours: number; ip: number }>()
    for (const entry of entries.docs) {
      const uid = entry.get('uid') as string
      const current = byUser.get(uid) ?? { hours: 0, ip: 0 }
      current.hours += (entry.get('hours') as number | undefined) ?? 0
      current.ip += (entry.get('ipAwarded') as number | undefined) ?? 0
      byUser.set(uid, current)
    }

    const recipients = await recipientsFor('monthlySummary', [...byUser.keys()])

    await push(recipients, (recipient) => {
      const totals = byUser.get(recipient.uid) ?? { hours: 0, ip: 0 }
      const hours = Math.round(totals.hours)
      return recipient.locale === 'en'
        ? {
            title: 'Your month at Ehrenweg',
            body: `${hours} hours, ${totals.ip} points. Thank you!`,
          }
        : {
            title: 'Dein Monat bei Ehrenweg',
            body: `${hours} Stunden, ${totals.ip} Punkte. Danke!`,
          }
    })

    logger.info('Aylık özet gönderildi', { users: recipients.length })
  },
)
