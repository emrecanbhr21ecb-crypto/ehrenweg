/**
 * Profil alanı seçicileri — ilgi alanları, beceriler, konuşulan diller.
 *
 * Hem onboarding'in son adımında hem de profil düzenlemede aynısı kullanılır;
 * iki yerde ayrı yazılırsa biri güncellenip diğeri unutulur.
 */

import { useTranslation } from 'react-i18next'

import { Button, ChipToggle } from '@/components/ui'
import {
  CATEGORY_IDS,
  CATEGORY_META,
  CEFR_LEVELS,
  LANGUAGE_CODES,
  SKILL_IDS,
  type CategoryId,
  type CefrLevel,
  type LanguageCode,
  type SkillId,
} from '@/config/catalog'
import type { UserLanguage } from '@/types/user'

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function InterestPicker({
  value,
  onChange,
}: {
  value: readonly CategoryId[]
  onChange: (next: CategoryId[]) => void
}): React.JSX.Element {
  const { t } = useTranslation('catalog')

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{t('interests.legend')}</legend>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {t('interests.hint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_IDS.map((id) => (
          <ChipToggle
            key={id}
            selected={value.includes(id)}
            onToggle={() => onChange(toggle(value, id))}
          >
            <span aria-hidden="true" className="me-1.5">
              {CATEGORY_META[id].emoji}
            </span>
            {t(`categories.${id}` as 'categories.environment')}
          </ChipToggle>
        ))}
      </div>
    </fieldset>
  )
}

export function SkillPicker({
  value,
  onChange,
}: {
  value: readonly SkillId[]
  onChange: (next: SkillId[]) => void
}): React.JSX.Element {
  const { t } = useTranslation('catalog')

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{t('skills.legend')}</legend>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {t('skills.hint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {SKILL_IDS.map((id) => (
          <ChipToggle
            key={id}
            selected={value.includes(id)}
            onToggle={() => onChange(toggle(value, id))}
          >
            {t(`skills.${id}` as 'skills.teamwork')}
          </ChipToggle>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Konuşulan diller — kod + CEFR seviyesi çiftleri.
 *
 * Aynı dil iki kez eklenemez; eklenmiş diller seçim listesinden düşer.
 */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: readonly UserLanguage[]
  onChange: (next: UserLanguage[]) => void
}): React.JSX.Element {
  const { t } = useTranslation('catalog')

  const used = new Set(value.map((item) => item.code))
  const available = LANGUAGE_CODES.filter((code) => !used.has(code))

  function addLanguage(code: LanguageCode): void {
    onChange([...value, { code, level: 'B1' }])
  }

  function setLevel(code: LanguageCode, level: CefrLevel): void {
    onChange(value.map((item) => (item.code === code ? { ...item, level } : item)))
  }

  function remove(code: LanguageCode): void {
    onChange(value.filter((item) => item.code !== code))
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{t('languages.legend')}</legend>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {t('languages.hint')}
      </p>

      <ul className="mb-3 space-y-2">
        {value.map((item) => (
          <li
            key={item.code}
            className="flex items-center gap-2 rounded-xl border border-gray-200 p-2 dark:border-ink-800"
          >
            <span className="flex-1 ps-1 text-sm font-medium">
              {t(`languages.codes.${item.code}` as 'languages.codes.de')}
            </span>

            <label className="text-sm">
              <span className="sr-only">
                {t('languages.levelFor', {
                  language: t(`languages.codes.${item.code}` as 'languages.codes.de'),
                })}
              </span>
              <select
                value={item.level}
                onChange={(e) => setLevel(item.code, e.target.value as CefrLevel)}
                className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 dark:border-ink-700 dark:bg-ink-900"
              >
                {CEFR_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`languages.levels.${level}` as 'languages.levels.A1')}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="ghost"
              className="min-h-11 px-3"
              onClick={() => remove(item.code)}
              aria-label={t('languages.removeFor', {
                language: t(`languages.codes.${item.code}` as 'languages.codes.de'),
              })}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">
            {t('languages.add')}
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addLanguage(e.target.value as LanguageCode)
            }}
            className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 dark:border-ink-700 dark:bg-ink-900"
          >
            <option value="">{t('languages.choose')}</option>
            {available.map((code) => (
              <option key={code} value={code}>
                {t(`languages.codes.${code}` as 'languages.codes.de')}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  )
}
