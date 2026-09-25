/**
 * Aylık mutabakat raporu — CLAUDE.md Bölüm 7.4:
 * "Kurum paneli aylık CSV/PDF mutabakat raporu üretir."
 *
 * Rapor tek bir soruyu cevaplar: **bu ay kasadan ne çıktı?**
 * Verilen, kullanılan, süresi dolan, iptal edilen kuponlar ve kalan bütçe.
 *
 * PDF için kütüphane YOK: rapor yazdırma için biçimlendirilmiş bir sayfa
 * olarak açılıyor ve `window.print()` çağrılıyor. Tarayıcı/telefon "PDF
 * olarak kaydet" seçeneğini kendi veriyor. 300 kB'lık bir PDF kütüphanesini
 * pakete koymak, hedef kitlenin mobil verisine ödettiğimiz gereksiz bir
 * bedel olurdu.
 */

import {
  formatCents,
  monthKey,
  type RewardTemplate,
  type Voucher,
} from '@/types/reward'

export interface ReconciliationRow {
  month: string
  issuedCount: number
  issuedCents: number
  redeemedCount: number
  redeemedCents: number
  expiredCount: number
  expiredCents: number
  revokedCount: number
  revokedCents: number
}

export interface ReconciliationReport {
  rows: ReconciliationRow[]
  totals: ReconciliationRow
  budgetTotalCents: number
  budgetSpentCents: number
  budgetRemainingCents: number
}

function emptyRow(month: string): ReconciliationRow {
  return {
    month,
    issuedCount: 0,
    issuedCents: 0,
    redeemedCount: 0,
    redeemedCents: 0,
    expiredCount: 0,
    expiredCents: 0,
    revokedCount: 0,
    revokedCents: 0,
  }
}

/**
 * Kuponları aya göre toplar.
 *
 * Ay ataması **basım tarihine** göre yapılıyor; kullanım başka bir ayda
 * olabilir ve o satırda ayrıca görünür. Kurumun bütçesi basımda bağlanıyor,
 * bu yüzden bütçe takibinin çapası basım ayı.
 */
export function buildReconciliation(
  vouchers: Voucher[],
  templates: RewardTemplate[],
): ReconciliationReport {
  const byMonth = new Map<string, ReconciliationRow>()
  const totals = emptyRow('total')
  const now = new Date()

  for (const voucher of vouchers) {
    const issuedAt = voucher.issuedAt?.toDate() ?? now
    const key = monthKey(issuedAt)
    const row = byMonth.get(key) ?? emptyRow(key)

    row.issuedCount += 1
    row.issuedCents += voucher.valueCents
    totals.issuedCount += 1
    totals.issuedCents += voucher.valueCents

    // Süresi geçmiş ama henüz işaretlenmemiş kuponlar da "süresi dolan"
    // sayılır — rapor, işaretleme gecikmesini kuruma yansıtmamalı.
    const expiredByTime =
      voucher.status === 'issued' &&
      voucher.expiresAt.toDate().getTime() < now.getTime()

    if (voucher.status === 'redeemed') {
      row.redeemedCount += 1
      row.redeemedCents += voucher.valueCents
      totals.redeemedCount += 1
      totals.redeemedCents += voucher.valueCents
    } else if (voucher.status === 'expired' || expiredByTime) {
      row.expiredCount += 1
      row.expiredCents += voucher.valueCents
      totals.expiredCount += 1
      totals.expiredCents += voucher.valueCents
    } else if (voucher.status === 'revoked') {
      row.revokedCount += 1
      row.revokedCents += voucher.valueCents
      totals.revokedCount += 1
      totals.revokedCents += voucher.valueCents
    }

    byMonth.set(key, row)
  }

  const budgetTotalCents = templates.reduce(
    (sum, template) => sum + (template.totalBudgetCents ?? 0),
    0,
  )
  const budgetSpentCents = templates.reduce(
    (sum, template) => sum + template.spentCents,
    0,
  )

  return {
    rows: [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)),
    totals,
    budgetTotalCents,
    budgetSpentCents,
    budgetRemainingCents: Math.max(0, budgetTotalCents - budgetSpentCents),
  }
}

/** CSV alan kaçışı — noktalı virgül, tırnak ve satır sonu bozar. */
function csvCell(value: string | number): string {
  const text = String(value)
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * CSV üretir.
 *
 * Ayırıcı **noktalı virgül**: Alman Excel'i virgülü ondalık ayırıcı sayıyor
 * ve virgülle ayrılmış dosyayı tek sütuna basıyor. Rapor bir belediye
 * muhasebesine gidecek; orada açılamayan dosya işe yaramaz.
 */
export function toCsv(report: ReconciliationReport, orgName: string): string {
  const lines: string[] = []
  lines.push(`Ehrenweg – Abrechnung;${orgName}`)
  lines.push('')
  lines.push(
    [
      'Monat',
      'Ausgegeben (Anzahl)',
      'Ausgegeben (EUR)',
      'Eingelöst (Anzahl)',
      'Eingelöst (EUR)',
      'Verfallen (Anzahl)',
      'Verfallen (EUR)',
      'Storniert (Anzahl)',
      'Storniert (EUR)',
    ]
      .map(csvCell)
      .join(';'),
  )

  const euro = (cents: number): string => (cents / 100).toFixed(2).replace('.', ',')

  for (const row of [...report.rows, report.totals]) {
    lines.push(
      [
        row.month === 'total' ? 'Gesamt' : row.month,
        row.issuedCount,
        euro(row.issuedCents),
        row.redeemedCount,
        euro(row.redeemedCents),
        row.expiredCount,
        euro(row.expiredCents),
        row.revokedCount,
        euro(row.revokedCents),
      ]
        .map(csvCell)
        .join(';'),
    )
  }

  lines.push('')
  lines.push(`Budget gesamt;${euro(report.budgetTotalCents)}`)
  lines.push(`Budget gebunden;${euro(report.budgetSpentCents)}`)
  lines.push(`Budget frei;${euro(report.budgetRemainingCents)}`)

  return lines.join('\r\n')
}

export function downloadCsv(report: ReconciliationReport, orgName: string): void {
  // BOM şart: Excel UTF-8 olduğunu ancak böyle anlıyor, yoksa "Eingelöst"
  // "EingelÃ¶st" diye açılıyor.
  const blob = new Blob(['﻿' + toCsv(report, orgName)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ehrenweg-abrechnung-${monthKey(new Date())}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Okunabilir tutar — rapor ekranı için. */
export function euro(cents: number, locale: string): string {
  return formatCents(cents, locale)
}
