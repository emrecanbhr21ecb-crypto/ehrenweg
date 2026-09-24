/**
 * Denetim kaydı (auditLog).
 *
 * CLAUDE.md Bölüm 7.5: "tüm manuel onaylar auditLog'a."
 * CLAUDE.md Bölüm 9:   platform admin ekranında audit log görünür.
 *
 * Kayıtlar yalnızca EKLENİR; güncelleme/silme yoktur (Firestore Rules de
 * istemciden yazmayı tamamen kapatır).
 */

import { logger } from 'firebase-functions'

import { COL, FieldValue, db } from './admin'

export type AuditAction =
  // roller
  | 'role.set'
  | 'trainer.reviewed'
  | 'organization.approved'
  | 'organization.rejected'
  // içerik
  | 'activity.reviewed'
  | 'activity.cancelled'
  | 'application.decided'
  // yoklama
  | 'attendance.session_started'
  | 'attendance.session_stopped'
  | 'attendance.manually_approved'
  | 'attendance.rejected'
  // para
  | 'reward.template_created'
  | 'reward.budget_changed'
  | 'voucher.issued'
  | 'voucher.redeemed'
  | 'voucher.revoked'
  | 'ledger.adjustment'
  // bakım
  | 'account.deleted'
  | 'data.exported'

export interface AuditEntry {
  action: AuditAction
  /** İşlemi YAPAN kullanıcı. */
  actorUid: string
  /** İşlemin HEDEFİ (kullanıcı, aktivite, kupon kimliği …). */
  targetId?: string
  orgId?: string
  /** Serbest metin gerekçe — kişisel veri YAZILMAZ. */
  reason?: string
  /** Ek bağlam. Hassas veri konmaz. */
  meta?: Record<string, string | number | boolean | null>
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.collection(COL.auditLog).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    // Denetim yazımı asıl işlemi ÇÖKERTMEMELİ; ama sessizce de kaybolmamalı.
    logger.error('auditLog yazılamadı', { action: entry.action, error })
  }
}
