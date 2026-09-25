/**
 * "Bir gün önce hatırlat" — yerel bildirim (CLAUDE.md Bölüm 9).
 *
 * YEREL bildirim: sunucu push'u DEĞİL. Push altyapısı Faz 6'nın işi ve Cloud
 * Functions (Blaze) istiyor. Buradaki hatırlatma tamamen cihazda kurulur,
 * hiçbir veri dışarı çıkmaz.
 *
 * İki ortam:
 *   - **Android/iOS (Capacitor)** → `@capacitor/local-notifications`.
 *     Uygulama kapalıyken de düşer. Asıl hedef bu.
 *   - **Tarayıcı** → Notification API yalnız sekme açıkken zamanlayabilir.
 *     Bu yüzden web'de hatırlatma "kurulu" sayılır, kaydı tutulur ve sekme
 *     açıksa gösterilir; kullanıcıya da takvim dosyasını (`.ics`, kendi
 *     VALARM'ı ile) indirmesi önerilir. Yalan söylemiyoruz: arayüz web'de
 *     "takvimine ekle" ipucunu birlikte gösteriyor.
 *
 * Kayıt `localStorage`'da: kullanıcının hangi aktivitede hatırlatma kurduğu
 * kişisel veridir ve sunucuya yazmak için hiçbir sebep yok (veri
 * minimizasyonu, Bölüm 10).
 */

const STORAGE_KEY = 'ehrenweg.reminders'

/** Bir gün önce (CLAUDE.md Bölüm 12 `deadlineReminders` ile aynı pencere). */
const LEAD_MS = 24 * 60 * 60 * 1000

interface StoredReminder {
  activityId: string
  /** Bildirimin düşeceği an (epoch ms). */
  fireAt: number
  title: string
  body: string
  /** Capacitor bildirim kimliği — iptal için gerekli. */
  nativeId: number
}

function readAll(): StoredReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredReminder[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: StoredReminder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Depolama kapalıysa hatırlatma kurulamaz; arayüz bunu hata olarak gösterir.
  }
}

export function hasReminder(activityId: string): boolean {
  return readAll().some((entry) => entry.activityId === activityId)
}

/** Capacitor bildirim kimliği 32-bit int olmalı; kimlikten türetiyoruz. */
function nativeIdFor(activityId: string): number {
  let hash = 0
  for (const char of activityId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash) % 2_000_000_000
}

/** Capacitor eklentisini yalnız yerel platformda ve isteğe bağlı yükler. */
async function localNotifications(): Promise<
  typeof import('@capacitor/local-notifications').LocalNotifications | null
> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null
    const module = await import('@capacitor/local-notifications')
    return module.LocalNotifications
  } catch {
    // Eklenti kurulu değilse veya web'deysek sessizce düş.
    return null
  }
}

export type ReminderResult =
  'scheduled' | 'scheduled_web_only' | 'too_late' | 'denied' | 'failed'

/**
 * Aktivite başlangıcından 24 saat önceye hatırlatma kurar.
 * Aktiviteye 24 saatten az kaldıysa kurulmaz — geçmişe bildirim atılamaz.
 */
export async function scheduleReminder(
  activityId: string,
  startAt: Date,
  text: { title: string; body: string },
): Promise<ReminderResult> {
  const fireAt = startAt.getTime() - LEAD_MS
  if (fireAt <= Date.now()) return 'too_late'

  const entry: StoredReminder = {
    activityId,
    fireAt,
    title: text.title,
    body: text.body,
    nativeId: nativeIdFor(activityId),
  }

  const plugin = await localNotifications()

  if (plugin) {
    try {
      const permission = await plugin.requestPermissions()
      if (permission.display !== 'granted') return 'denied'

      await plugin.schedule({
        notifications: [
          {
            id: entry.nativeId,
            title: entry.title,
            body: entry.body,
            schedule: { at: new Date(fireAt) },
            extra: { activityId },
          },
        ],
      })
      writeAll([...readAll().filter((r) => r.activityId !== activityId), entry])
      return 'scheduled'
    } catch {
      return 'failed'
    }
  }

  // Tarayıcı yolu: izin iste, kaydı tut, sekme açıksa zamanlayıcıyla göster.
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission()
    } catch {
      // Bazı tarayıcılar güvenli olmayan bağlamda fırlatır; kayıt yine tutulur.
    }
  }

  writeAll([...readAll().filter((r) => r.activityId !== activityId), entry])
  armBrowserTimers()
  return 'scheduled_web_only'
}

export async function cancelReminder(activityId: string): Promise<void> {
  const entries = readAll()
  const target = entries.find((entry) => entry.activityId === activityId)
  writeAll(entries.filter((entry) => entry.activityId !== activityId))

  if (!target) return
  const plugin = await localNotifications()
  if (plugin) {
    try {
      await plugin.cancel({ notifications: [{ id: target.nativeId }] })
    } catch {
      // Zaten düşmüş olabilir.
    }
  }
}

const armed = new Set<string>()

/**
 * Sekme açıkken bekleyen hatırlatmaları zamanlar ve geçmişleri temizler.
 * Uygulama açılışında bir kez çağrılır (main.tsx).
 */
export function armBrowserTimers(): void {
  if (typeof window === 'undefined') return

  const now = Date.now()
  const entries = readAll()
  const alive = entries.filter((entry) => entry.fireAt > now - LEAD_MS)
  if (alive.length !== entries.length) writeAll(alive)

  for (const entry of alive) {
    if (armed.has(entry.activityId)) continue
    const delay = entry.fireAt - now
    // setTimeout 24,8 günden uzun gecikmede taşar; o kadar uzaktakiler
    // uygulamanın bir sonraki açılışında kurulur.
    if (delay <= 0 || delay > 2_000_000_000) continue

    armed.add(entry.activityId)
    window.setTimeout(() => {
      armed.delete(entry.activityId)
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') return
      new Notification(entry.title, { body: entry.body, tag: entry.activityId })
    }, delay)
  }
}
