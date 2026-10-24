/**
 * DSGVO araçları — Art. 20 (veri taşınabilirliği) ve Art. 17 (silme hakkı).
 *
 * CLAUDE.md Bölüm 9 (Profile ekranı): "PDF pasaport indir … hesabımı sil …
 * verilerimi indir". Bölüm 15 Faz 7 bitti ölçütü: "Hesap silme tüm izleri
 * kaldırıyor, ledger anonimleşiyor".
 *
 * ⚠️ MİMARİ SAPMA (docs/DECISIONS.md §13) — CLAUDE.md Bölüm 12 bunu
 * `exportMyData` ve `deleteMyAccount` Cloud Function'larına veriyor. Blaze
 * kapalı olduğu için sunucu yok; ikisi de istemcide, kullanıcının KENDİ
 * verisi üzerinde, `firestore.rules`teki dar izinlerle çalışır.
 *
 * Silme stratejisi — hangi belge ne olur:
 *   · users/{uid}                          → SİLİNİR (profilin kendisi)
 *   · users/{uid}/private/settings          → SİLİNİR
 *   · organizations/{orgId}/members/{uid}   → SİLİNİR (kendi üyeliği)
 *   · trainerApplications/{uid}             → SİLİNİR
 *   · attendanceRecords.displayName         → boşaltılır (belge kalır)
 *   · applicants.applicantName (aktivite altındaki alt koleksiyon) → boşaltılır
 *   · vouchers.holderName/holderPhotoURL    → boşaltılır (belge kalır)
 *   · ledger / passportEntries              → DOKUNULMAZ
 *
 * Son ikisi hiçbir zaman ad, e-posta, fotoğraf TAŞIMADI (bkz. CLAUDE.md
 * Bölüm 5 şeması) — yalnızca `uid` ile referans veriyorlar. `users/{uid}`
 * silinince o `uid` artık hiçbir profile çözülemez; Bölüm 10'daki "ledger
 * anonimleştirilir, silinmez" şartı böyle sağlanıyor, ayrı bir yazma
 * gerekmiyor.
 *
 * Bilinen, bilinçli olarak KAPSAM DIŞI bırakılanlar (bir sonraki Blaze
 * fazında otomatik temizliğe taşınacak, docs/PRIVACY.md'de yazılı):
 *   · pendingClaims.photoDataUrl (kanıt fotoğrafı) — kısa ömürlü inceleme
 *     kuyruğu, birkaç gün içinde karara bağlanıp zaten anlamını yitiriyor.
 *   · feedback.comment (aktivite altındaki alt koleksiyon) — eğitmen
 *     değerlendirmesi, kurumun kalite kaydının parçası; BazaltGo'daki gibi
 *     silinmez, gizlenir.
 */

import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { memberRef } from '@/lib/organizations'
import { trainerApplicationRef } from '@/lib/trainer'
import { fetchUserProfile, userDocRef } from '@/lib/userProfile'
import type { Application } from '@/types/activity'
import type { AttendanceRecord, PassportEntry } from '@/types/attendance'
import type { LedgerEntry, Voucher } from '@/types/reward'
import type { TrainerApplication } from '@/types/trainer'
import type { UserDoc } from '@/types/user'

// --- Dışa aktarma (DSGVO Art. 20) -------------------------------------------

export interface MyDataExport {
  exportedAt: string
  profile: UserDoc | null
  settings: Record<string, unknown> | null
  applications: Application[]
  attendanceRecords: AttendanceRecord[]
  passportEntries: PassportEntry[]
  vouchers: Voucher[]
  ledger: LedgerEntry[]
  trainerApplication: TrainerApplication | null
}

/**
 * Kullanıcının tüm verisini tek bir JSON nesnesinde toplar.
 *
 * Her sorgu `where('uid','==',uid)` ile sınırlı ve `firestore.rules` zaten
 * bunun DIŞINA çıkan hiçbir belgeyi döndürmez — kural burada ikinci bir
 * güvenlik katmanı, asıl güvence rules tarafında.
 */
export async function exportMyData(uid: string): Promise<MyDataExport> {
  const [
    profile,
    settingsSnapshot,
    applicationsSnapshot,
    attendanceSnapshot,
    passportSnapshot,
    voucherSnapshot,
    ledgerSnapshot,
    trainerSnapshot,
  ] = await Promise.all([
    fetchUserProfile(uid),
    getDoc(doc(db, 'users', uid, 'private', 'settings')),
    getDocs(
      query(collectionGroup(db, 'applicants'), where('uid', '==', uid), limit(500)),
    ),
    getDocs(
      query(collection(db, 'attendanceRecords'), where('uid', '==', uid), limit(500)),
    ),
    getDocs(
      query(collection(db, 'passportEntries'), where('uid', '==', uid), limit(500)),
    ),
    getDocs(query(collection(db, 'vouchers'), where('uid', '==', uid), limit(500))),
    getDocs(query(collection(db, 'ledger'), where('uid', '==', uid), limit(1000))),
    getDoc(trainerApplicationRef(uid)),
  ])

  return {
    exportedAt: new Date().toISOString(),
    profile,
    settings: settingsSnapshot.exists() ? settingsSnapshot.data() : null,
    applications: applicationsSnapshot.docs.map(
      (snapshot) => snapshot.data() as Application,
    ),
    attendanceRecords: attendanceSnapshot.docs.map(
      (snapshot) => snapshot.data() as AttendanceRecord,
    ),
    passportEntries: passportSnapshot.docs.map(
      (snapshot) => snapshot.data() as PassportEntry,
    ),
    vouchers: voucherSnapshot.docs.map((snapshot) => snapshot.data() as Voucher),
    ledger: ledgerSnapshot.docs.map((snapshot) => snapshot.data() as LedgerEntry),
    trainerApplication: trainerSnapshot.exists()
      ? (trainerSnapshot.data() as TrainerApplication)
      : null,
  }
}

