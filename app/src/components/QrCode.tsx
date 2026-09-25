/**
 * QR görüntüleyici — `qrcode` paketiyle canvas'a çizer.
 *
 * Neden canvas ve neden bu kadar büyük: yoklama ekranı bir projeksiyona ya da
 * tablete yansıtılıyor ve 20 kişi sırayla telefonunu tutuyor. Küçük ve düşük
 * kontrastlı bir QR, salonun yarısının okutamamasına yol açar.
 */

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export function QrCode({
  value,
  size = 320,
  className,
  ariaLabel,
}: {
  value: string
  size?: number
  className?: string
  ariaLabel: string
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    let cancelled = false
    void QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      // Hata düzeltme seviyesi M: telefon kamerası açılı tutulduğunda bile
      // okunsun, ama modül sayısı gereksiz artmasın.
      errorCorrectionLevel: 'M',
      color: { dark: '#0B1220', light: '#FFFFFF' },
    })
      .then(() => {
        if (!cancelled) setFailed(false)
      })
      .catch((error: unknown) => {
        console.error('[qr] Çizilemedi:', error)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="rounded-2xl bg-white"
        style={{ width: size, height: size }}
      />
      {failed && (
        <p className="mt-2 text-center text-sm text-red-600" role="alert">
          QR
        </p>
      )}
    </div>
  )
}
