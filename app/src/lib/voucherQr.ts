/**
 * 60 saniyelik kupon QR'ı ve vezne tarafı — CLAUDE.md Bölüm 7.4.
 *
 * "Kullanıcının uygulamasında kupon, kısa ömürlü (60 sn), sunucu imzalı QR
 *  olarak gösterilir. Ekran görüntüsü tekrar kullanılamaz."
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ MİMARİ SAPMA (docs/DECISIONS.md §10) — Faz 3'teki yoklama QR'ıyla aynı
 * numara: imza HESAPLANMIYOR, SAKLANIYOR.
 *
 *   1. Kupon sahibinin cihazı rastgele bir `nonce` üretip
 *      `vouchers/{id}/qr/current` belgesine yazıyor.
 *   2. O belge **hiçbir istemciye okunmuyor** — vezne bile okuyamıyor.
 *   3. Vezne taradığı nonce'u kupona yazıyor; **kural** okunamayan belgeyi
 *      `get()` ile okuyup karşılaştırıyor.
 *
 * Kritik ayrıntı: kullanıcı token'ı kendi yazıyor ama kural
 * `expiresAt == request.time + 60 sn` diyor. Yani uzun ömürlü bir token
 * üretip ekran görüntüsünü arkadaşına gönderemiyor — 60 saniye sonra o
 * nonce ölü, yeni nonce'u da ancak kuponun sahibi yazabiliyor.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { VOUCHERS } from '@/lib/rewards'
import { VOUCHER_QR_TTL_SECONDS, buildVoucherQr, type Voucher } from '@/types/reward'

const QR_SUB = 'qr'
const TOKEN_DOC = 'current'

export function voucherTokenRef(voucherId: string) {
  return doc(db, VOUCHERS, voucherId, QR_SUB, TOKEN_DOC)
}

const NONCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Tahmin edilemez nonce. `Math.random` KULLANILMAZ. */
function randomNonce(length = 24): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += NONCE_ALPHABET[byte % NONCE_ALPHABET.length]
  return out
}

export interface VoucherToken {
  nonce: string
  expiresAtMs: number
  payload: string
}

/**
 * Yeni bir 60 sn'lik token üretip okunamayan belgeye yazar.
 *
 * `expiresAt` istemci saatiyle yazılıyor çünkü `serverTimestamp()` üstüne
 * süre eklenemiyor. Kural bunu ARALIKLA doğruluyor:
 * `request.time < expiresAt <= request.time + 90 sn`. Eşitlik aranamaz —
 * ağ gecikmesi ve saat kayması yüzünden hiçbir zaman tutmazdı. Aralık,
 * saatini ileri alan bir cihazın uzun ömürlü token yazmasını yine
 * engelliyor.
 */
export async function refreshVoucherToken(voucherId: string): Promise<VoucherToken> {
  const nonce = randomNonce()
  const expiresAtMs = Date.now() + VOUCHER_QR_TTL_SECONDS * 1000

  await setDoc(voucherTokenRef(voucherId), {
    nonce,
    // Kural: request.time < expiresAt <= request.time + 90 sn.
    expiresAt: new Date(expiresAtMs),
    createdAt: serverTimestamp(),
  })

  return {
    nonce,
    expiresAtMs,
    payload: buildVoucherQr({ voucherId, expiresAtMs, signature: nonce }),
  }
}

/** Kuponun QR gösterilebilir olup olmadığı — arayüz için hızlı kontrol. */
export function canShowQr(voucher: Voucher): boolean {
  return voucher.status === 'issued' && voucher.expiresAt.toMillis() > Date.now()
}
