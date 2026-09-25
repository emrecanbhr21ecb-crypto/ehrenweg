/**
 * Seviye halkası — Integrationspass'ın görsel kalbi.
 *
 * Halka bir sonraki seviyeye ilerlemeyi gösterir. Erişilebilirlik: SVG
 * dekoratif (aria-hidden), asıl bilgi görünür metinle ve `role="img"`
 * etiketiyle verilir — ekran okuyucu "Seviye 2, sonraki seviyeye %40" der.
 */

import { useTranslation } from 'react-i18next'

import { levelProgress, nextLevelThreshold } from '@/config/catalog'
import type { UserStats } from '@/types/user'

const SIZE = 132
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function LevelRing({ stats }: { stats: UserStats }): React.JSX.Element {
  const { t } = useTranslation()

  const progress = levelProgress(stats, stats.level)
  const next = nextLevelThreshold(stats.level)
  const levelName = t(`levels.${stats.level}` as 'levels.1')

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={t('passport.ringLabel', {
        level: stats.level,
        name: levelName,
        percent: Math.round(progress * 100),
      })}
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden="true" className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-gray-200 dark:stroke-ink-800"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="stroke-primary-600 transition-[stroke-dashoffset] duration-700"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('passport.level')}
          </span>
          <span className="text-3xl font-bold text-primary-800 dark:text-primary-200">
            {stats.level}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-base font-semibold">{levelName}</p>

      {next ? (
        <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {t('passport.nextLevel', {
            name: t(`levels.${next.level}` as 'levels.1'),
            activities: Math.max(0, next.activities - stats.activitiesCompleted),
          })}
        </p>
      ) : (
        <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {t('passport.maxLevel')}
        </p>
      )}
    </div>
  )
}

/** Küçük sayı kartı — IP, saat, katılım. */
export function StatTile({
  label,
  value,
  emoji,
}: {
  label: string
  value: string | number
  emoji: string
}): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-ink-800/60">
      <p className="text-xl" aria-hidden="true">
        {emoji}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  )
}
