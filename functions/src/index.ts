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
 *           approveOrganization, setOrgMember, removeOrgMember   ✅ yazıldı
 *   Faz 3 → startAttendanceSession, getCurrentCode, submitScan, approveLateScans,
 *           onAttendanceConfirmed, markNoShows                     ✅ yazıldı
 *   Faz 4 → buyReward, getVoucherQr, redeemVoucher, revokeVoucher,
 *           expireVouchers                                         ✅ yazıldı
 *   Faz 5 → reviewTrainerApplication                                ✅ yazıldı
 *   Faz 6 → monthlySummary, deadlineReminders, sendAnnouncement,
 *           aiTranslate (diğer AI uçları kaldırıldı, DECISIONS §12)  ✅ yazıldı
 *   Faz 7 → orgMonthlyReport, passportPdf
 */

import './common/config'

import { onCall } from 'firebase-functions/v2/https'

import { REGION } from './common/config'
import { requireAuth } from './common/guards'

/**
 * Faz 2 uçları. ⚠️ Blaze kapalı olduğu için HENÜZ DAĞITILMADI — kod derleniyor
 * ve hazır bekliyor (docs/DECISIONS.md §7). Aynı iş şu an istemci + Firestore
 * kuralları ile yapılıyor; geçiş tek bayrakla olacak:
 * app/src/lib/backend.ts → CLOUD_FUNCTIONS_ENABLED = true
 */
export {
  submitActivity,
  reviewActivity,
  applyToActivity,
  withdrawApplication,
  decideApplication,
} from './activities'

export { approveOrganization, setOrgMember, removeOrgMember } from './organizations'

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
