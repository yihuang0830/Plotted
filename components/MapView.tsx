'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { DayPlan, Place, RedditPost } from '@/types/itinerary'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

const DAY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const TRANSPORT_EMOJI: Record<string, string> = {
  walk: '🚶', subway: '🚇', bus: '🚌', taxi: '🚕',
  train: '🚆', bike: '🚲', car: '🚗', boat: '⛴️',
}

interface Props {
  itinerary: DayPlan[]
  destination: string
  activeDay: number | null
  activePlace: Place | null
  onMarkerClick: (place: Place) => void
}

export default function MapView({ itinerary, destination, activeDay, activePlace, onMarkerClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const routeLayers = useRef<string[]>([])  // layer IDs only
  const routeSources = useRef<string[]>([]) // source IDs only
  const [redditCache, setRedditCache] = useState<Record<string, RedditPost[]>>({})

  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainer.current) return
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [139.6917, 35.6895],
      zoom: 2,
    })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current.on('load', () => setMapLoaded(true))
    return () => map.current?.remove()
  }, [])

  // Draw routes + markers whenever itinerary changes
  useEffect(() => {
    if (!itinerary.length || !destination || !map.current || !mapLoaded) return

    const allPlaces = itinerary.flatMap((d) => d.places).filter((p) => p.coordinates)
    if (allPlaces.length === 0) return

    // Fit bounds
    const lngs = allPlaces.map((p) => p.coordinates![0])
    const lats = allPlaces.map((p) => p.coordinates![1])
    map.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 1500 }
    )

    // Remove old route layers then sources (order matters!)
    routeLayers.current.forEach((id) => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id)
    })
    routeSources.current.forEach((id) => {
      if (map.current?.getSource(id)) map.current.removeSource(id)
    })
    routeLayers.current = []
    routeSources.current = []

    // Remove old markers
    markers.current.forEach((m) => m.remove())
    markers.current = []

    // Draw routes per day
    itinerary.forEach((day, dayIdx) => {
      const placesWithCoords = day.places.filter((p) => p.coordinates)
      if (placesWithCoords.length < 2) return

      const color = DAY_COLORS[dayIdx % DAY_COLORS.length]
      const coords = placesWithCoords.map((p) => p.coordinates!)

      const sourceId = `route-day-${day.day}`
      const glowLayerId = `route-glow-${day.day}`
      const lineLayerId = `route-line-${day.day}`

      map.current!.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      })

      // Glow layer — thicker, semi-transparent, gives the "route vibe"
      map.current!.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': color,
          'line-width': 10,
          'line-opacity': activeDay === null || activeDay === day.day ? 0.18 : 0.05,
          'line-blur': 4,
        },
      })

      // Main route line — dashed, crisp
      map.current!.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': color,
          'line-width': 3,
          'line-dasharray': [3, 2],
          'line-opacity': activeDay === null || activeDay === day.day ? 0.9 : 0.2,
        },
      })

      routeLayers.current.push(glowLayerId, lineLayerId)
      routeSources.current.push(sourceId)

      // Transport label popups between segments
      placesWithCoords.forEach((place, i) => {
        if (!place.transportToNext || i >= placesWithCoords.length - 1) return
        const next = placesWithCoords[i + 1]
        if (!next.coordinates) return

        // Midpoint for the label popup
        const midLng = (place.coordinates![0] + next.coordinates![0]) / 2
        const midLat = (place.coordinates![1] + next.coordinates![1]) / 2
        const emoji = TRANSPORT_EMOJI[place.transportToNext.mode] ?? '➡️'

        const el = document.createElement('div')
        el.style.cssText = `
          background: white;
          border: 1.5px solid ${color};
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
          cursor: default;
          white-space: nowrap;
          pointer-events: auto;
        `
        el.title = place.transportToNext.note ?? ''
        el.textContent = `${emoji} ${place.transportToNext.duration}`

        const labelMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([midLng, midLat])
          .addTo(map.current!)

        if (place.transportToNext.note) {
          const popup = new mapboxgl.Popup({ offset: 10, closeButton: false, maxWidth: '220px' })
            .setHTML(`<p style="font-size:12px;margin:0">${emoji} <b>${place.transportToNext.mode}</b> · ${place.transportToNext.duration}<br><span style="color:#6b7280">${place.transportToNext.note}</span></p>`)
          labelMarker.setPopup(popup)
          el.style.cursor = 'pointer'
          el.onclick = () => popup.isOpen() ? popup.remove() : labelMarker.togglePopup()
        }

        markers.current.push(labelMarker)
      })
    })

    // Add place markers with stagger
    allPlaces.forEach((place, index) => {
      if (!place.coordinates) return
      const dayIndex = itinerary.findIndex((d) => d.places.includes(place))
      const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
      // Order number within the day
      const dayPlaces = itinerary[dayIndex].places.filter((p) => p.coordinates)
      const orderInDay = dayPlaces.indexOf(place) + 1

      setTimeout(() => {
        const el = document.createElement('div')
        el.style.cssText = `
          width: 30px; height: 30px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        `

        const inner = document.createElement('div')
        inner.style.cssText = `
          width: 30px; height: 30px;
          background: ${color};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: white;
          transition: transform 0.2s;
        `
        inner.textContent = String(orderInDay)
        el.appendChild(inner)
        el.onmouseover = () => (inner.style.transform = 'scale(1.25)')
        el.onmouseout = () => (inner.style.transform = 'scale(1)')

        const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '300px' })
          .setHTML(buildPopupHTML(place, dayIndex + 1, color, redditCache[place.name] ?? []))

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(place.coordinates!)
          .setPopup(popup)
          .addTo(map.current!)

        el.addEventListener('click', () => {
          onMarkerClick(place)
          fetchRedditForPlace(place.name, destination).then((posts) => {
            setRedditCache((prev) => ({ ...prev, [place.name]: posts }))
            popup.setHTML(buildPopupHTML(place, dayIndex + 1, color, posts))
          })
        })

        markers.current.push(marker)
      }, index * 150)
    })
  }, [itinerary, destination, mapLoaded])

  // Fly to active place
  useEffect(() => {
    if (!activePlace?.coordinates || !map.current) return
    map.current.flyTo({ center: activePlace.coordinates, zoom: 15, duration: 1000 })
  }, [activePlace])

  // Show/hide routes + markers by active day
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    itinerary.forEach((day) => {
      const glowId = `route-glow-${day.day}`
      const lineId = `route-line-${day.day}`
      const active = activeDay === null || activeDay === day.day
      if (map.current?.getLayer(lineId)) {
        map.current.setPaintProperty(glowId, 'line-opacity', active ? 0.18 : 0.05)
        map.current.setPaintProperty(lineId, 'line-opacity', active ? 0.9 : 0.2)
      }
    })
    markers.current.forEach((marker, index) => {
      const allPlaces = itinerary.flatMap((d) => d.places).filter((p) => p.coordinates)
      const place = allPlaces[index]
      if (!place) return
      const dayIndex = itinerary.findIndex((d) => d.places.includes(place))
      const isActive = activeDay === null || dayIndex === activeDay - 1
      ;(marker.getElement() as HTMLElement).style.opacity = isActive ? '1' : '0.25'
    })
  }, [activeDay, itinerary, mapLoaded])

  return <div ref={mapContainer} className="w-full h-full rounded-lg" />
}

