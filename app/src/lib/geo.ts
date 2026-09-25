/**
 * Konum: izin isteme, şehir seçimiyle yedekleme, mesafe hesabı.
 *
 * İlke (CLAUDE.md Bölüm 9 + 10): **konum izni opsiyoneldir.** İzin verilmezse
 * uygulama çalışmaya devam eder; kullanıcı şehrini seçer ve mesafe filtresi o
 * noktadan ölçer. Konum HİÇBİR ZAMAN sunucuya gönderilmez ve Firestore'a
 * yazılmaz — yalnız tarayıcıda, liste sıralaması için kullanılır.
 */

import { matchCityByName, type CityPoint } from '@/config/cities'

export interface GeoPoint {
  lat: number
  lng: number
}

export type GeoSource = 'device' | 'city' | 'none'

export interface GeoOrigin {
  source: GeoSource
  point: GeoPoint | null
  /** Şehirden geldiyse şehir kimliği — arayüzde seçili göstermek için. */
  cityId: string | null
}

export const NO_ORIGIN: GeoOrigin = { source: 'none', point: null, cityId: null }

/** Seçilen şehir tarayıcıda kalır; sunucuya gitmez. */
const CITY_STORAGE_KEY = 'ehrenweg.geo.city'
const DEVICE_OPT_IN_KEY = 'ehrenweg.geo.deviceOptIn'

export function readStoredCityId(): string | null {
  try {
    return localStorage.getItem(CITY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeCityId(cityId: string | null): void {
  try {
    if (cityId) localStorage.setItem(CITY_STORAGE_KEY, cityId)
    else localStorage.removeItem(CITY_STORAGE_KEY)
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; filtre yine çalışır.
  }
}

/** Kullanıcı daha önce cihaz konumuna izin verdi mi (kendi tercihimiz)? */
export function hasDeviceOptIn(): boolean {
  try {
    return localStorage.getItem(DEVICE_OPT_IN_KEY) === 'true'
  } catch {
    return false
  }
}

export function setDeviceOptIn(value: boolean): void {
  try {
    localStorage.setItem(DEVICE_OPT_IN_KEY, String(value))
  } catch {
    // yok sayılır
  }
}

export type GeoError = 'denied' | 'unavailable' | 'timeout'

/**
 * Cihaz konumunu ister.
 *
 * Reddedilirse HATA FIRLATMAZ — çağıran taraf şehir seçimine düşsün diye
 * `{ ok: false }` döner. Konum reddi bir arıza değil, meşru bir tercihtir.
 */
export async function requestDeviceLocation(
  timeoutMs = 10_000,
): Promise<{ ok: true; point: GeoPoint } | { ok: false; error: GeoError }> {
  if (!('geolocation' in navigator)) {
    return { ok: false, error: 'unavailable' }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceOptIn(true)
        resolve({
          ok: true,
          point: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        })
      },
      (error) => {
        setDeviceOptIn(false)
        const code =
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable'
        resolve({ ok: false, error: code })
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    )
  })
}

/**
 * Profil şehrinden başlangıç noktası tahmin eder.
 * Kullanıcı hiçbir şey yapmadan da mesafe filtresi bir yere dayansın diye.
 */
export function originFromProfileCity(city: string): GeoOrigin {
  const match = matchCityByName(city)
  if (!match) return NO_ORIGIN
  return { source: 'city', point: { lat: match.lat, lng: match.lng }, cityId: match.id }
}

export function originFromCity(city: CityPoint): GeoOrigin {
  return { source: 'city', point: { lat: city.lat, lng: city.lng }, cityId: city.id }
}

const EARTH_RADIUS_KM = 6371

/** İki nokta arası kuş uçuşu mesafe (km). Haversine. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** "1,2 km" / "850 m" — Intl ile, kullanıcının diliyle. */
export function formatDistance(km: number, locale: string): string {
  if (km < 1) {
    return (
      new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
        Math.round(km * 1000),
      ) + ' m'
    )
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km) + ' km'
}
