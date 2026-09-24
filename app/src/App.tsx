/**
 * Faz 0 uygulama kabuğu.
 *
 * Amaç: Faz 0'ın bitiş ölçütü — "emülatörde seed verisiyle boş uygulama
 * açılıyor". Burada iş mantığı YOK; sadece altyapının (i18n, tema, router,
 * Firebase/emülatör bağlantısı) gerçekten ayakta olduğunu gösteren bir kabuk.
 * Faz 1'de bu ekranlar gerçek sayfalarla değiştirilecek.
 */

import { useTranslation } from 'react-i18next'
import { NavLink, Route, Routes } from 'react-router'

import { BRAND, SUPPORTED_LOCALES, type Locale } from '@/config/brand'
import { setLocale } from '@/i18n'
import { useThemeStore, type ThemePreference } from '@/stores/theme'

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system']

/** Faz 1'de gerçek sayfalarla değişecek yer tutucu. */
function Placeholder({ title }: { title: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-gray-600 dark:text-gray-400">{t('state.empty')}</p>
    </section>
  )
}

export default function App(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  const navItems = [
    { to: '/', key: 'nav.home', end: true },
    { to: '/activities', key: 'nav.activities', end: false },
    { to: '/learn', key: 'nav.learn', end: false },
    { to: '/wallet', key: 'nav.wallet', end: false },
    { to: '/profile', key: 'nav.profile', end: false },
  ] as const

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute start-2 top-2 z-50 rounded bg-primary-700 px-3 py-2 text-white"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="border-b border-gray-200 bg-primary-700 text-white dark:border-ink-800">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="me-auto">
            <p className="text-lg font-bold tracking-tight">{BRAND.name}</p>
            <p className="text-xs text-primary-100">{t('slogan')}</p>
          </div>

          <label className="flex items-center gap-1 text-sm">
            <span className="sr-only">{t('language.label')}</span>
            <select
              className="rounded bg-primary-800 px-2 py-1 text-white"
              value={i18n.resolvedLanguage}
              onChange={(e) => void setLocale(e.target.value as Locale)}
            >
              {SUPPORTED_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {t(`language.${code}` as 'language.de')}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1 text-sm">
            <span className="sr-only">{t('theme.label')}</span>
            <select
              className="rounded bg-primary-800 px-2 py-1 text-white"
              value={preference}
              onChange={(e) => setPreference(e.target.value as ThemePreference)}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`theme.${option}` as 'theme.light')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<Placeholder title={t('nav.home')} />} />
          <Route
            path="/activities"
            element={<Placeholder title={t('nav.activities')} />}
          />
          <Route path="/learn" element={<Placeholder title={t('nav.learn')} />} />
          <Route
            path="/wallet"
            element={<Placeholder title={t('nav.wallet')} />}
          />
          <Route
            path="/profile"
            element={<Placeholder title={t('nav.profile')} />}
          />
          <Route path="*" element={<Placeholder title={t('nav.home')} />} />
        </Routes>
      </main>

      <nav
        aria-label={t('a11y.mainNavigation')}
        className="sticky bottom-0 border-t border-gray-200 bg-white dark:border-ink-800 dark:bg-ink-900"
      >
        <ul className="mx-auto flex max-w-3xl">
          {navItems.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'block py-3 text-center text-xs font-medium',
                    isActive
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-gray-500 dark:text-gray-400',
                  ].join(' ')
                }
              >
                {t(item.key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
