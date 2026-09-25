/**
 * Giriş yapmış kullanıcının gördüğü kabuk: üst başlık + alt menü.
 *
 * Alt menüde ortada büyük QR butonu var (CLAUDE.md Bölüm 9 "Scan"). Faz 3'e
 * kadar tarayıcı yok; buton şimdilik kapalı görünüyor ama YERİ duruyor —
 * sonradan eklenince menü düzeni değişip kullanıcının kas hafızasını bozmasın.
 */

import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import { BRAND } from '@/config/brand'

interface NavItem {
  to: string
  /** Tip güvenli i18n: gevşek string olsaydı yanlış anahtar sessizce geçerdi. */
  key: 'nav.home' | 'nav.activities' | 'nav.wallet' | 'nav.profile'
  emoji: string
  end: boolean
}

const LEFT_ITEMS: NavItem[] = [
  { to: '/', key: 'nav.home', emoji: '🏠', end: true },
  { to: '/activities', key: 'nav.activities', emoji: '🗺️', end: false },
]

const RIGHT_ITEMS: NavItem[] = [
  { to: '/wallet', key: 'nav.wallet', emoji: '🎁', end: false },
  { to: '/profile', key: 'nav.profile', emoji: '👤', end: false },
]

// NOT: "Learn" (Akademi) bilerek alt menüde değil. Ortadaki QR butonuyla
// birlikte altı sekme olurdu ve mobilde dokunma hedefleri 44px'in altına
// inerdi. Akademi'ye Faz 2'de Aktiviteler sayfasındaki tür filtresinden
// (`type: 'training'`) girilecek; /learn rotası şimdiden çalışıyor.

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

export function AppShell({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute start-2 top-2 z-50 rounded bg-primary-700 px-3 py-2 text-white"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <p className="text-lg font-bold tracking-tight text-primary-800 dark:text-primary-200">
            {BRAND.name}
          </p>
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
            <button
              type="button"
              disabled
              aria-label={t('nav.scan')}
              title={t('soon.scanTooltip')}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary-700 text-2xl text-white shadow-lg disabled:opacity-40"
            >
              <span aria-hidden="true">⛶</span>
            </button>
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
