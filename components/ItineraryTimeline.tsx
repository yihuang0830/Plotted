'use client'

import { DayPlan, Place } from '@/types/itinerary'

const DAY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const TYPE_EMOJI: Record<string, string> = {
  attraction: '🏛️',
  restaurant: '🍜',
  hotel: '🏨',
  transport: '🚇',
  other: '📍',
}

const TRANSPORT_EMOJI: Record<string, string> = {
  walk: '🚶', subway: '🚇', bus: '🚌', taxi: '🚕',
  train: '🚆', bike: '🚲', car: '🚗', boat: '⛴️',
}

interface Props {
  itinerary: DayPlan[]
  activeDay: number | null
  activePlace: Place | null
  onDayClick: (day: number | null) => void
  onPlaceClick: (place: Place) => void
}

export default function ItineraryTimeline({
  itinerary,
  activeDay,
  activePlace,
  onDayClick,
  onPlaceClick,
}: Props) {
  if (!itinerary.length) return null

  return (
    <div className="space-y-3">
      {/* Day filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onDayClick(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            activeDay === null
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          All Days
        </button>
        {itinerary.map((day, i) => (
          <button
            key={day.day}
            onClick={() => onDayClick(activeDay === day.day ? null : day.day)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all`}
            style={{
              background: activeDay === day.day ? DAY_COLORS[i % DAY_COLORS.length] : '#f3f4f6',
              color: activeDay === day.day ? 'white' : '#6b7280',
            }}
          >
            Day {day.day}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {itinerary
        .filter((day) => activeDay === null || day.day === activeDay)
        .map((day, dayIdx) => {
          const realIdx = itinerary.indexOf(day)
          const color = DAY_COLORS[realIdx % DAY_COLORS.length]
          return (
            <div key={day.day} className="space-y-1">
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color }}
              >
                Day {day.day}
              </p>
              {day.places.map((place, placeIdx) => (
                <div key={placeIdx}>
                  <button
                    onClick={() => onPlaceClick(place)}
                    className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl transition-all hover:bg-gray-50 ${
                      activePlace?.name === place.name ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center mt-0.5 shrink-0">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold text-xs"
                        style={{ background: color }}
                      >
                        {placeIdx + 1}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{TYPE_EMOJI[place.type] ?? '📍'}</span>
                        <p className="text-sm font-medium text-gray-800 truncate">{place.name}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {place.time} · {place.duration}
                      </p>
                      {place.note && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{place.note}</p>
                      )}
                    </div>
                  </button>

                  {/* Transport badge between stops */}
                  {place.transportToNext && placeIdx < day.places.length - 1 && (
                    <div className="flex items-center gap-2 pl-3 py-1">
                      <div className="w-0.5 h-4 ml-2.5 shrink-0" style={{ background: color + '50' }} />
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border font-medium text-gray-500"
                        style={{ borderColor: color + '60', background: color + '10' }}
                        title={place.transportToNext.note}
                      >
                        {TRANSPORT_EMOJI[place.transportToNext.mode] ?? '➡️'}{' '}
                        {place.transportToNext.duration}
                        {place.transportToNext.note && (
                          <span className="text-gray-400"> · {place.transportToNext.note.slice(0, 30)}{place.transportToNext.note.length > 30 ? '…' : ''}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
    </div>
  )
}
