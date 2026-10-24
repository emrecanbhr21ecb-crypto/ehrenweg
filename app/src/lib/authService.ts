/**
 * Firebase Auth işlemleri — kayıt, giriş, doğrulama, şifre sıfırlama.
 *
 * Buradaki her fonksiyon Firebase'in `auth/...` hata kodunu i18n anahtarına
 * çevirir (`errors.json`). Ham İngilizce Firebase mesajı kullanıcıya ASLA
 * gösterilmez — hedef kitle Almanca/İngilizce okur, hata metni de o dilde
 * olmalı (CLAUDE.md Bölüm 11).
 */

import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'

import { auth } from '@/lib/firebase'
import {
  DEFAULT_CLAIMS,
  type OrgRole,
  type PlatformRole,
  type UserClaims,
} from '@/types/user'

/**
 * Kullanıcıya gösterilecek, i18n anahtarı taşıyan hata.
 *
 * `i18nKey` gevşek `string` DEĞİL: tip güvenli i18n sayesinde var olmayan bir
 * anahtar yazılırsa derleme kırılır (i18n/i18next.d.ts).
 *
 * Not: alanlar constructor parametresi olarak değil açıkça tanımlı —
 * tsconfig'de `erasableSyntaxOnly` açık ve parametre özelliklerine izin vermiyor.
 */
export type AuthErrorKey =
  | 'auth.emailInUse'
  | 'auth.invalidEmail'
  | 'auth.weakPassword'
  | 'auth.invalidCredential'
  | 'auth.userDisabled'
  | 'auth.tooManyRequests'
  | 'auth.network'
  | 'auth.popupClosed'
  | 'auth.popupBlocked'
  | 'auth.differentProvider'
  | 'auth.providerDisabled'
  | 'auth.requiresRecentLogin'
  | 'auth.notSignedIn'
  | 'auth.unknown'

export class AuthError extends Error {
  /** `errors` ad alanındaki anahtar, ör. 'auth.emailInUse' */
  readonly i18nKey: AuthErrorKey
  readonly code: string

  constructor(i18nKey: AuthErrorKey, code: string) {
    super(`${code} → ${i18nKey}`)
    this.name = 'AuthError'
    this.i18nKey = i18nKey
    this.code = code
  }
}

/**
 * Firebase hata kodu → i18n anahtarı.
 *
 * Güvenlik notu: 'user-not-found' ve 'wrong-password' aynı anahtara düşer.
 * Ayırmak, bir e-postanın sistemde kayıtlı olup olmadığını sızdırır
 * (kullanıcı sayımı / hedefli kimlik avı). Firebase de yeni sürümlerde bu
 * yüzden 'invalid-credential' döndürüyor.
 */
const ERROR_MAP: Record<string, AuthErrorKey> = {
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/weak-password': 'auth.weakPassword',
  'auth/user-not-found': 'auth.invalidCredential',
  'auth/wrong-password': 'auth.invalidCredential',
  'auth/invalid-credential': 'auth.invalidCredential',
  'auth/user-disabled': 'auth.userDisabled',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/network-request-failed': 'auth.network',
  'auth/popup-closed-by-user': 'auth.popupClosed',
  'auth/popup-blocked': 'auth.popupBlocked',
  'auth/account-exists-with-different-credential': 'auth.differentProvider',
  'auth/operation-not-allowed': 'auth.providerDisabled',
  'auth/requires-recent-login': 'auth.requiresRecentLogin',
}

function toAuthError(error: unknown): AuthError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'unknown'

  return new AuthError(ERROR_MAP[code] ?? 'auth.unknown', code)
}

/** Şifre kuralı — Firebase 6 karakter ister, biz 8 istiyoruz. */
export const MIN_PASSWORD_LENGTH = 8

export interface SignUpInput {
  email: string
  password: string
  displayName: string
}

export async function signUpWithEmail({
  email,
  password,
  displayName,
}: SignUpInput): Promise<User> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
    const name = displayName.trim()
    if (name) await updateProfile(user, { displayName: name })
    await sendEmailVerification(user)
    return user
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password)
    return user
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  // Hesap seçiciyi her seferinde göster: paylaşılan cihazlarda (kurum tableti,
  // kütüphane bilgisayarı) önceki kullanıcıyla sessizce giriş yapılmasın.
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    const { user } = await signInWithPopup(auth, provider)
    return user
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AuthError('auth.notSignedIn', 'auth/no-current-user')
  try {
    await sendEmailVerification(user)
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

/**
 * Oturumu tazeler — Firebase hassas işlemler için (hesap silme) "yakın
 * zamanda giriş yapılmış" ister, yoksa `auth/requires-recent-login` atar.
 *
 * E-posta/şifre hesabında şifre tekrar istenir; Google ile girende hesap
 * seçici tekrar açılır (şifre Firebase'de hiç saklanmaz).
 */
export async function reauthenticate(password?: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AuthError('auth.notSignedIn', 'auth/no-current-user')

  const providerId = user.providerData[0]?.providerId
  try {
    if (providerId === 'google.com') {
      await reauthenticateWithPopup(user, new GoogleAuthProvider())
      return
    }
    if (!password)
      throw new AuthError('auth.requiresRecentLogin', 'auth/requires-recent-login')
    const credential = EmailAuthProvider.credential(user.email ?? '', password)
    await reauthenticateWithCredential(user, credential)
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw toAuthError(error)
  }
}

/**
 * DSGVO Art. 17 — Auth hesabını siler. Firestore tarafı (profil, kurum
 * üyeliği, iz bırakan alanlar) ÖNCE `lib/privacy.ts` ile temizlenmelidir:
 * hesap burada silinince `request.auth` kaybolur ve kalan Firestore
 * yazmaları artık yapılamaz hâle gelir.
 */
export async function deleteAuthAccount(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AuthError('auth.notSignedIn', 'auth/no-current-user')
  try {
    await deleteUser(user)
  } catch (error) {
    throw toAuthError(error)
  }
}

/**
 * Custom claim'leri okur.
 *
 * `forceRefresh` yeni verilen rolün hemen görünmesi için gerekir; token
 * normalde bir saat yaşar ve admin rol verdikten sonra kullanıcı bir saat
 * boyunca eski yetkiyle dolaşırdı.
 */
export async function readClaims(
  user: User,
  forceRefresh = false,
): Promise<UserClaims> {
  const token = await user.getIdTokenResult(forceRefresh)
  const raw = token.claims

  const role = raw['role']
  const orgs = raw['orgs']

  return {
    role: isPlatformRole(role) ? role : DEFAULT_CLAIMS.role,
    orgs: isOrgMap(orgs) ? orgs : {},
    emailVerified: user.emailVerified,
  }
}

function isPlatformRole(value: unknown): value is PlatformRole {
  return value === 'participant' || value === 'trainer' || value === 'platform_admin'
}

function isOrgMap(value: unknown): value is Record<string, OrgRole> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(
    (role) =>
      role === 'org_admin' || role === 'org_staff' || role === 'redemption_officer',
  )
}

/** Oturum durumu aboneliği — AuthProvider dışında kullanılmamalı. */
export function watchAuthState(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, onChange)
}

export { auth }
