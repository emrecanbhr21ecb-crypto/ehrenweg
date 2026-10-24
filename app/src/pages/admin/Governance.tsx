/**
 * Platform admin — audit log görüntüleyici ve puan kuralları editörü.
 * CLAUDE.md Bölüm 9 ve Bölüm 12 (`config/scoring`, sürüm numaralı).
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button, Card, Spinner, TextField } from '@/components/ui'
import { db } from '@/lib/firebase'
import { formatDate } from '@/lib/format'
import { fetchAuditLog, type AuditEntry } from '@/lib/rewards'
import { DEFAULT_SCORING, type ScoringConfig } from '@/config/scoring'
import type { Locale } from '@/config/brand'

export function AuditLogPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation('manage')
  const locale = (i18n.resolvedLanguage ?? 'de') as Locale
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchAuditLog()
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((caught: unknown) => {
        console.error('[admin] Audit log okunamadı:', caught)
        if (!cancelled) setError(t('audit.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('audit.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('audit.subtitle')}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {!entries ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-8 text-primary-700" />
        </div>
      ) : entries.length === 0 ? (
        <Card className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('audit.empty')}
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="px-5">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="border-t border-gray-100 py-3 first:border-t-0 dark:border-ink-800"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{entry.action}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {entry.createdAt
                      ? formatDate(entry.createdAt.toDate(), locale)
                      : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {entry.actorUid} → {entry.targetId}
                  {entry.orgId ? ` · ${entry.orgId}` : ''}
                </p>
                {entry.reason && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {t('audit.reasonLabel', { reason: entry.reason })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

interface EditableScoring {
  maxIpPerActivity: number
  ipPerHour: number
  bonusNewCategory: number
  bonusMonthlyFour: number
  bonusTrainerMultiplier: number
  penaltyNoShowIp: number
  penaltyStreakLimit: number
  penaltyRestrictionDays: number
}

function toEditable(config: ScoringConfig): EditableScoring {
  return {
    maxIpPerActivity: config.maxIpPerActivity,
    ipPerHour: config.ipPerHour,
    bonusNewCategory: config.bonuses.newCategory,
    bonusMonthlyFour: config.bonuses.monthlyFour,
    bonusTrainerMultiplier: config.bonuses.trainerMultiplier,
    penaltyNoShowIp: config.penalties.noShowIp,
    penaltyStreakLimit: config.penalties.noShowStreakLimit,
    penaltyRestrictionDays: config.penalties.restrictionDays,
  }
}

const SCORING_REF = doc(db, 'config', 'scoring')

/**
 * Yalnız sık değişen sayısal kuralları düzenler (üst sınır, bonus, ceza).
 * Seviye eşikleri ve eğitmen şartları bu sürümde SALT OKUNUR bırakıldı —
 * ayrı, daha büyük bir form ister ve Faz 7 prompt'u bu ayrıntıyı istemiyor.
 *
 * ⚠️ `lib/passport.ts` içindeki `loadScoringConfig()` okuduğu değeri oturum
 * boyunca ÖNBELLEKLER. Burada kaydedilen yeni sürüm, zaten açık olan bir
 * yoklama ekranında anında görünmeyebilir — sayfa yenilenince görünür.
 */
export function ScoringEditorPanel(): React.JSX.Element {
  const { t } = useTranslation('manage')
  const [version, setVersion] = useState<number>(0)
  const [values, setValues] = useState<EditableScoring | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<Partial<ScoringConfig>>({})

  useEffect(() => {
    let cancelled = false
    void getDoc(SCORING_REF)
      .then((snapshot) => {
        if (cancelled) return
        const data = snapshot.exists()
          ? (snapshot.data() as Partial<ScoringConfig> & { version?: number })
          : {}
        setRaw(data)
        setVersion(data.version ?? 0)
        setValues(
          toEditable({
            ...DEFAULT_SCORING,
            ...data,
            bonuses: { ...DEFAULT_SCORING.bonuses, ...(data.bonuses ?? {}) },
            penalties: { ...DEFAULT_SCORING.penalties, ...(data.penalties ?? {}) },
          }),
        )
      })
      .catch((caught: unknown) => {
        console.error('[admin] Puan kuralları okunamadı:', caught)
        if (!cancelled) setError(t('scoring.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  function set<K extends keyof EditableScoring>(key: K, value: number): void {
    setValues((current) => (current ? { ...current, [key]: value } : current))
  }

  async function handleSave(): Promise<void> {
    if (!values) return
    setBusy(true)
    setError(null)
    try {
      const next: ScoringConfig = {
        ...DEFAULT_SCORING,
        ...raw,
        maxIpPerActivity: values.maxIpPerActivity,
        ipPerHour: values.ipPerHour,
        bonuses: {
          newCategory: values.bonusNewCategory,
          monthlyFour: values.bonusMonthlyFour,
          trainerMultiplier: values.bonusTrainerMultiplier,
        },
        penalties: {
          noShowIp: values.penaltyNoShowIp,
          noShowStreakLimit: values.penaltyStreakLimit,
          restrictionDays: values.penaltyRestrictionDays,
        },
        levels: raw.levels ?? DEFAULT_SCORING.levels,
        trainerRequirements:
          raw.trainerRequirements ?? DEFAULT_SCORING.trainerRequirements,
      }
      const nextVersion = version + 1
      await setDoc(SCORING_REF, { ...next, version: nextVersion })
      setVersion(nextVersion)
      setRaw(next)
      setNotice(t('scoring.saved'))
    } catch (caught) {
      console.error('[admin] Puan kuralları kaydedilemedi:', caught)
      setError(t('scoring.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!values) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-8 text-primary-700" />
      </div>
    )
  }

  const fields: { key: keyof EditableScoring; label: string; step?: string }[] = [
    { key: 'maxIpPerActivity', label: t('scoring.maxIpPerActivity') },
    { key: 'ipPerHour', label: t('scoring.ipPerHour') },
    { key: 'bonusNewCategory', label: t('scoring.bonusNewCategory') },
    { key: 'bonusMonthlyFour', label: t('scoring.bonusMonthlyFour') },
    {
      key: 'bonusTrainerMultiplier',
      label: t('scoring.bonusTrainerMultiplier'),
      step: '0.1',
    },
    { key: 'penaltyNoShowIp', label: t('scoring.penaltyNoShowIp') },
    { key: 'penaltyStreakLimit', label: t('scoring.penaltyStreakLimit') },
    { key: 'penaltyRestrictionDays', label: t('scoring.penaltyRestrictionDays') },
  ]

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{t('scoring.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('scoring.subtitle')}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {t('scoring.version', { version })}
        </p>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <TextField
            key={field.key}
            type="number"
            step={field.step ?? '1'}
            label={field.label}
            value={values[field.key]}
            onChange={(event) => set(field.key, Number(event.target.value))}
          />
        ))}
      </Card>

      <Button loading={busy} onClick={() => void handleSave()}>
        {t('scoring.save')}
      </Button>
    </div>
  )
}
