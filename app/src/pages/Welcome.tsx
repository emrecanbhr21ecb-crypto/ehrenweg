/**
 * Onboarding — dil seçimi + 3 tanıtım kartı (CLAUDE.md Bölüm 9).
 *
 * Neden dil seçimi İLK ekran: kullanıcı Almanca bilmiyor olabilir ve
 * uygulamanın ilk gördüğü ekranı anlamazsa hiçbir şey yapamaz. Bu yüzden
 * dil düğmeleri metinden önce, kendi dillerinde ve her zaman görünür.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Button, Card } from '@/components/ui'
import { BRAND, SUPPORTED_LOCALES, type Locale } from '@/config/brand'
import { setLocale } from '@/i18n'

const INTRO_SLIDES = ['find', 'join', 'collect'] as const

export default function Welcome(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)

  const isLast = slide === INTRO_SLIDES.length - 1
  const current = INTRO_SLIDES[slide] ?? 'find'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <header className="mb-8 text-center">
        <p className="text-3xl font-bold tracking-tight text-primary-800 dark:text-primary-200">
          {BRAND.name}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('slogan')}
        </p>
      </header>

      <nav aria-label={t('language.label')} className="mb-8 flex justify-center gap-2">
        {SUPPORTED_LOCALES.map((code) => {
          const active = i18n.resolvedLanguage === code
          return (
            <button
              key={code}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => void setLocale(code as Locale)}
              className={[
                'min-h-11 rounded-full border px-5 text-sm font-semibold',
                active
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-gray-300 text-gray-700 dark:border-ink-700 dark:text-gray-300',
              ].join(' ')}
            >
              {t(`language.${code}` as 'language.de')}
            </button>
          )
        })}
      </nav>

      <Card className="flex flex-1 flex-col justify-center text-center">
        <p className="text-5xl" aria-hidden="true">
          {t(`onboarding.${current}.emoji` as 'onboarding.find.emoji')}
        </p>
        <h1 className="mt-5 text-xl font-semibold">
          {t(`onboarding.${current}.title` as 'onboarding.find.title')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t(`onboarding.${current}.body` as 'onboarding.find.body')}
        </p>
      </Card>

      <div
        className="my-6 flex justify-center gap-2"
        role="group"
        aria-label={t('onboarding.progress', { current: slide + 1, total: INTRO_SLIDES.length })}
      >
        {INTRO_SLIDES.map((key, index) => (
          <span
            key={key}
            className={[
              'h-2 rounded-full transition-all',
              index === slide ? 'w-6 bg-primary-700' : 'w-2 bg-gray-300 dark:bg-ink-700',
            ].join(' ')}
          />
        ))}
      </div>

      <div className="space-y-3">
        {isLast ? (
          <>
            <Button full onClick={() => void navigate('/signup')}>
              {t('onboarding.createAccount')}
            </Button>
            <Button variant="secondary" full onClick={() => void navigate('/signin')}>
              {t('onboarding.haveAccount')}
            </Button>
          </>
        ) : (
          <>
            <Button full onClick={() => setSlide((s) => s + 1)}>
              {t('action.continue')}
            </Button>
            <Button
              variant="ghost"
              full
              onClick={() => setSlide(INTRO_SLIDES.length - 1)}
            >
              {t('onboarding.skip')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
