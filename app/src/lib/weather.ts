/**
 * Hava durumu — Open-Meteo (CLAUDE.md Bölüm 9, "BazaltGo'daki gibi").
 *
 * Neden Open-Meteo: API anahtarı istemiyor, ücretsiz, ticari kullanımda da
 * serbest ve kişisel veri göndermiyoruz — yalnız yuvarlanmış koordinat.
 *
 * Koordinat İKİ ONDALIĞA yuvarlanıyor (~1 km). Hava durumu için fazlasıyla
 * yeterli ve kullanıcının tam konumunu üçüncü bir sunucuya vermemiş oluyoruz
 * (Bölüm 10 veri minimizasyonu).
 */

export interface Weather {
  temperature: number
  /** WMO hava kodu. */
  code: number
  emoji: string
}

/** WMO kodundan emoji. Tam liste gereksiz; gruplar yeterli. */
function emojiFor(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

export async function fetchWeather(point: {
  lat: number
  lng: number
}): Promise<Weather | null> {
  const lat = point.lat.toFixed(2)
  const lng = point.lng.toFixed(2)

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code&timezone=Europe%2FBerlin`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const temperature = data.current?.temperature_2m
    const code = data.current?.weather_code

    if (typeof temperature !== 'number' || typeof code !== 'number') return null
    return { temperature: Math.round(temperature), code, emoji: emojiFor(code) }
  } catch (error) {
    // Hava durumu süs; başarısızlığı hiçbir akışı engellememeli.
    console.warn('[weather] Alınamadı:', error)
    return null
  }
}
