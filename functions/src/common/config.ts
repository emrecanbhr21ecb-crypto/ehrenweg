/**
 * Cloud Functions ortak yapılandırması.
 *
 * CLAUDE.md Bölüm 1A: bölge `europe-west3` (Frankfurt) — Alman veri yerleşimi.
 * CLAUDE.md Bölüm 3:  AI model adı KODA SABİTLENMEZ, yapılandırmadan gelir.
 */

import { defineSecret, defineString } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'

/** Tüm fonksiyonların bölgesi. İstemcideki FUNCTIONS_REGION ile AYNI olmalı. */
export const REGION = 'europe-west3'

setGlobalOptions({
  region: REGION,
  // Maliyet koruması: kaçak bir döngü faturayı patlatmasın.
  // (CLAUDE.md Bölüm 0 kural 2 — para ilgili her şeyde temkinli ol.)
  maxInstances: 10,
  memory: '256MiB',
  timeoutSeconds: 60,
  // Soğuk başlatmayı azaltmak için Faz 9'da minInstances değerlendirilecek —
  // ÜCRETLİ olduğu için şimdi AÇILMIYOR.
})

// --- Sırlar (Google Secret Manager) ----------------------------------------
// Değerleri ASLA kodda durmaz. Tanımlama:
//   firebase functions:secrets:set ANTHROPIC_API_KEY --project ehrenweg-dev
// Sadece ihtiyacı olan fonksiyon `secrets: [X]` ile talep eder.

/** Anthropic Claude API anahtarı — yalnızca AI fonksiyonlarında. */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

/** Kupon QR'ını imzalayan HMAC sırrı (60 sn ömürlü token). Bölüm 7.4. */
export const VOUCHER_HMAC_SECRET = defineSecret('VOUCHER_HMAC_SECRET')

/** Yoklama QR kodlarını imzalayan HMAC sırrı (dönen kod). Bölüm 12. */
export const ATTENDANCE_HMAC_SECRET = defineSecret('ATTENDANCE_HMAC_SECRET')

// --- Yapılandırma parametreleri (sır değil, deploy'da sorulur/varsayılan) ---

/**
 * Kullanılacak Claude modeli. Koda sabitlenmez (CLAUDE.md Bölüm 3) — model
 * değişince yeniden deploy yeter, kod değişmez.
 */
export const AI_MODEL = defineString('AI_MODEL', {
  default: 'claude-sonnet-5',
  description: 'Anthropic model kimliği (ör. claude-sonnet-5, claude-opus-5)',
})

/** Kupon QR token'ının ömrü (saniye). Bölüm 7.4: 60 sn. */
export const VOUCHER_QR_TTL_SECONDS = 60

/** AI çağrıları için kullanıcı başına günlük sınır (Bölüm 12 rate limit). */
export const AI_DAILY_LIMIT = 30

/** Yoklama QR'ının varsayılan dönme aralığı (saniye). Bölüm 5. */
export const DEFAULT_ROTATION_SECONDS = 30

/** Emülatörde mi çalışıyoruz? */
export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'
