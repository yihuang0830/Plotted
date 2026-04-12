'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatMessage, DayPlan, GeminiResponse, Place } from '@/types/itinerary'

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
  '给我一个东京三天行程 🇯🇵',
  'Plan a 5-day Paris trip 🗼',
  'Bali 一周，适合情侣 💑',
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
  const [itinerary, setItinerary] = useState<DayPlan[]>([])
  const [destination, setDestination] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text: string, extraContext?: string) => {
    const userMsg = extraContext ? `${text}\n\n${extraContext}` : text
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

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
      setLoading(false)
    }
  }

  const geocodeItinerary = async (days: DayPlan[], dest: string) => {
    const allPlaces = days.flatMap((d) => d.places)

    // If every place already has coordinates (e.g. mock data), skip the
    // Geocoding API entirely and go straight to rendering.
    if (allPlaces.every((p) => p.coordinates)) {
      setItinerary(days)
      onItineraryReady(days, dest)
      return
    }

    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: allPlaces, destination: dest }),
    })
    const data = await res.json()
    if (!data.places) return

    let idx = 0
    const geocodedDays: DayPlan[] = days.map((day) => ({
      ...day,
      places: day.places.map(() => data.places[idx++]),
    }))

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
            <h1 className="font-bold text-gray-900 text-lg leading-tight">TravelMap AI</h1>
            <p className="text-xs text-gray-400">Powered by Qwen Plus</p>
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
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Itinerary timeline inline */}
        {itinerary.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Your Itinerary
            </p>
            <ItineraryTimeline
              itinerary={itinerary}
              activeDay={activeDay}
              activePlace={activePlace}
              onDayClick={onDayClick}
              onPlaceClick={onPlaceClick}
            />
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
