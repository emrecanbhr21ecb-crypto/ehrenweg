/**
 * Demo APK'sı için otomatik giriş.
 *
 * ⚠️ YALNIZCA `VITE_DEMO_AUTOLOGIN=true` ile derlenen gösterim yapısında
 * çalışır. Normal `npm run build` ve `npm run dev` bu dosyaya hiç girmez;
 * bayrak yoksa fonksiyon ilk satırda çıkar.
 *
 * Neden var: yatırımcı gösteriminde kayıt → e-posta doğrulama adımı akışı
 * bölüyor ve telefonda posta kutusu açmayı gerektiriyor. Demo yapısında
 * uygulama hazır, doğrulanmış bir hesapla açılıyor.
 *
 * Kimlik bilgisi pakette görünür — bu bilinçli. Hesap yalnızca seed
 * verisine sahip gösterim projesine ait; gerçek kullanıcı verisi yok.
 * Gerçek yayında bu bayrak KAPALI olacak.
 */

import { signInWithEmailAndPassword } from 'firebase/auth'

import { auth } from '@/lib/firebase'

export const DEMO_AUTOLOGIN = import.meta.env['VITE_DEMO_AUTOLOGIN'] === 'true'

const EMAIL = import.meta.env['VITE_DEMO_EMAIL'] ?? ''
const PASSWORD = import.meta.env['VITE_DEMO_PASSWORD'] ?? ''

let attempted = false

/**
 * Oturum yoksa demo hesabıyla girer. Bir kez denenir: şifre yanlışsa
 * sonsuz döngüye girip Auth kotasını yakmasın.
 */
export async function tryDemoAutoLogin(): Promise<void> {
  if (!DEMO_AUTOLOGIN || attempted) return
  if (!EMAIL || !PASSWORD) return
  if (auth.currentUser) return

  attempted = true
  try {
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
    console.info('[demo] Otomatik giriş yapıldı.')
  } catch (error) {
    console.error('[demo] Otomatik giriş başarısız:', error)
  }
}
