/**
 * Çevrimdışı tarama kuyruğu — CLAUDE.md Bölüm 2:
 * "internet yoksa tarama çevrimdışı kuyruğa alınır, gelince gönderilir".
 *
 * Neden Firestore'un kendi çevrimdışı kuyruğu yetmiyor: Firestore yazmayı
 * kuyruğa alır ama `submitScan` önce oturumu OKUMAK zorunda (aktif mi, GPS
 * istiyor mu). Çevrimdışıyken o okuma önbellekte yoksa akış hiç başlamıyor.
 * Ayrıca kullanıcıya "3 tarama bekliyor" demek gerekiyor; Firestore'un iç
 * kuyruğu dışarıdan sayılamıyor.
 *
 * Kuyruk `localStorage`'da: uygulama kapatılıp açılsa bile tarama kaybolmaz.
 */

import { parseQrPayload, type ScannedCode } from '@/types/attendance'

const STORAGE_KEY = 'ehrenweg.scanQueue'

/** Bir tarama en fazla bu kadar bekler; sonra kurum elle onaylamalı. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface QueuedScan {
  /** Ham QR metni — çözümlemeyi gönderirken tekrar yaparız. */
  raw: string
  /** Cihaz saatiyle tarama anı. Sunucuya kanıt değil, sıralama içindir. */
  scannedAtMs: number
}

function read(): QueuedScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return (parsed as QueuedScan[]).filter(
      (entry) => now - entry.scannedAtMs < MAX_AGE_MS,
    )
  } catch {
    return []
  }
}

function write(entries: QueuedScan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Depolama kapalıysa kuyruk tutulamaz; arayüz taramanın gitmediğini söyler.
  }
}

export function queuedCount(): number {
  return read().length
}

export function enqueueScan(raw: string): void {
  const entries = read()
  // Aynı QR iki kez kuyruğa girmesin (kullanıcı ekrana iki kez tuttu).
  if (entries.some((entry) => entry.raw === raw)) return
  entries.push({ raw, scannedAtMs: Date.now() })
  write(entries)
  notify()
}

export function clearQueue(): void {
  write([])
  notify()
}

// --- Abonelik: bekleyen sayısı arayüzde canlı görünsün ---------------------

type Listener = (count: number) => void
const listeners = new Set<Listener>()

function notify(): void {
  const count = queuedCount()
  for (const listener of listeners) listener(count)
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener)
  listener(queuedCount())
  return () => listeners.delete(listener)
}

export interface FlushResult {
  sent: number
  late: number
  failed: number
}

/**
 * Kuyruğu boşaltır.
 *
 * `send` bir taramayı göndermeyi dener; kod süresi geçmişse `late` yolunu
 * kullanır (kayıt `pending_review` açılır, kurum onaylar). Gönderilemeyen
 * kuyrukta kalır — ağ hatası taramayı çöpe atmamalı.
 */
export async function flushQueue(
  send: (scan: ScannedCode, expired: boolean) => Promise<void>,
): Promise<FlushResult> {
  const entries = read()
  if (entries.length === 0) return { sent: 0, late: 0, failed: 0 }

  const remaining: QueuedScan[] = []
  const result: FlushResult = { sent: 0, late: 0, failed: 0 }

  for (const entry of entries) {
    const parsed = parseQrPayload(entry.raw)
    if (!parsed) {
      // Bozuk kayıt: kuyrukta sonsuza kadar kalmasın.
      continue
    }

    const expired = parsed.expiresAt < Date.now()
    try {
      await send(parsed, expired)
      if (expired) result.late += 1
      else result.sent += 1
    } catch (error) {
      console.warn('[scanQueue] Gönderilemedi, kuyrukta kalıyor:', error)
      remaining.push(entry)
      result.failed += 1
    }
  }

  write(remaining)
  notify()
  return result
}

/** Tarayıcı çevrimiçi mi? Capacitor'da da `navigator.onLine` doğru çalışır. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
