/**
 * Yoklama: oturum başlat/durdur, dönen kod, tarama, geç onay.
 *
 * CLAUDE.md Bölüm 2 (BazaltGo yoklama satırı), Bölüm 5, Bölüm 12.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ MİMARİ SAPMA — QR nasıl imzalanıyor (docs/DECISIONS.md §9)
 *
 * Spesifikasyon (Bölüm 12): `getCurrentCode` her `rotationSeconds`'da
 * `ATTENDANCE_HMAC_SECRET` ile imzalı yeni bir kod üretir, `submitScan`
 * imzayı doğrular. Bu Cloud Functions ister; Blaze kapalı.
 *
 * Sırrı istemciye koymak ÇÖZÜM DEĞİL: paketten çıkarılır ve herkes etkinliğe
 * hiç gitmeden geçerli QR üretir. Bu yüzden:
 *
 *   1. Kurum cihazı her turda `crypto.getRandomValues` ile tahmin edilemez
 *      bir `nonce` üretir ve `attendanceSessions/{id}/codes/current`
 *      belgesine yazar.
 *   2. O belge **hiçbir istemciye okunmaz** (`allow read: if false`).
 *   3. Katılımcı taradığı `nonce`'u yoklama kaydına yazar; **Firestore kuralı**
 *      belgeyi `get()` ile okuyup karşılaştırır. Kurallar okuma izinlerine
 *      tabi değildir — doğrulama yine sunucu tarafında yapılır.
 *
 * Güvenlik sonucu HMAC'lisiyle aynı: kod tahmin edilemez, uzaktan okunamaz,
 * 30 saniyede ölür, ekran görüntüsü işe yaramaz. Fark yalnız imzanın
 * hesaplanması yerine saklanması.
 *
 * Blaze açılınca: `functions/src/attendance.ts` içindeki `getCurrentCode` /
 * `submitScan` devreye girer, QR yükü DEĞİŞMEZ, kuraldaki istemci yazma
 * izinleri `if false` olur.
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { distanceKm } from '@/lib/geo'
import {
  DEFAULT_GEO_RADIUS_METERS,
  DEFAULT_ROTATION_SECONDS,
  ScanFailure,
  attendanceRecordId,
  buildQrPayload,
  type AttendanceRecord,
  type AttendanceSession,
  type RecordStatus,
  type ScanMethod,
  type ScannedCode,
} from '@/types/attendance'

export const SESSIONS = 'attendanceSessions'
export const RECORDS = 'attendanceRecords'
/** Okunamayan kod belgesinin sabit kimliği. */
export const CODE_DOC = 'current'
export const CODES = 'codes'

export function sessionRef(sessionId: string) {
  return doc(db, SESSIONS, sessionId)
}

export function codeRef(sessionId: string) {
  return doc(db, SESSIONS, sessionId, CODES, CODE_DOC)
}

export function recordRef(sessionId: string, uid: string) {
  return doc(db, RECORDS, attendanceRecordId(sessionId, uid))
}

// --- Kod üretimi -----------------------------------------------------------

const NONCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Tahmin edilemez kod. `Math.random` KULLANILMAZ — öngörülebilir. */
function randomString(length: number, alphabet = NONCE_ALPHABET): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length]
  }
  return out
}

/** 6 haneli manuel kod — QR okutamayan için (CLAUDE.md Bölüm 5). */
function randomManualCode(): string {
  return randomString(6, '0123456789')
}

export interface RotatingCode {
  codeId: string
  nonce: string
  manualCode: string
  expiresAtMs: number
  qrPayload: string
}

/**
 * Yeni bir tur kodu üretir ve okunamayan belgeye yazar.
 *
 * `manualCode` oturum boyunca SABİT kalır: QR okutamayan kişiye her 30
 * saniyede yeni bir sayı söyletmek gerçek hayatta çalışmıyor. Kısa ömrü QR
 * sağlıyor; manuel kod oturum kapanınca ölüyor.
 */
export async function rotateCode(
  sessionId: string,
  rotationSeconds: number,
  manualCode: string,
): Promise<RotatingCode> {
  const codeId = randomString(8)
  const nonce = randomString(24)
  const expiresAtMs = Date.now() + rotationSeconds * 1000

  await setDoc(codeRef(sessionId), {
    codeId,
    nonce,
    manualCode,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
  })

  return {
    codeId,
    nonce,
    manualCode,
    expiresAtMs,
    qrPayload: buildQrPayload({ sessionId, codeId, expiresAtMs, signature: nonce }),
  }
}

