/**
 * Integrationspass ayrıntısı — CLAUDE.md Bölüm 9, item 9.
 *
 * Rozetler, kategori dağılımı ve katılım geçmişi. Seviye halkası ve sayı
 * kartları Profile ekranında zaten var; burası onun altındaki katman.
 *
 * Rozetler Firestore'da SAKLANMIYOR, pasaport girdilerinden hesaplanıyor —
 * gerekçe: config/scoring.ts `earnedBadges`.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QrCode } from '@/components/QrCode'
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui'
import { BRAND, type Locale } from '@/config/brand'
import { CATEGORY_META } from '@/config/catalog'
import { BADGE_EMOJI, earnedBadges, type BadgeId } from '@/config/scoring'
import { useAuth } from '@/lib/AuthProvider'
import { formatDate } from '@/lib/format'
import { fetchOrganization } from '@/lib/organizations'
import { passportSummary, watchMyPassport } from '@/lib/passport'
import { renderShareCard, shareCard } from '@/lib/shareCard'
import { createVerification } from '@/lib/verification'
import { restrictionEndsAt } from '@/types/user'
import type { PassportEntry } from '@/types/attendance'

export function PassportDetails(): React.JSX.Element {
  const { t, i18n } = useTranslation(['attendance', 'catalog', 'common'])
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const { user, profile } = useAuth()

  const [entries, setEntries] = useState<PassportEntry[] | null>(null)

  useEffect(() => {
    if (!user) return
    return watchMyPassport(user.uid, setEntries, (caught) => {
      console.error('[passport] Girdiler okunamadı:', caught)
      setEntries([])
    })
  }, [user])

  const summary = useMemo(() => passportSummary(entries ?? []), [entries])

  const badges = useMemo<BadgeId[]>(
    () =>
      earnedBadges({
        activitiesCompleted: profile?.stats.activitiesCompleted ?? 0,
        categoryIds: summary.categoryIds,
        languageCount: summary.languageCount,
        topOrgCount: summary.topOrgCount,
        isTrainer: profile?.trainerStatus === 'approved',
      }),
    [profile, summary],
  )

  const restriction = restrictionEndsAt(profile)
  const noShows = profile?.stats.noShows ?? 0

  // --- PDF pasaport + karne (CLAUDE.md Bölüm 9, Faz 7) ----------------------

  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [printToken, setPrintToken] = useState<string | null>(null)
  const [orgNames, setOrgNames] = useState<Map<string, string>>(new Map())
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const skillsGained = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of entries ?? []) {
      for (const skill of entry.skillsGained) ids.add(skill)
    }
    return [...ids]
  }, [entries])

  async function handleDownloadPdf(): Promise<void> {
    if (!profile) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      const [token, names] = await Promise.all([
        createVerification(profile.displayName, profile.stats, locale),
        Promise.all(
          [...new Set((entries ?? []).map((entry) => entry.orgId))].map(
            async (orgId) =>
              [orgId, (await fetchOrganization(orgId))?.name ?? ''] as const,
          ),
        ),
      ])
      setOrgNames(new Map(names))
      setPrintToken(token)
      // Yazdırma alanı bir sonraki çizimde DOM'a girer; QR canvas'ının
      // (QrCode bileşeni) çizilmesi için bir kare bekleniyor.
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    } catch (caught) {
      console.error('[passport] PDF hazırlanamadı:', caught)
      setPdfError(t('common:passport.pdfFailed'))
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleShareCard(): Promise<void> {
    if (!profile) return
    setShareBusy(true)
    setShareError(null)
    try {
      const blob = await renderShareCard({
        displayName: profile.displayName,
        levelName: t(`common:levels.${profile.stats.level}` as 'common:levels.1'),
        hours: profile.stats.hours,
        activitiesCompleted: profile.stats.activitiesCompleted,
        ip: profile.stats.ip,
        locale,
      })
      await shareCard(blob, profile.displayName)
    } catch (caught) {
      console.error('[passport] Karne paylaşılamadı:', caught)
      setShareError(t('common:passport.shareCardFailed'))
    } finally {
      setShareBusy(false)
    }
  }

  if (entries === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6 text-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başvuru kısıtı — nazik dille (CLAUDE.md Bölüm 6) */}
      {restriction && (
        <Alert tone="warning">
          <strong className="block">{t('attendance:noShow.restrictedTitle')}</strong>
          {t('attendance:noShow.restrictedBody', {
            date: formatDate(restriction, locale),
          })}
        </Alert>
      )}

      {!restriction && noShows > 0 && (
        <Alert tone="info">
          <strong className="block">{t('attendance:noShow.userWarningTitle')}</strong>
          {t('attendance:noShow.userWarningBody', { count: noShows })}
        </Alert>
      )}

      {/* Rozetler */}
      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="mb-3 text-sm font-semibold">
          {t('attendance:passport.badgesTitle')}
        </h2>

        {badges.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:passport.badgesEmpty')}
          </Card>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {badges.map((badge) => (
              <li
                key={badge}
                className="rounded-2xl bg-gray-50 p-3 text-center dark:bg-ink-800/60"
              >
                <p className="text-2xl" aria-hidden="true">
                  {BADGE_EMOJI[badge]}
                </p>
                <p className="mt-1 text-[11px] leading-tight font-medium">
                  {t(`attendance:badge.${badge}`)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Kategori dağılımı */}
      {summary.byCategory.length > 0 && (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-3 text-sm font-semibold">
            {t('attendance:passport.categoriesTitle')}
          </h2>
          <Card className="space-y-3">
            {summary.byCategory.map((row) => {
              const share =
                summary.byCategory[0] && summary.byCategory[0].count > 0
                  ? (row.count / summary.byCategory[0].count) * 100
                  : 0
              return (
                <div key={row.categoryId}>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      <span aria-hidden="true" className="me-1">
                        {CATEGORY_META[row.categoryId].emoji}
                      </span>
                      {t(`catalog:categories.${row.categoryId}`)}
                    </span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-400">
                      {row.count} ·{' '}
                      {t('attendance:passport.hoursShort', {
                        count: Math.round(row.hours),
                      })}
                    </span>
                  </div>
                  {/* Çubuk dekoratif; sayı zaten yukarıda yazıyor. */}
                  <div
                    aria-hidden="true"
                    className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-ink-800"
                  >
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${Math.max(8, share)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {/* Katılım geçmişi */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-sm font-semibold">
          {t('attendance:passport.historyTitle')}
        </h2>

        {entries.length === 0 ? (
          <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('attendance:passport.historyEmpty')}
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="px-5">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.activityTitle}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span aria-hidden="true">
                        {CATEGORY_META[entry.categoryId].emoji}{' '}
                      </span>
                      {t(`catalog:categories.${entry.categoryId}`)}
                      {entry.approvedAt &&
                        ` · ${formatDate(entry.approvedAt.toDate(), locale)}`}
                    </p>
                    {entry.source === 'admin' && (
                      <Badge tone="neutral" className="mt-1">
                        {t('attendance:passport.sourceAdmin')}
                      </Badge>
                    )}
                  </div>

                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold tabular-nums">
                      {t('attendance:passport.pointsShort', { count: entry.ipAwarded })}
                    </p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      {t('attendance:passport.hoursShort', { count: entry.hours })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* PDF pasaport + paylaşılabilir karne (Faz 7) */}
      <section aria-labelledby="pdf-heading" className="print:hidden">
        <h2 id="pdf-heading" className="mb-3 text-sm font-semibold">
          {t('common:passport.pdfDownload')}
        </h2>
        {pdfError && <Alert tone="error">{pdfError}</Alert>}
        {shareError && <Alert tone="error">{shareError}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={pdfBusy}
            onClick={() => void handleDownloadPdf()}
          >
            📄{' '}
            {pdfBusy
              ? t('common:passport.pdfGenerating')
              : t('common:passport.pdfDownload')}
          </Button>
          <Button
            variant="secondary"
            loading={shareBusy}
            onClick={() => void handleShareCard()}
          >
            📤 {t('common:passport.shareCard')}
          </Button>
        </div>
      </section>

      {/* Yazdırma/"PDF'e kaydet" alanı — ekranda gizli, yalnız print çıktısında
          görünür (styles/theme.css `.print-area`). */}
      {printToken && profile && (
        <div className="print-area hidden p-10 print:block">
          <div
            className="flex items-center justify-between border-b-4 pb-4"
            style={{ borderColor: BRAND.colors.primary }}
          >
            <div>
              <p className="text-2xl font-bold">
                {t('common:passport.pdfTitle', {
                  brand: BRAND.name,
                })}
              </p>
              <p className="text-sm text-gray-500">{formatDate(new Date(), locale)}</p>
            </div>
            {profile.photoURL && (
              <img
                src={profile.photoURL}
                alt=""
                className="size-24 rounded-full object-cover"
              />
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xl font-semibold">{profile.displayName}</p>
              <p className="text-sm text-gray-600">
                {t(`common:levels.${profile.stats.level}` as 'common:levels.1')}
              </p>

              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>{t('common:passport.hours')}</dt>
                  <dd className="font-semibold">{Math.round(profile.stats.hours)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('common:passport.activities')}</dt>
                  <dd className="font-semibold">{profile.stats.activitiesCompleted}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t('common:passport.ip')}</dt>
                  <dd className="font-semibold">{profile.stats.ip}</dd>
                </div>
              </dl>

              {skillsGained.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    {t('common:profile.skills')}
                  </p>
                  <p className="text-sm">
                    {skillsGained
                      .map((id) =>
                        t(`catalog:skills.${id}` as 'catalog:skills.teamwork'),
                      )
                      .join(' · ')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-start">
              <QrCode
                value={`${BRAND.urls.verifyBase}/${printToken}`}
                size={160}
                ariaLabel={t('common:passport.pdfQrLabel')}
              />
              <p className="mt-2 max-w-[11rem] text-center text-xs text-gray-500">
                {t('common:passport.pdfQrHint')}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase text-gray-500">
              {t('attendance:passport.historyTitle')}
            </p>
            <ul className="mt-2 divide-y divide-gray-200 text-sm">
              {(entries ?? []).map((entry) => (
                <li key={entry.id} className="flex justify-between py-1.5">
                  <span>
                    {entry.activityTitle}
                    {orgNames.get(entry.orgId) ? ` — ${orgNames.get(entry.orgId)}` : ''}
                  </span>
                  <span className="shrink-0 text-gray-500">
                    {entry.approvedAt
                      ? formatDate(entry.approvedAt.toDate(), locale)
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
