/**
 * Kamera ile QR okuyucu — `jsQR` (CLAUDE.md Bölüm 9 Scan ekranı).
 *
 * Neden jsQR ve harici bir tarayıcı bileşeni değil: jsQR saf bir çözümleyici,
 * DOM'a karışmıyor ve kamera akışını biz yönetiyoruz. Bu, kamerayı ekran
 * kapanınca gerçekten KAPATABİLMEK için önemli — hedef kitlenin telefonu
 * sınırlı ve açık kalan bir kamera hem pil hem güven sorunu.
 *
 * Erişilebilirlik: kamera izni yoksa ya da cihazda kamera yoksa bileşen
 * sessizce kaybolmuyor; çağıran tarafa `onUnavailable` ile haber veriyor ve
 * kullanıcı manuel kod girişine yönlendiriliyor.
 */

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export type CameraState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable'

export function QrScanner({
  active,
  onResult,
  onStateChange,
  className,
  ariaLabel,
}: {
  /** false olunca kamera KAPANIR — sayfa açık kalsa bile. */
  active: boolean
  onResult: (text: string) => void
  onStateChange?: (state: CameraState) => void
  className?: string
  ariaLabel: string
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [state, setState] = useState<CameraState>('idle')

  // Geri çağırmalar her çizimde yenileniyor; kamerayı yeniden başlatmamak
  // için ref'te tutuluyorlar.
  const onResultRef = useRef(onResult)
  const onStateRef = useRef(onStateChange)
  useEffect(() => {
    onResultRef.current = onResult
    onStateRef.current = onStateChange
  })

  useEffect(() => {
    onStateRef.current?.(state)
  }, [state])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Aynı kodu arka arkaya 30 kez bildirmemek için: bir okunan kod bir kez
    // yukarı çıkar, sonra ekran kapanır ya da çağıran taraf `active`'i kapatır.
    let delivered = false

    async function start(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }

      setState('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop()
          return
        }

        streamRef.current = stream
        video!.srcObject = stream
        // iOS Safari `playsInline` olmadan tam ekrana geçer ve tarama kopar.
        video!.setAttribute('playsinline', 'true')
        await video!.play()
        setState('running')
        tick()
      } catch (error) {
        console.warn('[scan] Kamera açılamadı:', error)
        setState(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'denied'
            : 'unavailable',
        )
      }
    }

    function tick(): void {
      if (cancelled || delivered) return
      frameRef.current = requestAnimationFrame(tick)

      const element = videoRef.current
      const surface = canvasRef.current
      if (!element || !surface) return
      if (element.readyState !== element.HAVE_ENOUGH_DATA) return

      // Çözünürlüğü kısıtlı tutuyoruz: 1080p bir kareyi her karede taramak
      // orta seviye telefonu ısıtıyor ve okuma hızlanmıyor.
      const width = 480
      const scale = width / element.videoWidth
      const height = Math.round(element.videoHeight * scale)

      surface.width = width
      surface.height = height

      const context = surface.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(element, 0, 0, width, height)

      const image = context.getImageData(0, 0, width, height)
      const found = jsQR(image.data, width, height, {
        inversionAttempts: 'dontInvert',
      })

      if (found?.data) {
        delivered = true
        onResultRef.current(found.data)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      for (const track of streamRef.current?.getTracks() ?? []) track.stop()
      streamRef.current = null
      setState('idle')
    }
  }, [active])

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          aria-label={ariaLabel}
          muted
          playsInline
          className="aspect-square w-full object-cover"
        />
        {/* Hedef çerçevesi — kullanıcı QR'ı nereye tutacağını bilsin. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="size-2/3 rounded-2xl border-4 border-white/80" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