// --- Oturum ----------------------------------------------------------------

function toSession(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): AttendanceSession {
  const data = snapshot.data() as Partial<AttendanceSession> | undefined
  return {
    id: snapshot.id,
    activityId: data?.activityId ?? '',
    orgId: data?.orgId ?? '',
    activityTitle: data?.activityTitle ?? '',
    startedBy: data?.startedBy ?? '',
    active: data?.active === true,
    startedAt: data?.startedAt ?? null,
    endedAt: data?.endedAt ?? null,
    rotationSeconds: data?.rotationSeconds ?? DEFAULT_ROTATION_SECONDS,
    requireGeo: data?.requireGeo === true,
    geoRadiusMeters: data?.geoRadiusMeters ?? DEFAULT_GEO_RADIUS_METERS,
    geoLat: data?.geoLat ?? null,
    geoLng: data?.geoLng ?? null,
  }
}

export interface StartSessionInput {
  activityId: string
  orgId: string
  activityTitle: string
  rotationSeconds: number
  requireGeo: boolean
  geoRadiusMeters: number
  geoLat: number | null
  geoLng: number | null
}

/**
 * `startAttendanceSession` — oturumu açar ve ilk kodu yazar.
 *
 * Aynı aktivitede açık bir oturum varsa YENİSİ AÇILMAZ, var olan döner:
 * iki personel aynı anda "başlat"a basarsa iki ayrı QR ekranı çıkar ve
 * katılımcıların yarısı yanlış oturuma yazılırdı.
 */
export async function startAttendanceSession(
  input: StartSessionInput,
  startedBy: string,
): Promise<{ session: AttendanceSession; code: RotatingCode }> {
  const existing = await findActiveSession(input.activityId)
  const sessionId = existing?.id ?? doc(collection(db, SESSIONS)).id
  const manualCode = randomManualCode()

  if (!existing) {
    await setDoc(sessionRef(sessionId), {
      activityId: input.activityId,
      orgId: input.orgId,
      activityTitle: input.activityTitle,
      startedBy,
      active: true,
      startedAt: serverTimestamp(),
      endedAt: null,
      rotationSeconds: input.rotationSeconds,
      requireGeo: input.requireGeo,
      geoRadiusMeters: input.geoRadiusMeters,
      geoLat: input.geoLat,
      geoLng: input.geoLng,
    })
  }

  const code = await rotateCode(
    sessionId,
    existing?.rotationSeconds ?? input.rotationSeconds,
    manualCode,
  )

  const session = existing ?? {
    id: sessionId,
    ...input,
    startedBy,
    active: true,
    startedAt: null,
    endedAt: null,
  }

  return { session, code }
}

/** `stopAttendanceSession` — kodu siler, oturumu kapatır. */
export async function stopAttendanceSession(sessionId: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(sessionRef(sessionId), {
    active: false,
    endedAt: serverTimestamp(),
  })
  // Kod belgesi kalsaydı, kapalı oturumun son kodu hâlâ eşleşirdi.
  batch.delete(codeRef(sessionId))
  await batch.commit()
}

export async function findActiveSession(
  activityId: string,
): Promise<AttendanceSession | null> {
  const q = query(
    collection(db, SESSIONS),
    where('activityId', '==', activityId),
    where('active', '==', true),
    limit(1),
  )
  const snapshot = await getDocs(q)
  const first = snapshot.docs[0]
  return first ? toSession(first) : null
}

export async function fetchSession(
  sessionId: string,
): Promise<AttendanceSession | null> {
  const snapshot = await getDoc(sessionRef(sessionId))
  return snapshot.exists() ? toSession(snapshot) : null
}

export function watchSession(
  sessionId: string,
  onChange: (session: AttendanceSession | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    sessionRef(sessionId),
    (snapshot) => onChange(snapshot.exists() ? toSession(snapshot) : null),
    onError,
  )
}

// --- Kayıtlar --------------------------------------------------------------

function toRecord(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot,
): AttendanceRecord {
  const data = snapshot.data() as Partial<AttendanceRecord> | undefined
  return {
    id: snapshot.id,
    uid: data?.uid ?? '',
    activityId: data?.activityId ?? '',
    sessionId: data?.sessionId ?? '',
    orgId: data?.orgId ?? '',
    method: data?.method ?? 'qr',
    scannedAt: data?.scannedAt ?? null,
    status: data?.status ?? 'confirmed',
    geoOk: data?.geoOk ?? null,
    displayName: data?.displayName ?? '',
    awarded: data?.awarded === true,
    statsSnapshot: data?.statsSnapshot ?? {
      ip: 0,
      hours: 0,
      activitiesCompleted: 0,
      categoriesCount: 0,
    },
    isNewCategory: data?.isNewCategory === true,
  }
}

