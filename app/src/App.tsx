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

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router'

import { AppShell } from '@/components/AppShell'
import { FullPageLoader } from '@/components/ui'
import { useAuth } from '@/lib/AuthProvider'
import { demoAutoLoginPending, tryDemoAutoLogin } from '@/lib/demoAutoLogin'
import Activities from '@/pages/Activities'
import ActivityDetail from '@/pages/ActivityDetail'
import AdminPanel from '@/pages/admin/AdminPanel'
import Home from '@/pages/Home'
import { LegalIndex, LegalPageView } from '@/pages/Legal'
import ActivityForm from '@/pages/org/ActivityForm'
import OrgApplicants from '@/pages/org/OrgApplicants'
import OrgApply from '@/pages/org/OrgApply'
import AttendanceSession from '@/pages/org/AttendanceSession'
import LateScans from '@/pages/org/LateScans'
import OrgPanel from '@/pages/org/OrgPanel'
import { Learn, Wallet } from '@/pages/Placeholder'
import Profile from '@/pages/Profile'
import Scan from '@/pages/Scan'
import ProfileEdit from '@/pages/ProfileEdit'
import ProfileSetup from '@/pages/ProfileSetup'
import SignIn from '@/pages/SignIn'
import SignUp from '@/pages/SignUp'
import VerifyEmail from '@/pages/VerifyEmail'
import Welcome from '@/pages/Welcome'
import { isProfileComplete } from '@/types/user'

/**
 * Oturum gerektirmeyen yollar.
 *
 * `/legal` ve altındaki sayfalar bilerek herkese açık: Impressum'a ancak giriş
 * yaparak ulaşılabilseydi TMG §5'in "kolay erişilebilir" şartı karşılanmazdı.
 */
const PUBLIC_PATHS = ['/welcome', '/signin', '/signup']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/legal')
}

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const { status, user, profile, profileLoading, claims } = useAuth()

  // Demo yapısı: oturum yoksa hazır hesapla gir (lib/demoAutoLogin.ts).
  // Bayrak kapalıyken bu etki hiçbir şey yapmaz.
  useEffect(() => {
    if (status === 'signedOut') void tryDemoAutoLogin()
  }, [status])

  const isAdmin = claims.role === 'platform_admin'

  // 1. Oturum henüz çözülmedi. Demo yapısında ilk açılıştaki otomatik giriş de
  //    burada beklenir — kullanıcı bir an karşılama ekranını görüp sonra
  //    içeri atlamasın. Çıkış yaptıktan sonra `demoAutoLoginPending()` false
  //    olur ve normal karşılama/kayıt akışı devreye girer; aksi hâlde ekran
  //    sonsuza kadar dönerdi (çıkış da 'signedOut' durumu üretiyor).
  if (status === 'loading' || (status === 'signedOut' && demoAutoLoginPending())) {
    return <FullPageLoader label={t('state.loading')} />
  }

  const isPublic = isPublicPath(location.pathname)

  // 2. Oturum yok.
  if (status === 'signedOut' || !user) {
    if (!isPublic) return <Navigate to="/welcome" replace />
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/legal"
          element={
            <div className="mx-auto max-w-2xl px-5 py-8">
              <LegalIndex />
            </div>
          }
        />
        <Route
          path="/legal/:page"
          element={
            <div className="mx-auto max-w-2xl px-5 py-8">
              <LegalPageView />
            </div>
          }
        />
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
  //    ana sayfaya al — geri tuşuyla kayıt ekranına düşmesin. (Hukuki sayfalar
  //    hariç: onlara giriş yapmışken de ulaşılabilmeli.)
  const isEntryPath =
    PUBLIC_PATHS.includes(location.pathname) ||
    location.pathname === '/setup' ||
    location.pathname === '/verify-email'

  if (isEntryPath) return <Navigate to="/" replace />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/:activityId" element={<ActivityDetail />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/legal" element={<LegalIndex />} />
        <Route path="/legal/:page" element={<LegalPageView />} />

        {/* Kurum paneli herkese açık bir KAPIDIR: üyesi olmayan kullanıcı
            burada "organizasyon anmelden" davetini görür. Asıl koruma
            firestore.rules tarafında — panel görünse bile üye olmayan
            kullanıcı hiçbir kurum verisini okuyup yazamaz. */}
        <Route path="/org" element={<OrgPanel />} />
        <Route path="/org/apply" element={<OrgApply />} />
        <Route path="/org/activities/new" element={<ActivityForm />} />
        <Route path="/org/activities/:activityId/edit" element={<ActivityForm />} />
        <Route
          path="/org/activities/:activityId/applicants"
          element={<OrgApplicants />}
        />
        <Route
          path="/org/activities/:activityId/attendance"
          element={<AttendanceSession />}
        />
        <Route path="/org/activities/:activityId/late-scans" element={<LateScans />} />

        {/* Yönetim yalnız platform_admin claim'iyle; menüde gizlemek yetmez,
            adres çubuğuna elle yazan kullanıcı da girememeli. */}
        {isAdmin && <Route path="/admin" element={<AdminPanel />} />}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
