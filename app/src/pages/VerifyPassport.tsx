/**
 * Herkese açık doğrulama sayfası — `https://ehrenweg.de/verify/{id}`.
 *
 * CLAUDE.md Bölüm 1A ve Bölüm 9: PDF pasaporttaki QR'ı okutan bir işveren
 * ya da kurum çalışanı Ehrenweg hesabı OLMADAN buraya düşer (bkz. App.tsx
 * `PUBLIC_PATHS`). Bu yüzden AppShell'in dışında, bağımsız bir sayfa.
 *
 * Gösterilen veri BİLEREK özet: tam katılım geçmişi, beceri listesi ve
 * fotoğraf burada YOK, yalnız PDF'in kendisinde (CLAUDE.md Bölüm 9: "kişisel
 * veriyi en az düzeyde tutsun").
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { BRAND } from '@/config/brand'
import { formatDate } from '@/lib/format'
import { fetchVerification, type VerificationDoc } from '@/lib/verification'

type State = 'loading' | 'found' | 'notFound' | 'error'

export default function VerifyPassport(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const [state, setState] = useState<State>('loading')
  const [record, setRecord] = useState<VerificationDoc | null>(null)

  useEffect(() => {
    if (!id) {
      setState('notFound')
      return
    }
    let cancelled = false
    void fetchVerification(id)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setState('notFound')
          return
        }
        setRecord(result)
        setState('found')
        void i18n.changeLanguage(result.locale)
      })
      .catch((error: unknown) => {
        console.error('[verify] Belge okunamadı:', error)
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [id, i18n])

  const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'de'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-5 py-10 dark:bg-ink-950">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <p className="text-center text-lg font-bold text-primary-800 dark:text-primary-200">
          {BRAND.name}
        </p>

        {state === 'loading' && (
          <p className="mt-6 text-center text-sm text-gray-500">{t('state.loading')}</p>
        )}

        {state === 'notFound' && (
          <div className="mt-6 text-center">
            <p className="text-3xl" aria-hidden="true">
              ❓
            </p>
            <p className="mt-2 font-semibold">{t('verify.notFoundTitle')}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('verify.notFoundBody')}
            </p>
          </div>
        )}

        {state === 'error' && (
          <p className="mt-6 text-center text-sm text-red-600">{t('verify.error')}</p>
        )}

        {state === 'found' && record && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-3xl" aria-hidden="true">
              ✅
            </p>
            <p className="font-semibold">{t('verify.validTitle')}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('verify.validBody')}
            </p>

            <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-100 text-start text-sm dark:divide-ink-800 dark:border-ink-800">
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-gray-500 dark:text-gray-400">{t('verify.name')}</dt>
                <dd className="font-medium">{record.displayName}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t('passport.level')}
                </dt>
                <dd className="font-medium">
                  {t(`levels.${record.level}` as 'levels.1')}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t('passport.hours')}
                </dt>
                <dd className="font-medium tabular-nums">{Math.round(record.hours)}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-gray-500 dark:text-gray-400">
                  {t('passport.activities')}
                </dt>
                <dd className="font-medium tabular-nums">
                  {record.activitiesCompleted}
                </dd>
              </div>
            </dl>

            <p className="text-xs text-gray-400">
              {t('verify.snapshotNote', {
                date: record.issuedAt
                  ? formatDate(record.issuedAt.toDate(), locale)
                  : '—',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
