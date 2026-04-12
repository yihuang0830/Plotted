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

// Step 2: search for a single place using the AI-supplied mapSearchName.
// We trust the AI to supply a clean, terse name — no regex cleaning needed.
// Query = "<mapSearchName>, <city>" so Mapbox can rank well even without bbox.
// types=poi only: opening address/place search causes the geocoder to match
// obscure suburban streets with the same name as famous landmarks.
async function geocodePlace(
  mapSearchName: string,
  ctx: DestContext,
): Promise<[number, number] | null> {
  const query = encodeURIComponent(`${mapSearchName}, ${ctx.city}`)

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN!,
    limit: '1',
    types: 'poi',
    proximity: `${ctx.center[0]},${ctx.center[1]}`,
    bbox: ctx.bbox.join(','),
  })

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?${params}`
  console.log(`[geocode] "${mapSearchName}"  bbox: ${ctx.bbox.map(n => n.toFixed(3)).join(', ')}`)

  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.features?.length > 0) {
      const coords = data.features[0].center as [number, number]
      console.log(`[geocode] ✓  "${mapSearchName}"  →  [${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}]`)
      return coords
    }
    console.warn(`[geocode] ✗  "${mapSearchName}"  — no POI found within bbox, skipping`)
  } catch (err) {
    console.error('[geocode] fetch error for', mapSearchName, err)
  }
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
  }
  return results
}
