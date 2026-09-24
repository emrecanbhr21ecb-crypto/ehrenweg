/**
 * onCall fonksiyonları için ortak korumalar (CLAUDE.md Bölüm 12):
 *   "Her onCall fonksiyonda: App Check zorunlu, claim kontrolü, zod ile girdi
 *    doğrulama, rate limit (kullanıcı başına), hata mesajları i18n anahtarı
 *    olarak döner."
 *
 * Hata mesajı kuralı: `HttpsError.message` bir İNSAN CÜMLESİ DEĞİL, i18n
 * anahtarıdır (ör. 'errors.scan.expired'). Çeviri istemcide yapılır — böylece
 * sunucu kullanıcının dilini bilmek zorunda kalmaz.
 */

import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import type { ZodType } from 'zod'

import { IS_EMULATOR } from './config'
import {
  readClaims,
  type EhrenwegClaims,
  type OrgRole,
  type PlatformRole,
} from './roles'

export interface AuthedContext {
  uid: string
  claims: EhrenwegClaims
  /** Doğrulanmış e-posta adresi (varsa). */
  email: string | undefined
  emailVerified: boolean
}

/**
 * Oturum + App Check doğrular, çağıranın kimliğini döner.
 *
 * App Check emülatörde zorunlu değildir (yerel geliştirme mümkün olsun diye),
 * gerçek projelerde ZORUNLUDUR. Bu, sahte istemcilerin doğrudan API'yi
 * dövmesini engelleyen ana savunmadır — özellikle kupon ve yoklama uçlarında.
 */
export function requireAuth(request: CallableRequest<unknown>): AuthedContext {
  if (!IS_EMULATOR && request.app === undefined) {
    logger.warn('App Check jetonu olmayan çağrı reddedildi', {
      // uid'yi logla ama kişisel veri yazma
      uid: request.auth?.uid ?? null,
    })
    throw new HttpsError('failed-precondition', 'errors.appCheckFailed')
  }

  const auth = request.auth
  if (!auth) {
    throw new HttpsError('unauthenticated', 'errors.permissionDenied')
  }

  const token = auth.token as unknown as Record<string, unknown>

  return {
    uid: auth.uid,
    claims: readClaims(token),
    email: typeof token['email'] === 'string' ? token['email'] : undefined,
    emailVerified: token['email_verified'] === true,
  }
}

/** E-posta doğrulaması şart olan uçlar için (başvuru, kupon vb.). */
export function requireVerifiedEmail(ctx: AuthedContext): void {
  if (!ctx.emailVerified) {
    throw new HttpsError('failed-precondition', 'errors.emailNotVerified')
  }
}

export function requirePlatformRole(
  ctx: AuthedContext,
  ...allowed: readonly PlatformRole[]
): void {
  if (!allowed.includes(ctx.claims.role)) {
    throw new HttpsError('permission-denied', 'errors.permissionDenied')
  }
}

export function requireOrgRole(
  ctx: AuthedContext,
  orgId: string,
  ...allowed: readonly OrgRole[]
): void {
  if (ctx.claims.role === 'platform_admin') return
  const role = ctx.claims.orgs?.[orgId]
  if (role === undefined || !allowed.includes(role)) {
    throw new HttpsError('permission-denied', 'errors.permissionDenied')
  }
}

/**
 * Girdiyi zod ile doğrular. Doğrulama hatası kullanıcıya AYRINTISIZ döner
 * (iç yapıyı sızdırmamak için); ayrıntı yalnızca sunucu loglarına yazılır.
 */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    logger.warn('Geçersiz girdi', { issues: result.error.issues })
    throw new HttpsError('invalid-argument', 'errors.invalidInput')
  }
  return result.data
}