/** Kurum ekranındaki canlı katılımcı listesi ve sayacı. */
export function watchSessionRecords(
  sessionId: string,
  onChange: (records: AttendanceRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, RECORDS),
    where('sessionId', '==', sessionId),
    orderBy('scannedAt', 'desc'),
    limit(500),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toRecord)), onError)
}

/** Bir aktivitenin tüm kayıtları — geç onay listesi ve puanlama için. */
export function watchActivityRecords(
  activityId: string,
  onChange: (records: AttendanceRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, RECORDS),
    where('activityId', '==', activityId),
    orderBy('scannedAt', 'desc'),
    limit(500),
  )
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toRecord)), onError)
}

// --- Tarama ----------------------------------------------------------------

export interface ScanContext {
  uid: string
  displayName: string
  /** Kullanıcının o anki konumu; oturum GPS istiyorsa gerekli. */
  position: { lat: number; lng: number } | null
  /**
   * Katılımcının o andaki sayaçları.
   *
   * Neden kayda kopyalanıyor: puanı YAZAN taraf kurum cihazı (Blaze kapalı,
   * bkz. lib/passport.ts) ve kurum personeli `users` belgesini OKUYAMAZ —
   * veri minimizasyonu (Bölüm 10). Yeni seviyeyi hesaplayabilmesi için
   * eski toplamlara ihtiyacı var.
   *
   * Uydurulamaz: `firestore.rules` bu alanı `get(users/{uid}).stats` ile
   * karşılaştırıyor, tutmazsa yoklama kaydı hiç yazılmıyor.
   */
  stats: {
    ip: number
    hours: number
    activitiesCompleted: number
    categoriesCount: number
  }
  /** Bu kategoride ilk katılımı mı? Yalnız `categoriesCount` sayacını etkiler. */
  isNewCategory: boolean
}

/**
 * `submitScan` — taranan kodu yoklama kaydına çevirir.
 *
 * Hata kodları CLAUDE.md Bölüm 12'deki liste: wrong-code / expired /
 * inactive / activity-missing / already-recorded / geo-too-far.
 *
 * Buradaki kontroller kullanıcıya ANLAŞILIR HATA vermek içindir; gerçek
 * engelleme `firestore.rules` tarafında, okunamayan kod belgesiyle yapılır.
 * İstemci kontrolü atlarsa kural yazmayı reddeder.
 */
export async function submitScan(
  scanned: ScannedCode,
  context: ScanContext,
  method: ScanMethod = 'qr',
): Promise<AttendanceRecord> {
  const session = await fetchSession(scanned.sessionId)
  if (!session) throw new ScanFailure('inactive')
  if (!session.active) throw new ScanFailure('inactive')
  if (!session.activityId) throw new ScanFailure('activityMissing')

  // Süre kontrolü: QR yükündeki son kullanma. Sunucu saati değil ama kural
  // ayrıca `expiresAt` alanına bakıyor; buradaki yalnız hızlı geri bildirim.
  if (method === 'qr' && scanned.expiresAt < Date.now()) {
    throw new ScanFailure('expired')
  }

  let geoOk: boolean | null = null
  if (session.requireGeo && session.geoLat !== null && session.geoLng !== null) {
    if (!context.position) throw new ScanFailure('geoTooFar')
    const meters =
      distanceKm(context.position, { lat: session.geoLat, lng: session.geoLng }) * 1000
    geoOk = meters <= session.geoRadiusMeters
    if (!geoOk) throw new ScanFailure('geoTooFar')
  }

  const existing = await getDoc(recordRef(scanned.sessionId, context.uid))
  if (existing.exists()) throw new ScanFailure('alreadyRecorded')

  const payload = {
    uid: context.uid,
    activityId: session.activityId,
    sessionId: scanned.sessionId,
    orgId: session.orgId,
    method,
    scannedAt: serverTimestamp(),
    status: 'confirmed' satisfies RecordStatus,
    geoOk,
    displayName: context.displayName,
    awarded: false,
    statsSnapshot: context.stats,
    isNewCategory: context.isNewCategory,
    // Kural bu iki alanı okunamayan kod belgesiyle karşılaştırır.
    codeId: scanned.codeId,
    signature: scanned.signature,
  }

  try {
    await setDoc(recordRef(scanned.sessionId, context.uid), payload)
  } catch (error) {
    // Kural reddi = kod yanlış ya da süresi geçmiş. İkisini ayırt edemiyoruz
    // (kural sebep döndürmez), o yüzden en olası olanı söylüyoruz.
    console.error('[attendance] Yoklama kaydı reddedildi:', error)
    throw new ScanFailure(method === 'manual_code' ? 'wrongCode' : 'expired')
  }

  return {
    id: attendanceRecordId(scanned.sessionId, context.uid),
    uid: context.uid,
    activityId: session.activityId,
    sessionId: scanned.sessionId,
    orgId: session.orgId,
    method,
    scannedAt: null,
    status: 'confirmed',
    geoOk,
    displayName: context.displayName,
    awarded: false,
    statsSnapshot: context.stats,
    isNewCategory: context.isNewCategory,
  }
}

