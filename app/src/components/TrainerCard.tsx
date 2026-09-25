/**
 * Profildeki "Eğitmen ol" kartı — CLAUDE.md Bölüm 8.
 *
 * "Profilde 'Eğitmen ol / Trainer werden' kartı; şartlar ve kullanıcının
 *  mevcut ilerlemesi çubuklarla gösterilir."
 *
 * Çubuklar önemli: "uygun değilsin" demek insanı durdurur, "8 katılımdan
 * 5'indesin" demek devam ettirir.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Alert, Badge, Button, Card } from '@/components/ui'
import {
  DEFAULT_SCORING,
  trainerEligibility,
  type TrainerCheck,
} from '@/config/scoring'
import { useAuth } from '@/lib/AuthProvider'
import { loadScoringConfig } from '@/lib/passport'
import { fetchMyTrainerApplication } from '@/lib/trainer'
import type { TrainerRequirements } from '@/config/scoring'
import type { TrainerApplication } from '@/types/trainer'

/** Hesap yaşı — gün. Profil belgesi yoksa 0. */
export function accountAgeDays(createdAt: { toDate?: () => Date } | null): number {
  const created = createdAt?.toDate?.()
  if (!created) return 0
  return (Date.now() - created.getTime()) / 86_400_000
}

function RequirementBar({ check }: { check: TrainerCheck }): React.JSX.Element {
  const { t } = useTranslation('trainer')

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {/* Simge tek başına bilgi taşımıyor; yanında sayı da var. */}
          <span aria-hidden="true">{check.met ? '✅' : '⬜'}</span>
          {t(`req.${check.key}`)}
        </span>
        <span className="tabular-nums text-gray-600 dark:text-gray-400">
          {check.key === 'noShowRate'
            ? t('req.percentMax', { current: check.current, required: check.required })
            : t('req.valueOf', { current: check.current, required: check.required })}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-ink-800"
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500',
            check.met ? 'bg-emerald-600' : 'bg-primary-600',
          ].join(' ')}
          style={{ width: `${Math.max(4, check.progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

export function TrainerCard(): React.JSX.Element | null {
  const { t } = useTranslation('trainer')
  const { user, profile } = useAuth()

  const [application, setApplication] = useState<TrainerApplication | null | undefined>(
    undefined,
  )
  const [requirements, setRequirements] = useState<TrainerRequirements>(
    DEFAULT_SCORING.trainerRequirements,
  )

  useEffect(() => {
    void loadScoringConfig().then((config) =>
      setRequirements(config.trainerRequirements),
    )
  }, [])

  useEffect(() => {
    if (!user) return
    void fetchMyTrainerApplication(user.uid)
      .then(setApplication)
      .catch(() => setApplication(null))
  }, [user])

  if (!profile || application === undefined) return null

  // Onaylı eğitmen kartı görmez — kart bir davet, o zaten içeride.
  if (profile.trainerStatus === 'approved') {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge tone="success">🎓 {t('profile.badge')}</Badge>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('card.approved')}</p>
        <Link to="/learn">
          <Button variant="secondary">{t('learn.propose')}</Button>
        </Link>
      </Card>
    )
  }

  const eligibility = trainerEligibility(
    {
      level: profile.stats.level,
      hours: profile.stats.hours,
      activitiesCompleted: profile.stats.activitiesCompleted,
      noShows: profile.stats.noShows,
    },
    accountAgeDays(profile.createdAt),
    requirements,
  )

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">🎓 {t('card.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('card.intro')}
        </p>
      </div>

      {application?.status === 'pending' && (
        <Alert tone="info">{t('card.pending')}</Alert>
      )}
      {application?.status === 'rejected' && (
        <Alert tone="warning">
          <strong className="block">{t('card.rejected')}</strong>
          {application.note && t('card.reason', { note: application.note })}
        </Alert>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {t('card.progress')}
        </p>
        {eligibility.checks.map((check) => (
          <RequirementBar key={check.key} check={check} />
        ))}
      </div>

      {eligibility.eligible ? (
        <Link to="/trainer/apply">
          <Button full>
            {application?.status === 'rejected' ? t('card.reapply') : t('card.apply')}
          </Button>
        </Link>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('card.notYet')}</p>
      )}
    </Card>
  )
}
