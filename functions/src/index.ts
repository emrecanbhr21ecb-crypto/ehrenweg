/**
 * Ehrenweg — Cloud Functions giriş noktası.
 *
 * Bölge ve genel ayarlar `common/config` içinde setGlobalOptions ile kurulur;
 * bu yüzden config EN ÖNCE içe aktarılır.
 *
 * Faz 0'da yalnızca `healthCheck` var — altyapının (bölge, App Check, claim
 * okuma, Firestore erişimi) gerçekten ayakta olduğunu kanıtlar.
 * Bölüm 12'deki fonksiyonlar kendi fazlarında eklenecek:
 *
 *   Faz 1 → onUserCreate, deleteMyAccount, exportMyData, setUserRole
 *   Faz 2 → submitActivity, reviewActivity, applyToActivity, decideApplication
 *   Faz 3 → startAttendanceSession, getCurrentCode, submitScan, approveLateScans
 *   Faz 4 → issueVoucher, buyReward, getVoucherQr, redeemVoucher, revokeVoucher
 *   Faz 5 → reviewTrainerApplication
 *   Faz 6 → monthlySummary, deadlineReminders, sendAnnouncement, ai*
 *   Faz 7 → orgMonthlyReport, passportPdf
 */

import './common/config'

import { onCall } from 'firebase-functions/v2/https'

import { REGION } from './common/config'
import { requireAuth } from './common/guards'

/**
 * Altyapı sağlık kontrolü.
 * İstemciden çağrılır; oturum + App Check + claim okuma zincirinin çalıştığını
 * doğrular. Hiçbir veri yazmaz, hiçbir kişisel veri döndürmez.
 */
export const healthCheck = onCall((request) => {
  const ctx = requireAuth(request)

  return {
    ok: true,
    region: REGION,
    role: ctx.claims.role,
    orgCount: Object.keys(ctx.claims.orgs ?? {}).length,
    emailVerified: ctx.emailVerified,
    // Sunucu saati — istemcinin saatine güvenilmediğini hatırlatmak için.
    // (Yoklama ve kupon sürelerinde HER ZAMAN sunucu saati kullanılır.)
    serverTime: new Date().toISOString(),
  }
})