function buildPopupHTML(place: Place, day: number, color: string, posts: RedditPost[]): string {
  const typeEmoji: Record<string, string> = {
    attraction: '🏛️', restaurant: '🍜', hotel: '🏨', transport: '🚇', other: '📍',
  }
  const transportHTML = place.transportToNext
    ? `<div style="margin-top:8px;padding:6px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <p style="font-size:11px;color:#6b7280;margin:0">
          Next: ${TRANSPORT_EMOJI[place.transportToNext.mode] ?? '➡️'} <b>${place.transportToNext.mode}</b> · ${place.transportToNext.duration}
          ${place.transportToNext.note ? `<br><span style="color:#9ca3af">${place.transportToNext.note}</span>` : ''}
        </p>
      </div>`
    : ''

  const redditHTML = posts.length > 0
    ? `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px">
        <p style="font-size:10px;color:#6b7280;margin-bottom:4px;font-weight:600">REDDIT</p>
        ${posts.map(p => `
          <a href="${p.url}" target="_blank" rel="noopener noreferrer"
            style="display:block;font-size:11px;color:#4f46e5;margin-bottom:3px;text-decoration:none;line-height:1.4">
            ↗ ${p.title.slice(0, 65)}${p.title.length > 65 ? '…' : ''} (${p.score}↑)
          </a>`).join('')}
      </div>`
    : '<p style="font-size:11px;color:#d1d5db;margin-top:6px">Click to load Reddit posts…</p>'

  return `
    <div style="font-family:system-ui,sans-serif;min-width:230px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="background:${color};color:white;font-size:10px;padding:2px 7px;border-radius:999px;font-weight:600">Day ${day}</span>
        <span style="font-size:13px">${typeEmoji[place.type] ?? '📍'}</span>
      </div>
      <p style="font-weight:700;font-size:14px;margin:0 0 2px">${place.name}</p>
      <p style="font-size:12px;color:#6b7280;margin:0">⏰ ${place.time} · ${place.duration}</p>
      ${place.note ? `<p style="font-size:12px;color:#374151;margin-top:5px;line-height:1.4">${place.note}</p>` : ''}
      ${transportHTML}
      ${redditHTML}
    </div>`
}

async function fetchRedditForPlace(placeName: string, destination: string): Promise<RedditPost[]> {
  try {
    const res = await fetch('/api/reddit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeName, destination }),
    })
    const data = await res.json()
    return data.posts ?? []
  } catch {
    return []
  }
}
