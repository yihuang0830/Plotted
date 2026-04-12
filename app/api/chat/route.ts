import { NextRequest, NextResponse } from 'next/server'
import { chatWithGemini } from '@/lib/gemini'
import { GeminiResponse, ClarifyQuestion } from '@/types/itinerary'
import { mockStLouisResponse, mockRomeResponse } from '@/lib/mockData'

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

    // ── Demo intercept: return hardcoded mock data for known destinations ──
    const lower = (userMessage as string).toLowerCase()
    if (lower.includes('louis')) {
      return NextResponse.json({ ...mockStLouisResponse, isMock: true })
    }
    if (lower.includes('rome') || lower.includes('italy')) {
      return NextResponse.json({ ...mockRomeResponse, isMock: true })
    }
    // ──────────────────────────────────────────────────────────────────────

    const raw = await chatWithGemini(messages ?? [], userMessage)
    return NextResponse.json(normalizeResponse(raw))
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
