/**
 * Harita — Leaflet + OpenStreetMap döşemeleri.
 *
 * Neden Leaflet: anahtar istemiyor, ücretsiz, 40 kB ve AB sunucularından
 * döşeme çekiyor. Google Maps hem anahtar/faturalandırma hem de kullanıcı
 * izleme getirirdi (Bölüm 10 veri minimizasyonu).
 *
 * Neden `divIcon`: Leaflet'in varsayılan işaretçisi PNG dosyalarını göreli
 * yoldan arar ve paketleyicide kırılır. Kendi HTML işaretçimiz hem bu sorunu
 * ortadan kaldırıyor hem de kategori emojisini gösteriyor.
 *
 * İki kullanım:
 *   1. Liste ekranındaki "Karte" görünümü — çok işaretçi, tıklayınca detay.
 *   2. Kurum formundaki pin seçici — tek sürüklenebilir işaretçi.
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/config/cities'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  emoji: string
  title: string
}

interface MapViewProps {
  markers: MapMarker[]
  onSelect?: (id: string) => void
  /** Pin seçici kipi: tek işaretçi, sürüklenebilir, haritaya tıklayınca taşınır. */
  pickable?: boolean
  onPick?: (point: { lat: number; lng: number }) => void
  center?: { lat: number; lng: number } | null
  className?: string
  ariaLabel: string
}

function markerIcon(emoji: string): L.DivIcon {
  return L.divIcon({
    className: 'ehrenweg-marker',
    html:
      `<span class="flex size-9 items-center justify-center rounded-full ` +
      `border-2 border-white bg-primary-700 text-base shadow-md">${emoji}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

export function MapView({
  markers,
  onSelect,
  pickable = false,
  onPick,
  center,
  className,
  ariaLabel,
}: MapViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  // Geri çağırmalar her çizimde değişiyor; haritayı yeniden kurmamak için
  // ref'te tutuluyorlar (aksi hâlde her tuş vuruşunda harita sıfırlanırdı).
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)

  // Atama render sırasında değil, çizimden sonra: ref'e render içinde
  // dokunmak React'in eşzamanlı kipinde güvenli değil.
  useEffect(() => {
    onSelectRef.current = onSelect
    onPickRef.current = onPick
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element || mapRef.current) return

    const map = L.map(element, {
      center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
      zoom: DEFAULT_MAP_ZOOM,
      // Mobilde sayfa kaydırırken harita yakalamasın.
      scrollWheelZoom: false,
      attributionControl: true,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    if (pickable) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        onPickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng })
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [pickable])

  // İşaretçileri her değişimde yeniden çiz.
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    for (const marker of markers) {
      const leafletMarker = L.marker([marker.lat, marker.lng], {
        icon: markerIcon(marker.emoji),
        title: marker.title,
        alt: marker.title,
        keyboard: true,
        draggable: pickable,
      })

      if (pickable) {
        leafletMarker.on('dragend', () => {
          const position = leafletMarker.getLatLng()
          onPickRef.current?.({ lat: position.lat, lng: position.lng })
        })
      } else {
        leafletMarker.bindTooltip(marker.title, { direction: 'top' })
        leafletMarker.on('click', () => onSelectRef.current?.(marker.id))
        leafletMarker.on('keypress', () => onSelectRef.current?.(marker.id))
      }

      leafletMarker.addTo(layer)
    }

    // Görünümü içeriğe göre ayarla.
    if (center) {
      map.setView([center.lat, center.lng], pickable ? 15 : map.getZoom())
    } else if (markers.length === 1) {
      const only = markers[0]
      if (only) map.setView([only.lat, only.lng], 15)
    } else if (markers.length > 1) {
      map.fitBounds(
        L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])),
        { padding: [32, 32], maxZoom: 15 },
      )
    }
  }, [markers, pickable, center])

  // Kapsayıcı boyutu sonradan değişince (sekme geçişi) harita gri kalır.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const timer = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(timer)
  }, [markers.length])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className={className ?? 'h-[420px] w-full rounded-2xl'}
    />
  )
}
