'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatMessage, DayPlan, GeminiResponse, Place } from '@/types/itinerary'

const LOADING_PHASES = [
  { icon: '🧠', text: 'Analyzing your request...' },
  { icon: '🔍', text: 'Researching top attractions...' },
  { icon: '🗺️', text: 'Building your itinerary...' },
  { icon: '📍', text: 'Pinning locations on the map...' },
]

type ChatHistory = Array<{ role: 'user' | 'assistant'; content: string }>
import ClarifyWidget from './ClarifyWidget'
import ItineraryTimeline from './ItineraryTimeline'

interface Props {
  onItineraryReady: (itinerary: DayPlan[], destination: string) => void
  activeDay: number | null
  activePlace: Place | null
  onDayClick: (day: number | null) => void
  onPlaceClick: (place: Place) => void
}


const SUGGESTED_PROMPTS = [
  '3 days in Tokyo 🇯🇵',
  'Plan a 5-day Paris trip 🗼',
  'Bali for a week, couples trip 💑',
  'Weekend in New York 🗽',
]

export default function ChatPanel({
  onItineraryReady,
  activeDay,
  activePlace,
  onDayClick,
  onPlaceClick,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ChatHistory>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [itinerary, setItinerary] = useState<DayPlan[]>([])
  const [destination, setDestination] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text: string, extraContext?: string) => {
    const userMsg = extraContext ? `${text}\n\n${extraContext}` : text
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)
    setLoadingPhase(0)
    phaseTimerRef.current = setInterval(() => {
      setLoadingPhase((p) => Math.min(p + 1, LOADING_PHASES.length - 1))
    }, 2000)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userMessage: userMsg }),
      })
      const data: GeminiResponse = await res.json()

      setHistory((prev) => [
        ...prev,
        { role: 'user', content: userMsg },
        { role: 'assistant', content: JSON.stringify(data) },
      ])

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message ?? '', geminiData: data },
      ])

      if (data.status === 'itinerary_ready' && data.itinerary && data.destination) {
        await geocodeItinerary(data.itinerary, data.destination)
        setDestination(data.destination)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current)
      setLoading(false)
    }
  }

  const geocodeItinerary = async (days: DayPlan[], dest: string) => {
    const allPlaces = days.flatMap((d) => d.places)

    let geocodedDays: DayPlan[]

    // If every place already has coordinates (e.g. mock data), skip the
    // Geocoding API entirely and go straight to rendering.
    if (allPlaces.every((p) => p.coordinates)) {
      geocodedDays = days
    } else {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: allPlaces, destination: dest }),
      })
      const data = await res.json()
      if (!data.places) return

      let idx = 0
      geocodedDays = days.map((day) => ({
        ...day,
        places: day.places.map(() => data.places[idx++]),
      }))
    }

    // Attach geocoded itinerary to the last assistant message in the stream
    setMessages((prev) => {
      const updated = [...prev]
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant') {
          updated[i] = { ...updated[i], itinerary: geocodedDays }
          break
        }
      }
      return updated
    })

    setItinerary(geocodedDays)
    onItineraryReady(geocodedDays, dest)
  }

  const handleClarifySubmit = (answers: Record<string, string | number>) => {
    const summary = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    sendMessage('Here are my preferences', summary)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    sendMessage(input.trim())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Plotted</h1>
            <p className="text-xs text-gray-400">Your trip, plotted.</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-sm text-gray-700 leading-relaxed">
                👋 Hi! Tell me where you want to go and I&apos;ll plan the perfect trip — with real
                recommendations and Reddit tips right on the map.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">Try asking:</p>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="block w-full text-left text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors border border-indigo-100"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5'
                  : 'space-y-2 w-full'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                <>
                  {msg.content && (
                    <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                    </div>
                  )}
                  {msg.geminiData?.status === 'need_clarification' &&
                    msg.geminiData.questions && (
                      <ClarifyWidget
                        questions={msg.geminiData.questions}
                        onSubmit={handleClarifySubmit}
                        onSkip={() => sendMessage('Just give me your best recommendation')}
                      />
                    )}
                  {msg.itinerary && msg.itinerary.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 mt-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Your Itinerary
                        </p>
                        <button
                          onClick={() => {
                            import('@/lib/exportWord').then(({ exportItineraryToWord }) =>
                              exportItineraryToWord(msg.itinerary!, destination)
                            )
                          }}
                          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors border border-indigo-100"
                        >
                          <span>📄</span> Export Word
                        </button>
                      </div>
                      <ItineraryTimeline
                        itinerary={msg.itinerary}
                        activeDay={activeDay}
                        activePlace={activePlace}
                        onDayClick={onDayClick}
                        onPlaceClick={onPlaceClick}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 min-w-[220px]">
              <div className="space-y-2">
                {LOADING_PHASES.map((phase, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                      i < loadingPhase
                        ? 'text-indigo-400 line-through opacity-50'
                        : i === loadingPhase
                        ? 'text-gray-700 font-medium'
                        : 'text-gray-300'
                    }`}
                  >
                    <span className={i === loadingPhase ? 'animate-pulse' : ''}>{phase.icon}</span>
                    <span>{phase.text}</span>
                    {i < loadingPhase && <span className="ml-auto text-green-400">✓</span>}
                    {i === loadingPhase && (
                      <span className="ml-auto flex gap-0.5">
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Where do you want to go?"
            disabled={loading}
            autoComplete="off"
            spellCheck="false"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
