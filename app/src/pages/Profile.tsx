/**
 * Profil / Integrationspass.
 *
 * Faz 1: seviye halkası, sayılar, diller, beceriler, ilgi alanları, dil/tema
 * ayarları, çıkış. Rozetler, katılım geçmişi, PDF pasaport ve DSGVO araçları
 * Faz 3/7'de eklenecek — bölümler burada yer tutmaz, çünkü boş bir "Rozetler"
 * başlığı kullanıcıya bir şey vaat edip vermemek olur.
 */

import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { LevelRing, StatTile } from '@/components/LevelRing'
import { Alert, Button, Card } from '@/components/ui'
import { CATEGORY_META } from '@/config/catalog'
import { SUPPORTED_LOCALES, type Locale } from '@/config/brand'
import { setLocale } from '@/i18n'
import { useAuth } from '@/lib/AuthProvider'
import { signOutUser } from '@/lib/authService'
import { updateUserProfile } from '@/lib/userProfile'
import { useThemeStore, type ThemePreference } from '@/stores/theme'
import { EMPTY_STATS } from '@/types/user'

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system']

export default function Profile(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, claims } = useAuth()
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  const stats = profile?.stats ?? EMPTY_STATS

  /** Dil değişince profildeki `locale` da güncellenir: e-posta/push bu alandan. */
  async function handleLocaleChange(next: Locale): Promise<void> {
    await setLocale(next)
    if (user) {
      try {
        await updateUserProfile(user.uid, { locale: next })
      } catch (error) {
        // Arayüz dili yine de değişti; kalıcı tercih bir sonraki denemede yazılır.
        console.warn('[profile] Dil tercihi kaydedilemedi:', error)
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center">
        <LevelRing stats={stats} />

        <h1 className="mt-4 text-xl font-bold">{profile?.displayName ?? ''}</h1>
        {profile?.city && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            📍 {profile.city}
          </p>
        )}
        {claims.role === 'platform_admin' && (
          <p className="mt-2 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-900">
            {t('roles.platform_admin')}
          </p>
        )}
        {profile?.bio && (
          <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
            {profile.bio}
          </p>
        )}

        <Button variant="secondary" className="mt-5" onClick={() => void navigate('/profile/edit')}>
          {t('profile.edit')}
        </Button>
      </Card>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="mb-3 text-sm font-semibold">
          {t('passport.title')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label={t('passport.ip')} value={stats.ip} emoji="⭐" />
          <StatTile label={t('passport.hours')} value={Math.round(stats.hours)} emoji="⏱️" />
          <StatTile
            label={t('passport.activities')}
            value={stats.activitiesCompleted}
            emoji="✅"
          />
        </div>
        {stats.activitiesCompleted === 0 && (
          <Alert tone="info" className="mt-3">
            {t('passport.emptyHint')}
          </Alert>
        )}
      </section>

      {profile && profile.languages.length > 0 && (
        <section aria-labelledby="languages-heading">
          <h2 id="languages-heading" className="mb-3 text-sm font-semibold">
            {t('profile.languages')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.languages.map((item) => (
              <li
                key={item.code}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-sm dark:bg-ink-800"
              >
                {t(`languages.codes.${item.code}` as 'languages.codes.de', {
                  ns: 'catalog',
                })}
                <span className="ms-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t(`languages.levels.${item.level}` as 'languages.levels.A1', {
                    ns: 'catalog',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile && profile.skills.length > 0 && (
        <section aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="mb-3 text-sm font-semibold">
            {t('profile.skills')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.skills.map((id) => (
              <li
                key={id}
                className="rounded-full bg-gray-100 px-3 py-1.5 text-sm dark:bg-ink-800"
              >
                {t(`skills.${id}` as 'skills.teamwork', { ns: 'catalog' })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile && profile.interests.length > 0 && (
        <section aria-labelledby="interests-heading">
          <h2 id="interests-heading" className="mb-3 text-sm font-semibold">
            {t('profile.interests')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.interests.map((id) => (
              <li
                key={id}
                className={`rounded-full px-3 py-1.5 text-sm ${CATEGORY_META[id].tint}`}
              >
                <span aria-hidden="true" className="me-1">
                  {CATEGORY_META[id].emoji}
                </span>
                {t(`categories.${id}` as 'categories.environment', { ns: 'catalog' })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="mb-3 text-sm font-semibold">
          {t('profile.settings')}
        </h2>
        <Card className="space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{t('language.label')}</span>
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => void handleLocaleChange(e.target.value as Locale)}
              className="min-h-11 rounded-xl border border-gray-300 bg-white px-3 dark:border-ink-700 dark:bg-ink-900"
            >
              {SUPPORTED_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {t(`language.${code}` as 'language.de')}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{t('theme.label')}</span>
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value as ThemePreference)}
              className="min-h-11 rounded-xl border border-gray-300 bg-white px-3 dark:border-ink-700 dark:bg-ink-900"
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`theme.${option}` as 'theme.light')}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('profile.accountEmail', { email: user?.email ?? '' })}
          </p>
        </Card>
      </section>

      <div className="space-y-3 pb-4">
        <Button
          variant="secondary"
          full
          onClick={() => {
            void signOutUser().then(() => navigate('/welcome', { replace: true }))
          }}
        >
          {t('auth.signOut')}
        </Button>
        <p className="text-center text-xs text-gray-400">
          <Link to="/legal" className="underline">
            {t('profile.legalLinks')}
          </Link>
        </p>
      </div>
    </div>
  )
}
