/**
 * Kurumlar: başvuru, doğrulama kuyruğu, üyelik.
 *
 * CLAUDE.md Bölüm 4: "Bir kurum kendi başına kayıt olamaz. `organizations`
 * başvurusu yapar → `platform_admin` resmi belge/e-posta alan adı kontrolüyle
 * onaylar. Onaylı kurumların profilinde doğrulanmış rozeti görünür."
 *
 * ⚠️ SAPMA — kurum rolü nereden okunuyor (docs/DECISIONS.md §8):
 * Bölüm 14 kurum yetkisini custom claim'deki `orgs` haritasından okumayı
 * söylüyor ve kod bunu ÖNCE deniyor. Ama claim'i yalnız sunucu yazabilir ve
 * Blaze kapalı olduğu için sunucu yok. Bu yüzden `firestore.rules` claim'de
 * kayıt bulamazsa `organizations/{orgId}/members/{uid}` belgesine düşüyor.
 * Güvenlik eşdeğer: o belgeyi yalnız mevcut bir `org_admin` veya
 * `platform_admin` yazabilir, ilk `org_admin` ise kurumu onaylayan admin
 * tarafından atanır. Yetki yükseltme zinciri hiçbir yerde kullanıcıya
 * dönmüyor. Blaze açılınca claim yazımı geri gelir, kural fazlası zararsızdır.
 */

import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
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
import {
  EMPTY_TEXT,
  type OrgApplicationInput,
  type OrgMember,
  type OrgRole,
  type Organization,
} from '@/types/activity'

export const ORGANIZATIONS = 'organizations'
export const MEMBERS = 'members'

export function orgRef(orgId: string) {
  return doc(db, ORGANIZATIONS, orgId)
}

export function memberRef(orgId: string, uid: string) {
  return doc(db, ORGANIZATIONS, orgId, MEMBERS, uid)
}

function toOrganization(
  snapshot: DocumentSnapshot | QueryDocumentSnapshot,
): Organization {
  const data = snapshot.data() as Partial<Organization> | undefined
  return {
    id: snapshot.id,
    name: data?.name ?? '',
    type: data?.type ?? 'ngo',
    city: data?.city ?? '',
    country: data?.country ?? 'DE',
    verified: data?.verified === true,
    status: data?.status ?? 'pending',
    logoURL: data?.logoURL ?? null,
    website: data?.website ?? '',
    contactEmail: data?.contactEmail ?? '',
    description: data?.description ?? EMPTY_TEXT,
    features: { cashVouchers: data?.features?.cashVouchers === true },
    appliedBy: data?.appliedBy ?? '',
    appliedAt: data?.appliedAt ?? null,
    reviewedBy: data?.reviewedBy ?? null,
    reviewedAt: data?.reviewedAt ?? null,
    reviewNote: data?.reviewNote ?? '',
    createdAt: data?.createdAt ?? null,
    ...(data?.seed ? { seed: true } : {}),
  }
}

function toMember(snapshot: QueryDocumentSnapshot | DocumentSnapshot): OrgMember {
  const data = snapshot.data() as Partial<OrgMember> | undefined
  return {
    uid: data?.uid ?? snapshot.id,
    orgId: data?.orgId ?? '',
    role: data?.role ?? 'org_staff',
    displayName: data?.displayName ?? '',
    email: data?.email ?? '',
    addedBy: data?.addedBy ?? '',
    addedAt: data?.addedAt ?? null,
  }
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const snapshot = await getDoc(orgRef(orgId))
  return snapshot.exists() ? toOrganization(snapshot) : null
}

export function watchOrganization(
  orgId: string,
  onChange: (organization: Organization | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    orgRef(orgId),
    (snapshot) => onChange(snapshot.exists() ? toOrganization(snapshot) : null),
    onError,
  )
}

/**
 * Kurum başvurusu.
 *
 * İki belge tek commit'te yazılır:
 *   1. `organizations/{orgId}`  → status 'pending', verified false
 *   2. `organizations/{orgId}/members/{uid}` → başvuran org_admin olur
 *
 * İkincisi olmadan başvuran kendi başvurusunu göremezdi (doğrulanmamış kurumu
 * yalnız personeli okuyabiliyor). Kural, bu belgeyi yalnız `appliedBy` alanı
 * kendisi olan ve durumu `pending` olan kurumda kabul ediyor — rastgele bir
 * kullanıcı başkasının kurumuna kendini ekleyemez.
 *
 * `verified` false olduğu için bu kurum onay gelene kadar aktivite
 * YAYINLAYAMAZ (aktivite kuralı kurumu `get()` ile okuyup doğruluyor).
 */
