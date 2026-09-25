/**
 * Konum kaynağı seçimi: cihaz konumu **ya da** şehir.
 *
 * CLAUDE.md Bölüm 9: "konum izni (opsiyonel)". Burada izin reddi bir hata
 * gibi gösterilmiyor; iki eşdeğer yol yan yana duruyor ve şehir seçimi tek
 * dokunuşla çalışıyor. Konum cihazdan çıkmıyor (lib/geo.ts).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CITIES, findCity } from '@/config/cities'
import { Button, SelectField } from '@/components/ui'
import {
  NO_ORIGIN,
  originFromCity,
  requestDeviceLocation,
  storeCityId,
  type GeoOrigin,
} from '@/lib/geo'

export function LocationPicker({
  origin,
  onChange,
}: {
  origin: GeoOrigin
  onChange: (next: GeoOrigin) => void
}): React.JSX.Element {
  const { t } = useTranslation('activities')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function detectDeviceLocation(): Promise<void> {
    setLocating(true)
    setError(null)
    const result = await requestDeviceLocation()
    setLocating(false)

    if (result.ok) {
      storeCityId(null)
      onChange({ source: 'device', point: result.point, cityId: null })
      return
    }
    setError(t(`location.${result.error}`))
  }

  function chooseCity(cityId: string): void {
    if (!cityId) {
      storeCityId(null)
      onChange(NO_ORIGIN)
      return
    }
    const city = findCity(cityId)
    if (!city) return
    storeCityId(city.id)
    onChange(originFromCity(city))
  }

  const activeCity = origin.cityId ? findCity(origin.cityId) : undefined

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-ink-800">
      <div>
        <h2 className="text-sm font-semibold">{t('location.title')}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('location.why')}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          variant="secondary"
          loading={locating}
          onClick={() => void detectDeviceLocation()}
        >
          📍 {locating ? t('location.locating') : t('location.useDevice')}
        </Button>

        <div className="min-w-48 flex-1">
          <SelectField
            label={t('location.cityLabel')}
            value={origin.cityId ?? ''}
            onChange={(event) => chooseCity(event.target.value)}
          >
            <option value="">{t('location.cityPlaceholder')}</option>
            {CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {error && (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          {error}
        </p>
      )}

      {origin.source !== 'none' && (
        <p className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span>
            {origin.source === 'device'
              ? t('location.deviceActive')
              : t('location.cityActive', { city: activeCity?.name ?? '' })}
          </span>
          <button
            type="button"
            onClick={() => {
              storeCityId(null)
              onChange(NO_ORIGIN)
            }}
            className="underline"
          >
            {t('location.clear')}
          </button>
        </p>
      )}
    </div>
  )
}
