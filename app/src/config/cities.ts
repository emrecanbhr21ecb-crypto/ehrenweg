/**
 * Şehir ve ilçe koordinatları — konum izni VERİLMEDİĞİNDE mesafe filtresinin
 * dayanağı (CLAUDE.md Bölüm 9: "konum izni opsiyonel").
 *
 * Neden sabit liste: hedef kitlenin bir kısmı konum iznini bilinçli olarak
 * kapatıyor (gözetlenme kaygısı gerçek bir konu, Bölüm 10). İzin vermeyen
 * kullanıcı "yakınımdakiler" özelliğinden tamamen mahrum kalmasın diye şehir
 * seçimi eşdeğer bir giriş noktası olarak duruyor.
 *
 * Koordinatlar ilçe/şehir merkezidir; ±2 km hassasiyet mesafe filtresi için
 * fazlasıyla yeterli ve kullanıcının gerçek konumunu HİÇ istemiyor.
 */

export interface CityPoint {
  id: string
  /** Görünen ad — özel isim olduğu için çevrilmez (Bölüm 11 istisnası). */
  name: string
  lat: number
  lng: number
}

/** Pilot bölge Berlin; ilçeler ayrı ayrı çünkü Berlin 45 km enindedir. */
export const CITIES: readonly CityPoint[] = [
  { id: 'berlin_neukoelln', name: 'Berlin-Neukölln', lat: 52.4757, lng: 13.4415 },
  { id: 'berlin_mitte', name: 'Berlin-Mitte', lat: 52.52, lng: 13.405 },
  { id: 'berlin_kreuzberg', name: 'Berlin-Kreuzberg', lat: 52.4977, lng: 13.418 },
  { id: 'berlin_wedding', name: 'Berlin-Wedding', lat: 52.5501, lng: 13.365 },
  { id: 'berlin_spandau', name: 'Berlin-Spandau', lat: 52.535, lng: 13.1997 },
  { id: 'berlin_marzahn', name: 'Berlin-Marzahn', lat: 52.545, lng: 13.567 },
  { id: 'hamburg', name: 'Hamburg', lat: 53.5511, lng: 9.9937 },
  { id: 'muenchen', name: 'München', lat: 48.1351, lng: 11.582 },
  { id: 'koeln', name: 'Köln', lat: 50.9375, lng: 6.9603 },
  { id: 'frankfurt', name: 'Frankfurt am Main', lat: 50.1109, lng: 8.6821 },
  { id: 'stuttgart', name: 'Stuttgart', lat: 48.7758, lng: 9.1829 },
  { id: 'duesseldorf', name: 'Düsseldorf', lat: 51.2277, lng: 6.7735 },
  { id: 'leipzig', name: 'Leipzig', lat: 51.3397, lng: 12.3731 },
  { id: 'dortmund', name: 'Dortmund', lat: 51.5136, lng: 7.4653 },
  { id: 'essen', name: 'Essen', lat: 51.4556, lng: 7.0116 },
  { id: 'bremen', name: 'Bremen', lat: 53.0793, lng: 8.8017 },
  { id: 'dresden', name: 'Dresden', lat: 51.0504, lng: 13.7373 },
  { id: 'hannover', name: 'Hannover', lat: 52.3759, lng: 9.732 },
  { id: 'nuernberg', name: 'Nürnberg', lat: 49.4521, lng: 11.0767 },
  { id: 'duisburg', name: 'Duisburg', lat: 51.4344, lng: 6.7623 },
]

/** Harita ilk açılışta buraya bakar — pilot bölge. */
export const DEFAULT_MAP_CENTER = { lat: 52.4757, lng: 13.4415 }
export const DEFAULT_MAP_ZOOM = 11

export function findCity(id: string): CityPoint | undefined {
  return CITIES.find((city) => city.id === id)
}

/**
 * Profildeki serbest metin şehri listedeki bir noktaya bağlamayı dener.
 * "Berlin" yazan kullanıcı Neukölln merkezine düşer (pilot bölge).
 */
export function matchCityByName(value: string): CityPoint | undefined {
  const needle = value.trim().toLocaleLowerCase('de-DE')
  if (needle.length < 2) return undefined

  const exact = CITIES.find((city) => city.name.toLocaleLowerCase('de-DE') === needle)
  if (exact) return exact

  return CITIES.find((city) => {
    const name = city.name.toLocaleLowerCase('de-DE')
    return name.includes(needle) || needle.includes(name)
  })
}
