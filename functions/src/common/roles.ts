/**
 * Roller ve yetki modeli (CLAUDE.md Bölüm 4).
 *
 * Yetki kaynağı **Firebase Auth custom claims**'tir. Firestore'daki rol alanı
 * yalnızca görüntüleme içindir ve ASLA yetki kontrolünde kullanılmaz.
 * Claim'leri yalnızca Cloud Functions değiştirebilir.
 *
 * Claim şekli:
 *   {
 *     role: 'participant' | 'trainer' | 'platform_admin',   // platform geneli
 *     orgs: { [orgId]: 'org_admin'|'org_staff'|'redemption_officer'|'partner' }
 *   }
 *
 * ⚠️ Firebase custom claims toplamı **1000 bayt** ile sınırlıdır. `orgs`
 * haritası bu sınırı zorlayabileceği için MAX_ORG_CLAIMS ile kısıtlıyoruz;
 * bir kullanıcı bundan fazla kuruma bağlanırsa üyelik Firestore'da tutulup
 * sunucu tarafında okunur (Faz 2'de gerekirse devreye girer).
 */

/** Platform geneli roller — kullanıcı başına tek. */
export const PLATFORM_ROLES = ['participant', 'trainer', 'platform_admin'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/** Kurum içi roller — kurum başına tek. */
export const ORG_ROLES = [
  'org_admin',
  'org_staff',
  'redemption_officer',
  'partner',
] as const
export type OrgRole = (typeof ORG_ROLES)[number]

/** Custom claim sınırı nedeniyle claim'e yazılacak en fazla kurum sayısı. */
export const MAX_ORG_CLAIMS = 12

export interface EhrenwegClaims {
  role: PlatformRole
  orgs?: Record<string, OrgRole>
}

export const DEFAULT_CLAIMS: EhrenwegClaims = { role: 'participant' }

export function isPlatformRole(value: unknown): value is PlatformRole {
  return (
    typeof value === 'string' && (PLATFORM_ROLES as readonly string[]).includes(value)
  )
}

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value)
}

/** Token'daki ham claim'leri güvenli bir yapıya çevirir. */
export function readClaims(token: Record<string, unknown> | undefined): EhrenwegClaims {
  const role = token?.['role']
  const orgs = token?.['orgs']

  const parsedOrgs: Record<string, OrgRole> = {}
  if (orgs && typeof orgs === 'object' && !Array.isArray(orgs)) {
    for (const [orgId, orgRole] of Object.entries(orgs as Record<string, unknown>)) {
      if (isOrgRole(orgRole)) parsedOrgs[orgId] = orgRole
    }
  }

  return {
    role: isPlatformRole(role) ? role : 'participant',
    ...(Object.keys(parsedOrgs).length > 0 ? { orgs: parsedOrgs } : {}),
  }
}

export function isPlatformAdmin(claims: EhrenwegClaims): boolean {
  return claims.role === 'platform_admin'
}

/** Kullanıcının belirtilen kurumdaki rolü (yoksa null). */
export function orgRoleOf(claims: EhrenwegClaims, orgId: string): OrgRole | null {
  return claims.orgs?.[orgId] ?? null
}

/**
 * Kullanıcı bu kurumda verilen rollerden birine sahip mi?
 * platform_admin her kurumda yetkilidir.
 */
export function hasOrgRole(
  claims: EhrenwegClaims,
  orgId: string,
  allowed: readonly OrgRole[],
): boolean {
  if (isPlatformAdmin(claims)) return true
  const role = orgRoleOf(claims, orgId)
  return role !== null && allowed.includes(role)
}
