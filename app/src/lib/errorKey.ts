/**
 * Yakalanan herhangi bir hatayı `errors` ad alanındaki bir anahtara çevirir.
 *
 * Neden ayrı dosya: kayıt akışı iki farklı sisteme dokunuyor — önce Firebase
 * Auth, sonra Firestore. 25 Eyl 2026'da Firestore'un `permission-denied`
 * hatası "Anmeldung fehlgeschlagen" (giriş başarısız) diye gösterildi ve
 * gerçek sebebi (kural dağıtılmamıştı) sakladı. Artık her kaynak kendi
 * mesajını veriyor.
 */

import { FirebaseError } from 'firebase/app'

import { AuthError, type AuthErrorKey } from '@/lib/authService'

/** Başvuru akışının reddedilme sebepleri (CLAUDE.md Bölüm 12). */
export type ApplyErrorKey =
  | 'apply.notPublished'
  | 'apply.full'
  | 'apply.deadlinePassed'
  | 'apply.alreadyApplied'
  | 'apply.started'

export type ErrorKey =
  | AuthErrorKey
  | ApplyErrorKey
  | 'profile.createFailed'
  | 'profile.loadFailed'
  | 'profile.saveFailed'
  | 'permissionDenied'
  | 'network'
  | 'generic'

const APPLY_KEYS: readonly string[] = [
  'apply.notPublished',
  'apply.full',
  'apply.deadlinePassed',
  'apply.alreadyApplied',
  'apply.started',
]

function isApplyKey(value: string): value is ApplyErrorKey {
  return APPLY_KEYS.includes(value)
}

export function resolveErrorKey(error: unknown): ErrorKey {
  if (error instanceof AuthError) return error.i18nKey

  // ApplyFailure (lib/applications.ts) mesajı zaten bir çeviri anahtarıdır.
  // `instanceof` yerine mesaja bakıyoruz: aksi hâlde errorKey → applications →
  // activities → errorKey döngüsel içe aktarması oluşurdu.
  if (error instanceof Error && isApplyKey(error.message)) return error.message

  if (error instanceof FirebaseError) {
    // Firestore/Storage hata kodları 'permission-denied', 'unavailable' gibi
    // ön eksiz gelir; Auth kodları 'auth/...' ön ekiyle gelir ve onlar
    // yukarıdaki AuthError dalında zaten çevrilmiştir.
    switch (error.code) {
      case 'permission-denied':
        return 'permissionDenied'
      case 'unavailable':
      case 'deadline-exceeded':
        return 'network'
      default:
        return 'profile.createFailed'
    }
  }

  return 'generic'
}
