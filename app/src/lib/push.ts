/**
 * Push bildirimleri — CLAUDE.md Bölüm 12, Bölüm 1A (kanal adları).
 *
 * ⚠️ İKİ YARIM var ve yalnız biri bugün çalışıyor:
 *   · **Alma tarafı** (izin, jeton kaydı, kanal) → burada, çalışıyor.
 *   · **Gönderme tarafı** (FCM'e istek) → sunucu işi, Blaze kapalı.
 *     `functions/src/notifications.ts` içinde yazılı.
 *
 * Yani bugün jeton toplanıyor ve saklanıyor; Blaze açıldığı gün gönderim
 * hiçbir istemci değişikliği olmadan başlıyor. Jetonları şimdiden toplamak
 * bilinçli: o gün mevcut kullanıcılara da ulaşabilelim.
 *
 * Yerel bildirimler (bir gün önce hatırlatma) push'tan BAĞIMSIZ ve Faz 2'den
 * beri çalışıyor — bkz. `lib/reminders.ts`.
 */

import { BRAND } from '@/config/brand'
import { registerPushToken } from '@/lib/announcements'

export type PushState =
  | 'unsupported'
  | 'denied'
  | 'granted'
  | 'pending'
  /** İzin verildi ama sunucu tarafı henüz yok (Blaze kapalı). */
  | 'granted_no_server'

/** Capacitor eklentisini yalnız yerel platformda ve isteğe bağlı yükler. */
async function pushPlugin(): Promise<
  typeof import('@capacitor/push-notifications').PushNotifications | null
> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null
    const module = await import('@capacitor/push-notifications')
    return module.PushNotifications
  } catch {
    return null
  }
}

/**
 * İzin ister, jetonu kaydeder.
 *
 * Tarayıcıda çalışmaz: web push ayrı bir altyapı (VAPID + service worker) ve
 * hedef kitle uygulamayı telefondan kullanıyor. Web'de sessizce
 * `unsupported` dönüyoruz, arayüz de bunu dürüstçe söylüyor.
 */
export async function enablePush(uid: string): Promise<PushState> {
  const plugin = await pushPlugin()
  if (!plugin) return 'unsupported'

  try {
    let permission = await plugin.checkPermissions()
    if (
      permission.receive === 'prompt' ||
      permission.receive === 'prompt-with-rationale'
    ) {
      permission = await plugin.requestPermissions()
    }
    if (permission.receive !== 'granted') return 'denied'

    // Jeton olayla geliyor; söz verip bekliyoruz ki çağıran taraf
    // "kaydedildi" diyebilsin.
    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10_000)

      void plugin.addListener('registration', (value) => {
        clearTimeout(timeout)
        resolve(value.value)
      })
      void plugin.addListener('registrationError', (error) => {
        clearTimeout(timeout)
        console.error('[push] Kayıt hatası:', error)
        resolve(null)
      })
      void plugin.register()
    })

    if (!token) return 'pending'

    await registerPushToken(uid, token)
    return 'granted_no_server'
  } catch (error) {
    console.error('[push] Açılamadı:', error)
    return 'unsupported'
  }
}

/** Bildirim kanalı adı — Android kanal başlığı (Bölüm 1A). */
export function channelName(locale: string): string {
  return locale === 'en' ? BRAND.pushChannel.en : BRAND.pushChannel.de
}