export async function applyForOrganization(
  input: OrgApplicationInput,
  applicant: { uid: string; displayName: string; email: string },
): Promise<string> {
  const ref = doc(collection(db, ORGANIZATIONS))
  const batch = writeBatch(db)

  batch.set(ref, {
    name: input.name,
    type: input.type,
    city: input.city,
    country: 'DE',
    verified: false,
    status: 'pending',
    logoURL: null,
    website: input.website,
    contactEmail: input.contactEmail,
    description: input.description,
    // CLAUDE.md Bölüm 7.6 / 10: parasal kupon varsayılan KAPALI ve kurum
    // kendi başına açamaz — yalnız platform admin açabilir.
    features: { cashVouchers: false },
    appliedBy: applicant.uid,
    appliedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: '',
    createdAt: serverTimestamp(),
  })

  batch.set(memberRef(ref.id, applicant.uid), {
    uid: applicant.uid,
    orgId: ref.id,
    role: 'org_admin' satisfies OrgRole,
    displayName: applicant.displayName,
    email: applicant.email,
    addedBy: applicant.uid,
    addedAt: serverTimestamp(),
  })

  await batch.commit()
  return ref.id
}

/** Platform admin: onay kuyruğu. */
export function watchPendingOrganizations(
  onChange: (organizations: Organization[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, ORGANIZATIONS),
    where('status', '==', 'pending'),
    limit(100),
  )
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map(toOrganization)),
    onError,
  )
}

/**
 * `approveOrganization` — CLAUDE.md Bölüm 12.
 *
 * Onay: `verified` true olur, doğrulanmış rozeti görünür, kurum aktivite
 * yayınlayabilir hâle gelir. Reddetme gerekçe ister; kurum gerekçeyi görür.
 */
export async function reviewOrganization(
  orgId: string,
  decision: 'approve' | 'reject',
  reviewer: string,
  note = '',
): Promise<void> {
  await updateDoc(orgRef(orgId), {
    verified: decision === 'approve',
    status: decision === 'approve' ? 'approved' : 'rejected',
    reviewedBy: reviewer,
    reviewedAt: serverTimestamp(),
    reviewNote: note,
  })
}

// --- Üyelik ----------------------------------------------------------------

export function watchOrgMembers(
  orgId: string,
  onChange: (members: OrgMember[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, ORGANIZATIONS, orgId, MEMBERS),
    (snapshot) => onChange(snapshot.docs.map(toMember)),
    onError,
  )
}

/**
 * Üye ekleme/rol değiştirme — yalnız `org_admin`.
 *
 * Kullanıcı e-postayla değil **kullanıcı kimliğiyle** eklenir: kurum personeli
 * `users` koleksiyonunda arama yapamaz (veri minimizasyonu, Bölüm 10).
 * Katılımcı profilindeki "Kurum kimliğim" alanından kendi kimliğini kopyalayıp
 * kuruma verir. E-posta ile davet Faz 6'da push/e-posta ile gelecek.
 */
export async function setOrgMember(
  orgId: string,
  member: { uid: string; role: OrgRole; displayName: string; email: string },
  actorUid: string,
): Promise<void> {
  await setDoc(
    memberRef(orgId, member.uid),
    {
      uid: member.uid,
      orgId,
      role: member.role,
      displayName: member.displayName,
      email: member.email,
      addedBy: actorUid,
      addedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function removeOrgMember(orgId: string, uid: string): Promise<void> {
  await deleteDoc(memberRef(orgId, uid))
}

/**
 * Kullanıcının üye olduğu kurumlar.
 *
 * `collectionGroup('members')` + `where('uid','==',me)`. Kurum listesini
 * kullanıcı belgesinde tutmuyoruz: orayı yalnız kullanıcı yazabiliyor, yani
 * kendine kurum rolü uydurabilirdi.
 */
export function watchMyMemberships(
  uid: string,
  onChange: (memberships: OrgMember[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collectionGroup(db, MEMBERS), where('uid', '==', uid))
  return onSnapshot(q, (snapshot) => onChange(snapshot.docs.map(toMember)), onError)
}

export async function fetchMyMemberships(uid: string): Promise<OrgMember[]> {
  const q = query(collectionGroup(db, MEMBERS), where('uid', '==', uid))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(toMember)
}

/** Kurum profili düzenleme (org_admin) — doğrulama alanlarına DOKUNMAZ. */
export async function updateOrganizationProfile(
  orgId: string,
  patch: Partial<
    Pick<Organization, 'logoURL' | 'website' | 'contactEmail' | 'description' | 'city'>
  >,
): Promise<void> {
  await updateDoc(orgRef(orgId), patch)
}

// --- Kategoriler -----------------------------------------------------------

export const CATEGORIES = 'categories'

export async function fetchCategoryIds(): Promise<string[]> {
  const snapshot = await getDocs(query(collection(db, CATEGORIES), orderBy('order')))
  return snapshot.docs.map((entry) => entry.id)
}

/** Yalnız seed/yönetim yolunda kullanılır; normal akışta kategoriler sabittir. */
export async function addCategoryDoc(data: Record<string, unknown>): Promise<void> {
  await addDoc(collection(db, CATEGORIES), data)
}
