/**
 * Yoklama, pasaport ve puan tipleri — CLAUDE.md Bölüm 2, 5, 6, 12.
 *
 * BazaltGo karşılıkları (Bölüm 2 tablosu):
 *   yoklamaOturumlari → attendanceSessions
 *   yoklamaKodlari    → attendanceSessions/{id}/codes
 *   yoklamaKayitlari  → attendanceRecords
 *   kullaniciPasaportu→ passportEntries
 *   bekleyenOnaylar   → pendingClaims
 */

import type { Timestamp } from 'firebase/firestore'

import type { CategoryId, SkillId } from '@/config/catalog'

// --- Yoklama oturumu -------------------------------------------------------

export interface AttendanceSession {
  id: string
  activityId: string
  orgId: string
  /** Aktivite başlığı — oturum ekranında ayrı okuma yapmamak için kopya. */
  activityTitle: string
  startedBy: string
  active: boolean
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  /** QR kaç saniyede bir değişiyor (CLAUDE.md Bölüm 5: varsayılan 30). */
  rotationSeconds: number
  /** Opsiyonel GPS kontrolü — kurum başlatırken açar. */
  requireGeo: boolean
  geoRadiusMeters: number
  /** Etkinlik konumu; `requireGeo` açıksa mesafe buradan ölçülür. */
  geoLat: number | null
  geoLng: number | null
  seed?: boolean
}

/**
 * Dönen kod. `attendanceSessions/{id}/codes/current`
 *
 * 🔒 Bu belge HİÇBİR istemciye okunmaz (`allow read: if false`). Yalnızca
 * Firestore **kuralları** `get()` ile okuyup taranan kodu doğrular — kurallar
 * okuma izinlerine tabi değildir.
 *
 * Bu tip istemcide yalnız YAZMA tarafında kullanılır (kurum cihazı üretir);
 * okuma tarafı hiçbir zaman çalışmaz.
 */
export interface AttendanceCode {
  codeId: string
  /** Kriptografik rastgele tek kullanımlık sır — QR'ın imza alanı. */
  nonce: string
  /** QR okutamayanlar için 6 haneli kod. Oturum boyunca sabit. */
  manualCode: string
  expiresAt: Timestamp
}

export const DEFAULT_ROTATION_SECONDS = 30
export const DEFAULT_GEO_RADIUS_METERS = 200

/** QR içeriği ön eki — CLAUDE.md Bölüm 1A. */
export const ATTENDANCE_QR_PREFIX = 'EHRENWEG:ATT:'

/**
 * QR yükü: `EHRENWEG:ATT:v1.<sessionId>.<codeId>.<exp>.<sig>`
 *
 * `sig` alanı iki yapıda da AYNI yeri tutar:
 *   · bugün (Blaze kapalı) → kurum cihazının ürettiği rastgele `nonce`;
 *     doğrulamayı Firestore kuralı, okunamayan `codes/current` belgesiyle
 *     karşılaştırarak yapar
 *   · Blaze açılınca        → HMAC_SHA256(ATTENDANCE_HMAC_SECRET,
 *     `sessionId|codeId|exp`); doğrulamayı `submitScan` yapar
 *
 * Yük biçimi değişmediği için okuyucu kodu aynen kalır.
 */
export interface ScannedCode {
  sessionId: string
  codeId: string
  expiresAt: number
  signature: string
}

export function buildQrPayload(code: {
  sessionId: string
  codeId: string
  expiresAtMs: number
  signature: string
}): string {
  return (
    `${ATTENDANCE_QR_PREFIX}v1.` +
    `${code.sessionId}.${code.codeId}.${code.expiresAtMs}.${code.signature}`
  )
}

/** QR metnini çözer. Bizim QR'ımız değilse null — "wrong-code" hatası. */
export function parseQrPayload(raw: string): ScannedCode | null {
  const text = raw.trim()
  if (!text.startsWith(ATTENDANCE_QR_PREFIX)) return null

  const body = text.slice(ATTENDANCE_QR_PREFIX.length)
  const parts = body.split('.')
  // v1 . sessionId . codeId . exp . sig
  if (parts.length !== 5 || parts[0] !== 'v1') return null

  const [, sessionId, codeId, exp, signature] = parts
  if (!sessionId || !codeId || !exp || !signature) return null

  const expiresAt = Number(exp)
  if (!Number.isFinite(expiresAt)) return null

  return { sessionId, codeId, expiresAt, signature }
}

