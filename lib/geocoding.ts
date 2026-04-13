import { Place } from '@/types/itinerary'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

interface DestContext {
  city: string                                  // e.g. "Rome"
  center: [number, number]
  bbox: [number, number, number, number]        // always present — manually computed
}

// ~11 km radius around the city center. Covers downtown + adjacent landmarks
// (Vatican, Trastevere, etc.) while blocking suburbs tens of km away.
const CORE_RADIUS_DEG = 0.1

// Step 1: resolve the destination city to a center point, then derive a
// compact bbox manually. We never use Mapbox's official administrative bbox
// because it covers entire metropolitan regions (Rome's is ~70 km wide).
async function geocodeDestination(destination: string): Promise<DestContext | null> {
  const query = encodeURIComponent(destination)
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=1&types=place,region,country`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center as [number, number]
      // Extract short city name (first segment before any comma)
      const city = destination.split(',')[0].trim()
      return {
        city,
        center: [lng, lat],
        bbox: [
          lng - CORE_RADIUS_DEG,
          lat - CORE_RADIUS_DEG,
          lng + CORE_RADIUS_DEG,
          lat + CORE_RADIUS_DEG,
        ],
      }
    }
  } catch (err) {
    console.error('[geocode] destination error:', destination, err)
  }
  return null
}

const MAX_DISTANCE_KM = 80

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * sinLng * sinLng
  return R * 2 * Math.asin(Math.sqrt(h))
}

// Step 2: try Nominatim (OpenStreetMap) first — far better international
// POI coverage than Mapbox. Fall back to Mapbox if Nominatim returns nothing.
// Always validate the result is within MAX_DISTANCE_KM of the city center so
// a same-named place in another country never sneaks through.
async function geocodePlace(
  mapSearchName: string,
  ctx: DestContext,
): Promise<[number, number] | null> {
  // Include city name so both APIs understand the geographic context
  const queryWithCity = `${mapSearchName}, ${ctx.city}`

  const validate = (lng: number, lat: number): [number, number] | null => {
    const km = haversineKm(ctx.center, [lng, lat])
    return km <= MAX_DISTANCE_KM ? [lng, lat] : null
  }

  // ── Nominatim (OSM) ────────────────────────────────────────────────────
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(queryWithCity)}&format=json&limit=3`
    const res = await fetch(url, { headers: { 'User-Agent': 'Plotted/1.0' } })
    const data: Array<{ lat: string; lon: string }> = await res.json()

    for (const item of data) {
      const coords = validate(parseFloat(item.lon), parseFloat(item.lat))
      if (coords) {
        const km = haversineKm(ctx.center, coords)
        console.log(`[geocode/osm] ✓  "${mapSearchName}"  →  ${JSON.stringify(coords)}  (${km.toFixed(1)} km)`)
        return coords
      }
    }
  } catch (err) {
    console.warn('[geocode/osm] error for', mapSearchName, err)
  }

  // ── Mapbox fallback ────────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN!,
      limit: '5',
      types: 'poi,address',
      proximity: `${ctx.center[0]},${ctx.center[1]}`,
    })
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(queryWithCity)}.json?${params}`
    const res = await fetch(url)
    const data = await res.json()

    for (const f of data.features ?? []) {
      const [lng, lat] = f.center as [number, number]
      const coords = validate(lng, lat)
      if (coords) {
        const km = haversineKm(ctx.center, coords)
        console.log(`[geocode/mapbox] ✓  "${mapSearchName}"  →  ${JSON.stringify(coords)}  (${km.toFixed(1)} km)`)
        return coords
      }
    }
  } catch (err) {
    console.warn('[geocode/mapbox] error for', mapSearchName, err)
  }

  console.warn(`[geocode] ✗  "${mapSearchName}"  — not found within ${MAX_DISTANCE_KM} km of ${ctx.city}`)
  return null
}

export async function geocodePlaces(places: Place[], destination: string): Promise<Place[]> {
  const ctx = await geocodeDestination(destination)
  if (!ctx) {
    console.warn(`[geocode] could not resolve destination "${destination}" — all places skipped`)
    return places.map((p) => ({ ...p, coordinates: undefined }))
  }

  const results: Place[] = []
  for (const place of places) {
    const searchName = place.mapSearchName?.trim() || place.name
    const coords = await geocodePlace(searchName, ctx)
    results.push({ ...place, coordinates: coords ?? undefined })
    // Nominatim rate limit: max 1 req/sec
    await new Promise((r) => setTimeout(r, 1100))
  }
  return results
}
