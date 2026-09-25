/**
 * Tarih, saat ve sayı biçimlendirme.
 *
 * CLAUDE.md Bölüm 11: "Tarih/saat/para formatı `Intl` ile, saat dilimi
 * `Europe/Berlin` varsayılan." Saat dilimini sabitlemek şart: kullanıcı
 * telefonu hâlâ geldiği ülkenin saatinde olabilir ve "14:00'te Hasenheide"
 * yazan bir etkinliğe iki saat geç gitmek gerçek bir zarardır.
 */

import { BRAND } from '@/config/brand'
import type { Timestamp } from 'firebase/firestore'

const TZ = BRAND.timeZone

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTime(date: Date, locale: string): string {
  return `${formatDate(date, locale)} · ${formatTime(date, locale)}`
}

/** "Sa. 30. Sep 2026 · 14:00 – 17:00" — aynı gün ise tarih tekrar edilmez. */
export function formatRange(start: Date, end: Date, locale: string): string {
  const sameDay =
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(start) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(end)

  if (sameDay) {
    return `${formatDate(start, locale)} · ${formatTime(start, locale)} – ${formatTime(end, locale)}`
  }
  return `${formatDateTime(start, locale)} – ${formatDateTime(end, locale)}`
}

/** Etkinlik süresi (saat). Kuruma "kaç saat kredilendirilir" önerisi için. */
export function durationHours(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000)
}

export function tsToDate(value: Timestamp | null | undefined): Date | null {
  if (!value) return null
  try {
    return value.toDate()
  } catch {
    return null
  }
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}
