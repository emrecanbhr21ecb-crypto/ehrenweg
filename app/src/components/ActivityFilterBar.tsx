/**
 * Aktivite filtreleri (CLAUDE.md Bölüm 9: kategori, tarih, mesafe, dil, online).
 *
 * Filtreler varsayılan olarak KAPALI bir panelde: telefonda liste ekranının
 * yarısını filtre kaplarsa kullanıcı içeriği hiç görmez. Kaç filtrenin aktif
 * olduğu düğmenin üstünde yazıyor, böylece kapalıyken de görünür.
 */

import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ACTIVITY_TYPES,
  DISTANCE_OPTIONS,
  DEFAULT_FILTERS,
  isFilterActive,
  type ActivityFilters,
  type DistanceKm,
} from '@/types/activity'
import { CATEGORY_IDS, CATEGORY_META, LANGUAGE_CODES } from '@/config/catalog'
import {
  Badge,
  Button,
  ChipToggle,
  SelectField,
  Switch,
  TextField,
} from '@/components/ui'

function countActive(filters: ActivityFilters): number {
  let count = 0
  if (filters.categoryIds.length > 0) count += 1
  if (filters.type !== 'all') count += 1
  if (filters.onlineOnly) count += 1
  if (filters.language !== 'all') count += 1
  if (filters.maxDistanceKm !== null) count += 1
  if (filters.fromDate || filters.toDate) count += 1
  if (filters.search.trim()) count += 1
  return count
}

export function ActivityFilterBar({
  filters,
  onChange,
  /** Konum yoksa mesafe filtresi anlamsız — gizlenir. */
  distanceAvailable,
}: {
  filters: ActivityFilters
  onChange: (next: ActivityFilters) => void
  distanceAvailable: boolean
}): React.JSX.Element {
  const { t } = useTranslation(['activities', 'catalog'])
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const active = countActive(filters)
  const patch = (part: Partial<ActivityFilters>): void =>
    onChange({ ...filters, ...part })

  function toggleCategory(id: (typeof CATEGORY_IDS)[number]): void {
    patch({
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((entry) => entry !== id)
        : [...filters.categoryIds, id],
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TextField
            label={t('activities:filter.search')}
            type="search"
            value={filters.search}
            placeholder={t('activities:filter.searchPlaceholder')}
            onChange={(event) => patch({ search: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          ⚙️ {open ? t('activities:filter.hide') : t('activities:filter.show')}
        </Button>

        {active > 0 && (
          <>
            <Badge tone="info">
              {t('activities:filter.activeCount', { count: active })}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange({ ...DEFAULT_FILTERS })}
            >
              {t('activities:filter.reset')}
            </Button>
          </>
        )}
      </div>

      {open && (
        <div
          id={panelId}
          className="space-y-5 rounded-2xl border border-gray-200 p-4 dark:border-ink-800"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {t('activities:filter.category')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_IDS.map((id) => (
                <ChipToggle
                  key={id}
                  selected={filters.categoryIds.includes(id)}
                  onToggle={() => toggleCategory(id)}
                >
                  <span aria-hidden="true" className="me-1">
                    {CATEGORY_META[id].emoji}
                  </span>
                  {t(`catalog:categories.${id}`)}
                </ChipToggle>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('activities:filter.type')}
              value={filters.type}
              onChange={(event) =>
                patch({ type: event.target.value as ActivityFilters['type'] })
              }
            >
              <option value="all">{t('activities:filter.typeAll')}</option>
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`activities:type.${type}`)}
                </option>
              ))}
            </SelectField>

            <SelectField
              label={t('activities:filter.language')}
              value={filters.language}
              onChange={(event) =>
                patch({ language: event.target.value as ActivityFilters['language'] })
              }
            >
              <option value="all">{t('activities:filter.languageAll')}</option>
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`catalog:languages.codes.${code}`)}
                </option>
              ))}
            </SelectField>

            <TextField
              label={t('activities:filter.from')}
              type="date"
              value={filters.fromDate}
              onChange={(event) => patch({ fromDate: event.target.value })}
            />

            <TextField
              label={t('activities:filter.to')}
              type="date"
              value={filters.toDate}
              onChange={(event) => patch({ toDate: event.target.value })}
            />

            {distanceAvailable && (
              <SelectField
                label={t('activities:filter.distance')}
                value={
                  filters.maxDistanceKm === null ? '' : String(filters.maxDistanceKm)
                }
                onChange={(event) =>
                  patch({
                    maxDistanceKm:
                      event.target.value === ''
                        ? null
                        : (Number(event.target.value) as DistanceKm),
                  })
                }
              >
                <option value="">{t('activities:filter.distanceAny')}</option>
                {DISTANCE_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    {t('activities:filter.distanceKm', { km })}
                  </option>
                ))}
              </SelectField>
            )}
          </div>

          <div className="space-y-3">
            <Switch
              checked={filters.onlineOnly}
              onChange={(next) => patch({ onlineOnly: next })}
              label={t('activities:filter.onlineOnly')}
              hint={t('activities:filter.onlineHint')}
            />
            <Switch
              checked={filters.upcomingOnly}
              onChange={(next) => patch({ upcomingOnly: next })}
              label={t('activities:filter.upcomingOnly')}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export { isFilterActive }
