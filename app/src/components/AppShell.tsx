/**
 * Giriş yapmış kullanıcının gördüğü kabuk: üst başlık + alt menü.
 *
 * Alt menü CLAUDE.md Bölüm 9'daki sırayı izler:
 *   Home · Activities · [Scan] · Learn · Profile
 * Ortadaki büyük QR butonu Faz 3'te devreye girdi; bekleyen çevrimdışı
 * tarama varsa üstünde sayı rozeti çıkar.
 *
 * Wallet, Kurum ve Yönetim üst başlıktaki hızlı erişimde: alt menüye altıncı
 * öğe koymak mobilde dokunma hedefini 44px'in altına düşürürdü. Kurum ve
 * Yönetim yalnızca o rol custom claim'de varsa görünür (CLAUDE.md Bölüm 14
 * kural 2: yetki kararı claim'den okunur, Firestore'daki alandan değil).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { BRAND } from '@/config/brand'
import { useAuth } from '@/lib/AuthProvider'
import { subscribeQueue } from '@/lib/scanQueue'

interface NavItem {
  to: string
  /** Tip güvenli i18n: gevşek string olsaydı yanlış anahtar sessizce geçerdi. */
  key: 'nav.home' | 'nav.activities' | 'nav.learn' | 'nav.profile'
  emoji: string
  end: boolean
}

const LEFT_ITEMS: NavItem[] = [
  { to: '/', key: 'nav.home', emoji: '🏠', end: true },
  { to: '/activities', key: 'nav.activities', emoji: '🗺️', end: false },
]

const RIGHT_ITEMS: NavItem[] = [
  { to: '/learn', key: 'nav.learn', emoji: '🎓', end: false },
  { to: '/profile', key: 'nav.profile', emoji: '👤', end: false },
]

function TabLink({ item }: { item: NavItem }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
          isActive
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-gray-500 dark:text-gray-400',
        ].join(' ')
      }
    >
      <span aria-hidden="true" className="text-lg">
        {item.emoji}
      </span>
      {t(item.key)}
    </NavLink>
  )
}

/** Başlıktaki ikon bağlantısı — Wallet, Kurum, Yönetim. */
function HeaderLink({
  to,
  label,
  emoji,
}: {
  to: string
  label: string
  emoji: string
}): React.JSX.Element {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        [
          'flex size-11 items-center justify-center rounded-full text-lg',
          isActive ? 'bg-primary-100 dark:bg-primary-950' : '',
        ].join(' ')
      }
    >
      <span aria-hidden="true">{emoji}</span>
    </NavLink>
  )
}

export function AppShell({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  const { claims, orgRoles } = useAuth()

  // Bekleyen çevrimdışı tarama sayısı — kullanıcı taramasının kaybolmadığını
  // her ekranda görsün (CLAUDE.md Bölüm 9: "çevrimdışı kuyruk göstergesi").
  const [queued, setQueued] = useState(0)
  useEffect(() => subscribeQueue(setQueued), [])

  const isAdmin = claims.role === 'platform_admin'
  // Kurum rolü claim'de VEYA üyelik belgesinde olabilir (docs/DECISIONS.md §8).
  const hasOrgRole = Object.keys(orgRoles).length > 0

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute start-2 top-2 z-50 rounded bg-primary-700 px-3 py-2 text-white"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
        <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 py-2">
          <NavLink
            to="/"
            className="me-auto px-1 text-lg font-bold tracking-tight text-primary-800 dark:text-primary-200"
          >
            {BRAND.name}
          </NavLink>

          <HeaderLink to="/wallet" label={t('nav.wallet')} emoji="🎁" />
          {hasOrgRole && <HeaderLink to="/org" label={t('nav.org')} emoji="🏛️" />}
          {isAdmin && <HeaderLink to="/admin" label={t('nav.admin')} emoji="🛡️" />}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        {children}
      </main>

      <nav
        aria-label={t('a11y.mainNavigation')}
        className="sticky bottom-0 border-t border-gray-200 bg-white dark:border-ink-800 dark:bg-ink-900"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-5 items-center">
          {LEFT_ITEMS.map((item) => (
            <li key={item.to}>
              <TabLink item={item} />
            </li>
          ))}

          <li className="flex justify-center">
            <NavLink
              to="/scan"
              aria-label={t('nav.scan')}
              className="relative -mt-6 flex size-14 items-center justify-center rounded-full bg-primary-700 text-2xl text-white shadow-lg"
            >
              <span aria-hidden="true">⛶</span>
              {queued > 0 && (
                <span className="absolute -end-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-accent-500 px-1.5 text-xs font-bold text-ink-950">
                  {queued}
                </span>
              )}
            </NavLink>
          </li>

          {RIGHT_ITEMS.map((item) => (
            <li key={item.to}>
              <TabLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
