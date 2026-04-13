import { NextRequest, NextResponse } from 'next/server'
import { chatWithGemini } from '@/lib/gemini'
import { GeminiResponse, ClarifyQuestion } from '@/types/itinerary'
import {
  mockStLouisResponse,
  mockRome2DayResponse,
  mockRome3DayResponse,
  mockStLouisClarify,
  mockRomeClarify,
} from '@/lib/mockData'

type ChatHistory = Array<{ role: 'user' | 'assistant'; content: string }>

/** Returns the mockDestination tag from the most recent assistant message that has one. */
function getMockDestination(messages: ChatHistory): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'assistant') continue
    try {
      const d = JSON.parse(messages[i].content) as GeminiResponse
      if (d.mockDestination) return d.mockDestination
    } catch { /* skip */ }
  }
  return null
}

/** Returns true if the history already contains a completed itinerary for a mock destination. */
function hasItinerary(messages: ChatHistory): boolean {
  return messages.some((m) => {
    if (m.role !== 'assistant') return false
    try { return (JSON.parse(m.content) as GeminiResponse).status === 'itinerary_ready' } catch { return false }
  })
}

/** Parse a day count from a string like "days: 3", "3 days", "three days". Returns null if not found. */
function parseDays(text: string): number | null {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(text)) return n
  }
  const m = text.match(/days?[:\s]+(\d+)|(\d+)\s*days?/i)
  if (m) return parseInt(m[1] ?? m[2], 10)
  return null
}

// Qwen Max sometimes returns non-array fields or malformed nesting.
// Normalize before sending to the client.
function normalizeResponse(data: GeminiResponse): GeminiResponse {
  // Fix questions being a stringified array, or options being a string instead of array
  if (data.questions && !Array.isArray(data.questions)) {
    try { data.questions = JSON.parse(data.questions as unknown as string) } catch { data.questions = [] }
  }
  if (Array.isArray(data.questions)) {
    data.questions = data.questions.map((q: ClarifyQuestion) => {
      if (q.options && !Array.isArray(q.options)) {
        q.options = String(q.options).split(',').map((s) => s.trim()).filter(Boolean)
      }
      return q
    })
  }

  // Fix itinerary structure — Qwen Max sometimes returns arrays as JSON strings
  if (data.status === 'itinerary_ready' && data.itinerary) {
    // itinerary itself might be a stringified array
    if (!Array.isArray(data.itinerary)) {
      try {
        data.itinerary = JSON.parse(data.itinerary as unknown as string)
      } catch {
        console.error('Qwen returned unparseable itinerary:', String(data.itinerary).slice(0, 200))
        return {
          status: 'need_clarification',
          message: 'Sorry, I had trouble formatting the itinerary. Could you repeat your request?',
        }
      }
    }
    // places inside each day might be a stringified array
    if (Array.isArray(data.itinerary)) {
      data.itinerary = data.itinerary.map((day) => {
        if (!Array.isArray(day.places)) {
          try {
            day.places = JSON.parse(day.places as unknown as string)
          } catch {
            console.error('Qwen returned unparseable places for day', day.day)
            day.places = []
          }
        }
        return day
      })
    }
  }

  return data
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userMessage } = await req.json()

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // ── Demo intercept: mock conversation state machine ───────────────────
    const lower = (userMessage as string).toLowerCase()

    // If the current message explicitly names a new destination, always start
    // a fresh flow — this lets the user switch from St. Louis → Rome without
    // needing to refresh the page.
    if (lower.includes('louis')) {
      await new Promise((r) => setTimeout(r, 1500))
      return NextResponse.json(mockStLouisClarify)
    }
    if (lower.includes('rome') || lower.includes('italy')) {
      await new Promise((r) => setTimeout(r, 1500))
      return NextResponse.json(mockRomeClarify)
    }

    // No new destination keyword — check history for an ongoing mock flow
    const mockDest = getMockDestination(messages ?? [])

    // Step 2+: already in a mock conversation
    if (mockDest === 'stlouis') {
      await new Promise((r) => setTimeout(r, 8500))
      return NextResponse.json(mockStLouisResponse)
    }

    if (mockDest === 'rome') {
      // If itinerary already shown and user asks to change days
      const days = parseDays(userMessage as string)
      const use3Day = hasItinerary(messages ?? [])
        ? (days !== null ? days >= 3 : lower.includes('3') || lower.includes('three') || lower.includes('more'))
        : (days !== null ? days >= 3 : false)
      await new Promise((r) => setTimeout(r, 8500))
      return NextResponse.json(use3Day ? mockRome3DayResponse : mockRome2DayResponse)
    }
    // ──────────────────────────────────────────────────────────────────────

    const raw = await chatWithGemini(messages ?? [], userMessage)
    return NextResponse.json(normalizeResponse(raw))
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
