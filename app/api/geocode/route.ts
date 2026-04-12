import { NextRequest, NextResponse } from 'next/server'
import { geocodePlaces } from '@/lib/geocoding'
import { Place } from '@/types/itinerary'

export async function POST(req: NextRequest) {
  try {
    const { places, destination }: { places: Place[]; destination: string } = await req.json()

    if (!places?.length || !destination) {
      return NextResponse.json({ error: 'places and destination required' }, { status: 400 })
    }

    const geocoded = await geocodePlaces(places, destination)
    return NextResponse.json({ places: geocoded })
  } catch (err) {
    console.error('Geocode API error:', err)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
  }
}
