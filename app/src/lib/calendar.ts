/**
 * "Takvime ekle" ve "Paylaş" (CLAUDE.md Bölüm 9 — Activities detay sayfası).
 *
 * Takvim: dışarıya bağımlılık yok, standart bir `.ics` dosyası üretilip
 * indiriliyor. iOS, Android ve masaüstü takvim uygulamalarının hepsi bu
 * dosyayı açar. Google Calendar bağlantısı üretmek daha "kolay" görünürdü ama
 * kullanıcıyı Google hesabı olmaya zorlardı — hedef kitlede bu bir engel.
 */

import { BRAND } from '@/config/brand'
import type { Activity } from '@/types/activity'

/** ICS metin kaçışı: virgül, noktalı virgül ve satır sonu özel karakterdir. */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** ICS zaman biçimi: 20260925T183000Z (her zaman UTC). */
function toIcsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * 75 oktetlik satır sınırı (RFC 5545). Uzun açıklamalar katlanmazsa bazı
 * takvim uygulamaları dosyayı hiç açmaz.
 */
function fold(line: string): string {
  if (line.length <= 73) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 72)}`)
    rest = rest.slice(72)
  }
  return parts.join('\r\n')
}

export function buildIcs(
  activity: Activity,
  text: { title: string; description: string },
): string {
  const start = activity.startAt.toDate()
  const end = activity.endAt.toDate()
  const location = activity.online ? BRAND.urls.web : activity.location.address

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND.name}//Activities//DE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${activity.id}@ehrenweg.de`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(text.title)}`,
    `DESCRIPTION:${escapeIcs(text.description)}`,
    `LOCATION:${escapeIcs(location)}`,
    `URL:${BRAND.urls.activityBase}/${activity.id}`,
    'BEGIN:VALARM',
    // Bir gün önce hatırlatma — takvim uygulamasının kendi bildirimi.
    // Uygulama içi yerel bildirimden bağımsızdır (lib/reminders.ts).
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(text.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(fold).join('\r\n')
}

export function downloadIcs(
  activity: Activity,
  text: { title: string; description: string },
): void {
  const blob = new Blob([buildIcs(activity, text)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ehrenweg-${activity.id}.ics`
  document.body.append(link)
  link.click()
  link.remove()
  // Sekme kapanmadan belleği bırak.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function activityUrl(activityId: string): string {
  return `${BRAND.urls.activityBase}/${activityId}`
}

export type ShareResult = 'shared' | 'copied' | 'failed'

/**
 * Paylaş: mümkünse yerel paylaşım sayfası, değilse panoya kopyalama.
 *
 * `navigator.share` kullanıcı hareketi olmadan çağrılamaz — bu yüzden
 * doğrudan tıklama işleyicisinden çağrılmalı, `await` zincirinin arkasına
 * saklanmamalı.
 */
export async function shareActivity(
  activityId: string,
  title: string,
): Promise<ShareResult> {
  const url = activityUrl(activityId)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      // Kullanıcı paylaşım sayfasını kapattıysa bu bir hata değil.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'failed'
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