/** Dışa aktarımı JSON dosyası olarak indirir. */
export function downloadMyData(data: MyDataExport, uid: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ehrenweg-meine-daten-${uid.slice(0, 8)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --- Hesap silme (DSGVO Art. 17) --------------------------------------------

export interface DeletionReport {
  attendanceRecordsRedacted: number
  applicantsRedacted: number
  vouchersRedacted: number
  membershipsRemoved: number
  trainerApplicationRemoved: boolean
  settingsRemoved: boolean
}

/**
 * Firestore tarafındaki tüm izleri kaldırır/anonimleştirir. Auth hesabının
 * kendisi BURADA silinmez — çağıran taraf bunu başarıyla bitirdikten sonra
 * `authService.deleteAuthAccount()` çağırmalı (oturum kaybolmadan önce tüm
 * Firestore yazmaları tamamlanmış olmalı).
 *
 * Adımlar bağımsızdır ve sırası önemli değildir; biri başarısız olursa
 * hata fırlatılır ve geri kalanlar denenmemiş kalabilir — kullanıcı tekrar
 * deneyebilir, her adım idempotent (zaten boşsa/yoksa bir daha dokunmaz).
 */
export async function redactMyTraces(uid: string): Promise<DeletionReport> {
  const report: DeletionReport = {
    attendanceRecordsRedacted: 0,
    applicantsRedacted: 0,
    vouchersRedacted: 0,
    membershipsRemoved: 0,
    trainerApplicationRemoved: false,
    settingsRemoved: false,
  }

  const [attendanceSnapshot, applicantsSnapshot, voucherSnapshot, membershipSnapshot] =
    await Promise.all([
      getDocs(
        query(collection(db, 'attendanceRecords'), where('uid', '==', uid), limit(500)),
      ),
      getDocs(
        query(collectionGroup(db, 'applicants'), where('uid', '==', uid), limit(500)),
      ),
      getDocs(query(collection(db, 'vouchers'), where('uid', '==', uid), limit(500))),
      getDocs(
        query(collectionGroup(db, 'members'), where('uid', '==', uid), limit(50)),
      ),
    ])

  // `!= ''` sorgusu yerine istemcide filtrelenir: ayrı bir alan + eşitsizlik
  // birleşimi yeni bir bileşik indeks ister, oysa "zaten boşsa dokunma"
  // kontrolünü tek bir alan sorgusunun sonuçları üzerinde ucuza yapabiliriz.
  for (const snapshot of attendanceSnapshot.docs) {
    const current = snapshot.data() as Partial<AttendanceRecord>
    if (!current.displayName) continue
    await updateDoc(doc(db, 'attendanceRecords', snapshot.id), { displayName: '' })
    report.attendanceRecordsRedacted += 1
  }

  for (const snapshot of applicantsSnapshot.docs) {
    const current = snapshot.data() as Partial<Application>
    if (!current.applicantName) continue
    await updateDoc(snapshot.ref, { applicantName: '' })
    report.applicantsRedacted += 1
  }

  for (const snapshot of voucherSnapshot.docs) {
    const current = snapshot.data() as Partial<Voucher>
    if (!current.holderName && !current.holderPhotoURL) continue
    await updateDoc(doc(db, 'vouchers', snapshot.id), {
      holderName: '',
      holderPhotoURL: null,
    })
    report.vouchersRedacted += 1
  }

  for (const snapshot of membershipSnapshot.docs) {
    const data = snapshot.data() as { orgId?: string }
    if (!data.orgId) continue
    await deleteDoc(memberRef(data.orgId, uid))
    report.membershipsRemoved += 1
  }

  const trainerSnapshot = await getDoc(trainerApplicationRef(uid))
  if (trainerSnapshot.exists()) {
    await deleteDoc(trainerApplicationRef(uid))
    report.trainerApplicationRemoved = true
  }

  const settingsRef = doc(db, 'users', uid, 'private', 'settings')
  const settingsSnapshot = await getDoc(settingsRef)
  if (settingsSnapshot.exists()) {
    await deleteDoc(settingsRef)
    report.settingsRemoved = true
  }

  // Profil belgesi EN SON silinir: yukarıdaki adımların bazıları (ör.
  // `organizations/*/members` kuralındaki `isSelf`) oturumun `uid`'sine
  // bakıyor, profil belgesinin VARLIĞINA değil — sıra onlar için önemsiz.
  // Yine de son adım olarak bırakmak, yarıda kalan bir silmede kullanıcının
  // "hesabım hâlâ var mı?" sorusuna net bir cevap vermeyi kolaylaştırıyor.
  await deleteDoc(userDocRef(uid))

  return report
}