/**
 * Manuel kod girişi.
 *
 * Katılımcı hangi oturuma ait olduğunu bilmiyor; aktif oturumlar arasında
 * kodu eşleşeni bulmak gerekiyor ama kod belgesi OKUNAMIYOR. Çözüm: kullanıcı
 * aktiviteyi seçer (zaten detay sayfasından geliyor), oturum oradan bulunur,
 * kodu kural doğrular.
 */
export async function submitManualCode(
  activityId: string,
  manualCode: string,
  context: ScanContext,
): Promise<AttendanceRecord> {
  const session = await findActiveSession(activityId)
  if (!session) throw new ScanFailure('inactive')

  return submitScan(
    {
      sessionId: session.id,
      codeId: 'manual',
      expiresAt: Date.now() + 60_000,
      signature: manualCode.trim(),
    },
    context,
    'manual_code',
  )
}

// --- Geç / çevrimdışı taramalar (CLAUDE.md Bölüm 12 `approveLateScans`) ----

/**
 * Kurum personeli geç gelen taramayı elle onaylar.
 *
 * Çevrimdışı kuyruktan geç gelen tarama kuralda kod eşleşmesini geçemez
 * (kod çoktan döndü). İstemci bu durumda kaydı `pending_review` olarak
 * açar — kural bunu kurum personelinin onayı şartıyla kabul eder.
 */
export async function approveRecord(recordId: string): Promise<void> {
  await updateDoc(doc(db, RECORDS, recordId), {
    status: 'confirmed' satisfies RecordStatus,
    method: 'staff_approved' satisfies ScanMethod,
  })
}

export async function rejectRecord(recordId: string): Promise<void> {
  await updateDoc(doc(db, RECORDS, recordId), {
    status: 'rejected' satisfies RecordStatus,
  })
}

export async function approveRecords(recordIds: string[]): Promise<void> {
  // Firestore toplu yazma sınırı 500; geç onay listesi bunu aşmaz ama
  // yine de parçalıyoruz — sınıra dayanan bir liste sessizce yarısını yazardı.
  for (let index = 0; index < recordIds.length; index += 400) {
    const batch = writeBatch(db)
    for (const id of recordIds.slice(index, index + 400)) {
      batch.update(doc(db, RECORDS, id), {
        status: 'confirmed' satisfies RecordStatus,
        method: 'staff_approved' satisfies ScanMethod,
      })
    }
    await batch.commit()
  }
}

/**
 * Çevrimdışı kuyruktan gelen, kodu artık geçersiz tarama.
 * `pending_review` olarak açılır; kurum onaylar.
 */
export async function submitLateScan(
  scanned: ScannedCode,
  context: ScanContext,
): Promise<void> {
  const session = await fetchSession(scanned.sessionId)
  if (!session) throw new ScanFailure('inactive')

  const existing = await getDoc(recordRef(scanned.sessionId, context.uid))
  if (existing.exists()) throw new ScanFailure('alreadyRecorded')

  await setDoc(recordRef(scanned.sessionId, context.uid), {
    uid: context.uid,
    activityId: session.activityId,
    sessionId: scanned.sessionId,
    orgId: session.orgId,
    method: 'offline_late' satisfies ScanMethod,
    scannedAt: serverTimestamp(),
    status: 'pending_review' satisfies RecordStatus,
    geoOk: null,
    displayName: context.displayName,
    awarded: false,
    statsSnapshot: context.stats,
    isNewCategory: context.isNewCategory,
    codeId: scanned.codeId,
    // İmza YOK: kod çoktan döndü, doğrulanamaz. Kural bu yüzden geç kaydı
    // yalnız `pending_review` olarak kabul ediyor — puan ancak kurum
    // personeli onaylarsa yazılır.
  })
}
