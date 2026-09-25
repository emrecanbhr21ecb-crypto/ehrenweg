/**
 * Oturum bağlamı — tüm uygulamanın "kim giriş yapmış" tek kaynağı.
 *
 * Sağladığı şeyler:
 *  - `user`      Firebase Auth kullanıcısı (null = çıkış yapılmış)
 *  - `claims`    custom claim'lerden okunan roller (YETKİ KARARI BUNDAN verilir)
 *  - `profile`   users/{uid} belgesi, canlı dinlenir
 *  - `status`    'loading' | 'signedOut' | 'ready'
 *
 * Neden tek yerde: rol bilgisi iki farklı yerden okunursa biri eskir ve
 * ekranın bir yarısı admin, diğer yarısı katılımcı gibi davranır.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { User } from 'firebase/auth'

import { readClaims, watchAuthState } from '@/lib/authService'
import { watchMyMemberships } from '@/lib/organizations'
import { ensureUserProfile, touchLastActive, watchUserProfile } from '@/lib/userProfile'
import type { OrgMember, OrgRole } from '@/types/activity'
import { DEFAULT_CLAIMS, type UserClaims, type UserDoc } from '@/types/user'

export type AuthStatus = 'loading' | 'signedOut' | 'ready'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  claims: UserClaims
  profile: UserDoc | null
  /**
   * Kullanıcının kurum üyelikleri — `organizations/{orgId}/members/{uid}`.
   *
   * ⚠️ Neden claim'in yanında: claim'i yalnız sunucu yazabiliyor, Blaze kapalı
   * olduğu için sunucu yok (docs/DECISIONS.md §8). Kurum rolü bu yüzden üyelik
   * belgesinden okunuyor; `firestore.rules` de aynı iki kaynağa bakıyor.
   */
  memberships: OrgMember[]
  /** claim ∪ üyelik belgeleri — yetki kararı buradan verilir. */
  orgRoles: Record<string, OrgRole>
  /** Profil belgesi henüz okunmadıysa true (oturum var ama veri yolda). */
  profileLoading: boolean
  /** Firestore profil dinlemesi hata verdiyse i18n anahtarı. */
  profileError: string | null
  /** E-posta doğrulandıktan sonra token'ı tazelemek için. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<UserClaims>(DEFAULT_CLAIMS)
  const [profile, setProfile] = useState<UserDoc | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<OrgMember[]>([])

  // Profil aboneliği kullanıcı değişince kapatılmalı; ref'te tutuyoruz ki
  // iki farklı etki (auth + profil) birbirini iptal etmesin.
  const unsubProfile = useRef<(() => void) | null>(null)
  const unsubMemberships = useRef<(() => void) | null>(null)

  useEffect(() => {
    return watchAuthState((nextUser) => {
      setUser(nextUser)

      unsubProfile.current?.()
      unsubProfile.current = null
      unsubMemberships.current?.()
      unsubMemberships.current = null

      if (!nextUser) {
        setClaims(DEFAULT_CLAIMS)
        setProfile(null)
        setMemberships([])
        setProfileLoading(false)
        setProfileError(null)
        setStatus('signedOut')
        return
      }

      // Kurum üyelikleri profilden bağımsız dinlenir: profil belgesi
      // gelmemiş olsa bile kurum paneli erişimi doğru hesaplansın.
      unsubMemberships.current = watchMyMemberships(
        nextUser.uid,
        setMemberships,
        (error) => {
          // Üyelik sorgusu düşerse kullanıcı yalnızca kurum panelini göremez;
          // uygulamanın kalanı çalışmaya devam etmeli.
          console.error('[auth] Kurum üyelikleri okunamadı:', error)
          setMemberships([])
        },
      )

      setProfileLoading(true)
      setProfileError(null)
      setStatus('ready')

      void readClaims(nextUser).then(setClaims)

      // Belge yoksa oluştur, sonra canlı dinlemeye geç. Google ile ilk girişte
      // belge henüz yoktur; e-posta kaydında SignUp ekranı zaten oluşturur ama
      // ağ koptuysa burada telafi edilir.
      void ensureUserProfile(nextUser)
        .then(() => {
          unsubProfile.current = watchUserProfile(
            nextUser.uid,
            (next) => {
              setProfile(next)
              setProfileLoading(false)
            },
            (error) => {
              console.error('[auth] Profil dinlenemedi:', error)
              setProfileError('profile.loadFailed')
              setProfileLoading(false)
            },
          )
          void touchLastActive(nextUser.uid)
        })
        .catch((error: unknown) => {
          console.error('[auth] Profil oluşturulamadı:', error)
          setProfileError('profile.createFailed')
          setProfileLoading(false)
        })
    })
  }, [])

  useEffect(() => {
    return () => {
      unsubProfile.current?.()
      unsubMemberships.current?.()
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    const current = user
    if (!current) return
    await current.reload()
    setClaims(await readClaims(current, true))
    // reload() aynı nesneyi günceller; React'in yeniden çizmesi için kopya.
    setUser(Object.assign(Object.create(Object.getPrototypeOf(current)), current))
  }, [user])

  const orgRoles = useMemo<Record<string, OrgRole>>(() => {
    const merged: Record<string, OrgRole> = { ...claims.orgs }
    for (const member of memberships) {
      // Claim varsa o kazanır: sunucu yazdığı için daha güvenilir kaynaktır.
      if (!merged[member.orgId]) merged[member.orgId] = member.role
    }
    return merged
  }, [claims.orgs, memberships])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      claims,
      profile,
      memberships,
      orgRoles,
      profileLoading,
      profileError,
      refresh,
    }),
    [
      status,
      user,
      claims,
      profile,
      memberships,
      orgRoles,
      profileLoading,
      profileError,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('[auth] useAuth yalnızca <AuthProvider> içinde kullanılır.')
  }
  return context
}
