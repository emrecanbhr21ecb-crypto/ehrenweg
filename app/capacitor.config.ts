import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor yapılandırması (CLAUDE.md Bölüm 1A ve 16).
 *
 * appId burada PROD kimliğidir. Dev varyantı (`de.ehrenweg.app.dev`) Gradle
 * product flavor'ındaki `applicationIdSuffix ".dev"` ile üretilir — bu dosyada
 * DEĞİL. İkisi aynı cihaza birlikte kurulabilir.
 *
 * Native platformlar (android/, ios/) Faz 8'de eklenecek; bu dosya o ana kadar
 * yalnızca kimliğin tek yerde durmasını sağlar.
 */
const config: CapacitorConfig = {
  appId: 'de.ehrenweg.app',
  appName: 'Ehrenweg',
  webDir: 'dist',

  android: {
    // Kendi imzalı APK'mızda karışık içerik (http) yasak
    allowMixedContent: false,
  },

  ios: {
    contentInset: 'automatic',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0B1220',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // Telefonda canlı yeniden yükleme için Faz 1'de geçici olarak açılabilir:
  // server: { url: 'http://192.168.x.x:5173', cleartext: true },
}

export default config
