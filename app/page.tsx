'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import ChatPanel from '@/components/ChatPanel'
import { DayPlan, Place } from '@/types/itinerary'

// Mapbox must be client-only (no SSR)
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export default function Home() {
  const [itinerary, setItinerary] = useState<DayPlan[]>([])
  const [destination, setDestination] = useState('')
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [activePlace, setActivePlace] = useState<Place | null>(null)

  const handleItineraryReady = (days: DayPlan[], dest: string) => {
    setItinerary(days)
    setDestination(dest)
    setActiveDay(null)
    setActivePlace(null)
  }

  const handlePlaceClick = (place: Place) => {
    setActivePlace(place)
  }

  return (
    <main className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left panel - Chat */}
      <div className="w-[420px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-sm">
        <ChatPanel
          onItineraryReady={handleItineraryReady}
          activeDay={activeDay}
          activePlace={activePlace}
          onDayClick={setActiveDay}
          onPlaceClick={handlePlaceClick}
        />
      </div>

      {/* Right panel - Map */}
      <div className="flex-1 relative">
        {itinerary.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 space-y-3 z-10 pointer-events-none">
            <span className="text-7xl">🗺️</span>
            <p className="text-lg font-medium">Your trip map will appear here</p>
            <p className="text-sm">Start a conversation on the left →</p>
          </div>
        )}
        <MapView
          itinerary={itinerary}
          destination={destination}
          activeDay={activeDay}
          activePlace={activePlace}
          onMarkerClick={handlePlaceClick}
        />
      </div>
    </main>
  )
}
