/**
 * Paylaşılabilir "karne" görseli — CLAUDE.md Bölüm 2 (BazaltGo karşılığı)
 * ve Bölüm 9: "paylaşılabilir karne görseli … Web Share / Capacitor Share".
 *
 * Kütüphane YOK — tıpkı PDF kararında olduğu gibi (bkz. lib/reconciliation.ts
 * başındaki not): `<canvas>` zaten tarayıcıda var, üçüncü bir paket
 * yüklemeden kart çizilebiliyor.
 *
 * Paylaşım `@capacitor/share` DEĞİL, Web Share API (`navigator.share`) ile:
 * Capacitor'ın WebView'ı bu API'yi native paylaşım sayfasına yönlendiriyor,
 * yani ayrı bir eklentiye gerek yok. Desteklenmiyorsa (masaüstü tarayıcı)
 * görsel indirilir — kullanıcı onu kendi seçtiği uygulamadan paylaşır.
 */

import { BRAND } from '@/config/brand'

export interface ShareCardInput {
  displayName: string
  levelName: string
  hours: number
  activitiesCompleted: number
  ip: number
  locale: 'de' | 'en'
}

const WIDTH = 1080
const HEIGHT = 1350

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Kartı bir `<canvas>`e çizer ve PNG `Blob`a dönüştürür. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[shareCard] 2D bağlam oluşturulamadı.')

  // Zemin — marka rengi gradyanı.
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, BRAND.colors.primary)
  gradient.addColorStop(1, BRAND.colors.darkBg)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 44px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(BRAND.name, WIDTH / 2, 140)

  ctx.font = '400 28px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(
    input.locale === 'en' ? 'Integration Passport' : 'Integrationspass',
    WIDTH / 2,
    185,
  )

  // Beyaz kart.
  const cardX = 80
  const cardY = 260
  const cardW = WIDTH - 160
  const cardH = HEIGHT - 520
  ctx.fillStyle = '#FFFFFF'
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 40)
  ctx.fill()

  ctx.fillStyle = BRAND.colors.darkBg
  ctx.font = '700 52px Inter, sans-serif'
  ctx.fillText(input.displayName, WIDTH / 2, cardY + 110)

  ctx.font = '600 36px Inter, sans-serif'
  ctx.fillStyle = BRAND.colors.primary
  ctx.fillText(input.levelName, WIDTH / 2, cardY + 170)

  const stats: [string, string][] = [
    [String(input.ip), input.locale === 'en' ? 'points' : 'Punkte'],
    [String(Math.round(input.hours)), input.locale === 'en' ? 'hours' : 'Stunden'],
    [
      String(input.activitiesCompleted),
      input.locale === 'en' ? 'activities' : 'Teilnahmen',
    ],
  ]
  const slotWidth = cardW / 3
  stats.forEach(([value, label], index) => {
    const cx = cardX + slotWidth * index + slotWidth / 2
    ctx.font = '700 64px Inter, sans-serif'
    ctx.fillStyle = BRAND.colors.darkBg
    ctx.fillText(value, cx, cardY + 300)
    ctx.font = '400 26px Inter, sans-serif'
    ctx.fillStyle = '#6B7280'
    ctx.fillText(label, cx, cardY + 340)
  })

  ctx.font = '400 24px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(BRAND.urls.web.replace('https://', ''), WIDTH / 2, HEIGHT - 60)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('[shareCard] PNG üretilemedi.'))
    }, 'image/png')
  })
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Web Share API destekliyorsa native paylaşım sayfasını açar; desteklemiyorsa
 * (ya da kullanıcı dosya paylaşımını reddediyorsa) görseli indirir.
 */
export async function shareCard(
  blob: Blob,
  displayName: string,
): Promise<ShareOutcome> {
  const file = new File([blob], `ehrenweg-karne-${displayName || 'pass'}.png`, {
    type: 'image/png',
  })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: BRAND.name,
      })
      return 'shared'
    } catch (error) {
      // Kullanıcı paylaşım sayfasını iptal etti — hata değil.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