// --- Yoklama kaydı ---------------------------------------------------------

export const SCAN_METHODS = [
  'qr',
  'manual_code',
  'staff_approved',
  'offline_late',
] as const
export type ScanMethod = (typeof SCAN_METHODS)[number]

export const RECORD_STATUSES = ['confirmed', 'pending_review', 'rejected'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

export interface AttendanceRecord {
  id: string
  uid: string
  activityId: string
  sessionId: string
  orgId: string
  method: ScanMethod
  scannedAt: Timestamp | null
  status: RecordStatus
  geoOk: boolean | null
  /** Kurum listesinde göstermek için kopya — `users` okunmaz (Bölüm 10). */
  displayName: string
  /** Pasaporta işlendi mi? Çift puanı engelleyen bayrak. */
  awarded: boolean
  /** Tarama anındaki sayaç kopyası — bkz. ScanContext.stats. */
  statsSnapshot: {
    ip: number
    hours: number
    activitiesCompleted: number
    categoriesCount: number
  }
  isNewCategory: boolean
}

/** Kayıt kimliği sabit: bir oturumda bir kişi bir kez. */
export function attendanceRecordId(sessionId: string, uid: string): string {
  return `${sessionId}_${uid}`
}

/** Pasaport girdisi kimliği: bir aktivite için bir kişiye bir kez puan. */
export function passportEntryId(activityId: string, uid: string): string {
  return `${activityId}_${uid}`
}

// --- Tarama hataları (CLAUDE.md Bölüm 12) ----------------------------------

export const SCAN_ERRORS = [
  'wrongCode',
  'expired',
  'inactive',
  'activityMissing',
  'alreadyRecorded',
  'geoTooFar',
  'offlineQueued',
  'notSignedIn',
  'unknown',
] as const
export type ScanErrorKey = (typeof SCAN_ERRORS)[number]

export class ScanFailure extends Error {
  readonly key: ScanErrorKey

  constructor(key: ScanErrorKey) {
    super(key)
    this.name = 'ScanFailure'
    this.key = key
  }
}

// --- Pasaport --------------------------------------------------------------

export interface PassportEntry {
  id: string
  uid: string
  activityId: string
  orgId: string
  /**
   * Dayanak yoklama oturumu. Kural bu alandan `attendanceRecords/
   * {sessionId}_{uid}` belgesini bulup gerçekten onaylı bir katılım olup
   * olmadığını doğruluyor. 'admin' kaynaklı girdilerde boş.
   */
  sessionId: string
  categoryId: CategoryId
  activityTitle: string
  hours: number
  ipAwarded: number
  skillsGained: SkillId[]
  /** 'attendance' = QR/manuel yoklama · 'admin' = elle onaylanmış iddia */
  source: 'attendance' | 'admin'
  status: 'completed'
  approvedAt: Timestamp | null
  /** Hangi bonusların uygulandığı — kullanıcıya "neden bu kadar" diyebilmek için. */
  bonuses: string[]
}

// --- "Katıldım ama yoklama alınmadı" iddiası -------------------------------

export const CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export interface PendingClaim {
  id: string
  uid: string
  activityId: string
  orgId: string
  activityTitle: string
  displayName: string
  note: string
  /**
   * Kanıt fotoğrafı — **data URL** olarak belgede.
   *
   * ⚠️ Normalde Storage'a yüklenirdi; Storage Blaze planı istiyor
   * (docs/DECISIONS.md §7). Fotoğraf istemcide 800 pikselе küçültülüp JPEG
   * olarak sıkıştırılıyor ve Firestore'un 1 MB belge sınırının altında
   * tutuluyor. Blaze açılınca alan Storage yoluna dönecek.
   */
  photoDataUrl: string
  status: ClaimStatus
  createdAt: Timestamp | null
  reviewedBy: string | null
  reviewedAt: Timestamp | null
  reviewNote: string
}

/** Fotoğraf için üst sınır — Firestore belge sınırı 1 MB. */
export const MAX_CLAIM_PHOTO_BYTES = 400_000
