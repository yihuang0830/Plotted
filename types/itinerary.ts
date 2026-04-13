export interface Transport {
  mode: 'walk' | 'subway' | 'bus' | 'taxi' | 'train' | 'bike' | 'car' | 'boat'
  duration: string   // e.g. "10 min"
  note?: string      // e.g. "Take Ginza Line to Asakusa"
}

export interface Place {
  /** Human-readable display name shown in the UI (may be descriptive) */
  name: string
  /** Terse, official name used exclusively for Mapbox POI search — no city suffix, no "and", no parentheses */
  mapSearchName: string
  time: string
  duration: string
  type: 'attraction' | 'restaurant' | 'hotel' | 'transport' | 'other'
  note: string
  transportToNext?: Transport
  coordinates?: [number, number] // [lng, lat] — filled by Mapbox Geocoding API
  redditPosts?: RedditPost[]
}

export interface DayPlan {
  day: number
  places: Place[]
}

export interface ClarifyQuestion {
  type: 'slider' | 'select' | 'toggle'
  key: string
  label: string
  // slider
  min?: number
  max?: number
  step?: number
  unit?: string
  // select / toggle
  options?: string[]
}

export interface GeminiResponse {
  status: 'need_clarification' | 'itinerary_ready'
  message?: string
  questions?: ClarifyQuestion[]
  destination?: string
  itinerary?: DayPlan[]
  /** Internal marker used to track mock conversation state across turns */
  mockDestination?: string
}

export interface RedditPost {
  title: string
  url: string
  score: number
  subreddit: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  geminiData?: GeminiResponse
  /** Geocoded itinerary — populated after geocoding completes for itinerary_ready messages */
  itinerary?: DayPlan[]
}
