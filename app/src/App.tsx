/**
 * Uygulama kabuğu ve yönlendirme.
 *
 * Kapı sırası (bozulursa kullanıcı yanlış ekranda kilitlenir):
 *   1. Oturum çözülüyor            → tam sayfa yükleniyor
 *   2. Oturum yok                  → /welcome, /signin, /signup dışı her şey /welcome'a
 *   3. E-posta doğrulanmamış       → /verify-email  (Google girişi zaten doğrulanmış gelir)
 *   4. Profil eksik                → /setup
 *   5. Hepsi tamam                 → alt menülü ana uygulama
 */

import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { FullPageLoader } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import Home from '@/pages/Home'
import { Activities, Learn, Legal, Wallet } from '@/pages/Placeholder'
import Profile from '@/pages/Profile'
import ProfileEdit from '@/pages/ProfileEdit'
import ProfileSetup from '@/pages/ProfileSetup'
import SignIn from '@/pages/SignIn'
import SignUp from '@/pages/SignUp'
import VerifyEmail from '@/pages/VerifyEmail'
import Welcome from '@/pages/Welcome'
import { isProfileComplete } from '@/types/user'

/** Oturum gerektirmeyen yollar. */
const PUBLIC_PATHS = ['/welcome', '/signin', '/signup', '/legal']

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { status, user, profile, profileLoading } = useAuth()

  // 1. Oturum henüz çözülmedi.
  if (status === 'loading') {
    return <FullPageLoader label={t('state.loading')} />
  }

  const isPublic = PUBLIC_PATHS.includes(location.pathname)

  // 2. Oturum yok.
  if (status === 'signedOut' || !user) {
    if (!isPublic) return <Navigate to="/welcome" replace />
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/legal" element={<div className="mx-auto max-w-md px-5 py-8"><Legal /></div>} />
      </Routes>
    )
  }

  // 3. E-posta doğrulanmamış. (Bu kontrol yalnız parola ile kayıt olanlar için
  //    tetiklenir; Google sağlayıcısı emailVerified=true ile gelir.)
  if (!user.emailVerified) {
    if (location.pathname !== '/verify-email') {
      return <Navigate to="/verify-email" replace />
    }
    return (
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    )
  }

  // 4. Profil belgesi hâlâ yolda — boş ekran yerine yükleniyor.
  if (profileLoading && !profile) {
    return <FullPageLoader label={t('state.loading')} />
  }

  // 5. Profil eksik → kurulum.
  if (!isProfileComplete(profile)) {
    if (location.pathname !== '/setup') return <Navigate to="/setup" replace />
    return (
      <Routes>
        <Route path="/setup" element={<ProfileSetup />} />
      </Routes>
    )
  }

  // 6. Her şey tamam. Giriş/karşılama yollarına dönmeye çalışan kullanıcıyı
  //    ana sayfaya al — geri tuşuyla kayıt ekranına düşmesin.
  if (isPublic || location.pathname === '/setup' || location.pathname === '/verify-email') {
    if (location.pathname !== '/legal') return <Navigate to="/" replace />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
