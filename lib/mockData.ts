import { GeminiResponse, DayPlan, Place, Transport } from '@/types/itinerary'

// ─── Raw mock items ────────────────────────────────────────────────────────────
// Coordinates are hardcoded and verified — do not modify them.

interface MockItem {
  id: string
  day: number
  order: number
  name: string
  coordinates: [number, number] // [lng, lat]
  description: string
  transport: string             // "" means no onward transport (last stop)
}

const stLouisItems: MockItem[] = [
  // Day 1: Downtown & Riverfront Walk
  { id: '1',  day: 1, order: 1,  name: 'Gateway Arch',                      coordinates: [-90.1847, 38.6246], description: 'Start the day at the iconic Arch. Take the tram to the top.',                                                    transport: 'Walk 5 min' },
  { id: '2',  day: 1, order: 2,  name: 'Old Courthouse',                    coordinates: [-90.1894, 38.6256], description: 'Historic site right across the park from the Arch.',                                                              transport: 'Walk 10 min' },
  { id: '3',  day: 1, order: 3,  name: 'Citygarden Sculpture Park',         coordinates: [-90.1930, 38.6265], description: 'Urban park mixing lush landscaping with modern art.',                                                             transport: 'Walk 15 min' },
  { id: '4',  day: 1, order: 4,  name: 'City Museum',                       coordinates: [-90.2005, 38.6334], description: 'Surreal interactive playground built from repurposed industrial objects. A must-see.',                            transport: 'Walk 10 min' },
  { id: '5',  day: 1, order: 5,  name: 'Washington Avenue',                 coordinates: [-90.1950, 38.6315], description: 'Historic garment district now filled with great restaurants and lively bars for dinner.',                        transport: '' },
  // Day 2: Forest Park & Central West End
  { id: '6',  day: 2, order: 6,  name: 'St. Louis Zoo',                     coordinates: [-90.2905, 38.6366], description: 'World-class free zoo in the heart of Forest Park.',                                                              transport: 'Walk 12 min' },
  { id: '7',  day: 2, order: 7,  name: 'Saint Louis Art Museum',            coordinates: [-90.2946, 38.6394], description: 'Stunning art museum atop Art Hill with great park views.',                                                       transport: 'Walk 5 min' },
  { id: '8',  day: 2, order: 8,  name: 'The Boathouse',                     coordinates: [-90.2872, 38.6391], description: 'Relaxing lakeside spot for a quick lunch.',                                                                      transport: 'Walk 15 min' },
  { id: '9',  day: 2, order: 9,  name: 'Missouri History Museum',           coordinates: [-90.2858, 38.6451], description: "Learn about the 1904 World's Fair.",                                                                             transport: 'Drive 5 min' },
  { id: '10', day: 2, order: 10, name: 'Cathedral Basilica of Saint Louis', coordinates: [-90.2544, 38.6423], description: 'Features one of the largest mosaic collections in the western hemisphere. Stunning interior.',                   transport: '' },
]

const romeItems: MockItem[] = [
  // Day 1: Ancient Rome
  { id: '1',  day: 1, order: 1,  name: 'Colosseum',                          coordinates: [12.4922, 41.8902], description: 'Start early to beat the crowds at the iconic amphitheater.',                                                   transport: 'Walk 5 min' },
  { id: '2',  day: 1, order: 2,  name: 'Palatine Hill',                      coordinates: [12.4860, 41.8894], description: 'Wander the ruins of imperial palaces with great views.',                                                       transport: 'Walk 5 min' },
  { id: '3',  day: 1, order: 3,  name: 'Roman Forum',                        coordinates: [12.4853, 41.8925], description: 'Explore the ancient civic center of the Roman Empire.',                                                        transport: 'Walk 10 min' },
  { id: '4',  day: 1, order: 4,  name: 'Capitoline Museums',                 coordinates: [12.4828, 41.8933], description: "World's oldest public museums.",                                                                               transport: 'Walk 2 min' },
  { id: '5',  day: 1, order: 5,  name: 'Altare della Patria',                coordinates: [12.4828, 41.8946], description: 'Massive monument. Take the elevator to the top for a panoramic sunset.',                                      transport: '' },
  // Day 2: Historic Center City Walk
  { id: '6',  day: 2, order: 6,  name: "Campo de' Fiori",                    coordinates: [12.4722, 41.8956], description: 'Vibrant morning market. Grab some fresh fruit.',                                                              transport: 'Walk 5 min' },
  { id: '7',  day: 2, order: 7,  name: 'Piazza Navona',                      coordinates: [12.4731, 41.8992], description: "Beautiful square featuring Bernini's fountains.",                                                              transport: 'Walk 5 min' },
  { id: '8',  day: 2, order: 8,  name: 'Pantheon',                           coordinates: [12.4768, 41.8986], description: 'The best-preserved ancient Roman building. Mind the oculus.',                                                 transport: 'Walk 5 min' },
  { id: '9',  day: 2, order: 9,  name: 'Giolitti',                           coordinates: [12.4768, 41.9010], description: 'Historic gelato shop. A necessary midday refuel.',                                                             transport: 'Walk 10 min' },
  { id: '10', day: 2, order: 10, name: 'Trevi Fountain',                     coordinates: [12.4833, 41.9009], description: 'Toss a coin over your shoulder.',                                                                              transport: 'Walk 10 min' },
  { id: '11', day: 2, order: 11, name: 'Spanish Steps',                      coordinates: [12.4823, 41.9059], description: 'Classic sunset spot to end the walking tour.',                                                                 transport: '' },
  // Day 3: Vatican City & Trastevere
  { id: '12', day: 3, order: 12, name: 'Vatican Museums',                    coordinates: [12.4545, 41.9065], description: 'Home to the Sistine Chapel. Pre-book tickets!',                                                               transport: 'Walk 10 min' },
  { id: '13', day: 3, order: 13, name: "St. Peter's Basilica",               coordinates: [12.4539, 41.9022], description: 'The largest church in the world. Climb the dome.',                                                            transport: 'Walk 15 min' },
  { id: '14', day: 3, order: 14, name: "Castel Sant'Angelo",                 coordinates: [12.4663, 41.9031], description: 'Historic fortress on the Tiber river.',                                                                       transport: 'Walk 25 min' },
  { id: '15', day: 3, order: 15, name: 'Piazza Santa Maria in Trastevere',   coordinates: [12.4698, 41.8896], description: 'Head across the river for dinner. The most charming neighborhood in Rome.',                                   transport: 'Walk 10 min' },
  { id: '16', day: 3, order: 16, name: 'Terrazza del Gianicolo',             coordinates: [12.4600, 41.8915], description: 'A slightly uphill walk, but offers the absolute best night view of Rome.',                                   transport: '' },
]

// ─── Conversion helpers ────────────────────────────────────────────────────────

// Times assigned to consecutive stops within a day
const STOP_TIMES = ['09:00', '10:30', '12:00', '13:30', '15:30', '17:00', '19:00']

function parseTransport(raw: string): Transport | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  let mode: Transport['mode'] = 'walk'
  if (lower.includes('drive') || lower.includes('uber') || lower.includes('taxi')) mode = 'taxi'
  else if (lower.includes('subway') || lower.includes('metro'))                    mode = 'subway'
  else if (lower.includes('bus'))                                                   mode = 'bus'
  else if (lower.includes('train'))                                                 mode = 'train'
  const match = raw.match(/\d+\s*min/i)
  return { mode, duration: match ? match[0] : raw, note: raw }
}

function buildResponse(items: MockItem[], destination: string, message: string): GeminiResponse {
  // Group and sort by day
  const dayMap = new Map<number, MockItem[]>()
  for (const item of items) {
    if (!dayMap.has(item.day)) dayMap.set(item.day, [])
    dayMap.get(item.day)!.push(item)
  }

  const itinerary: DayPlan[] = [...dayMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, dayItems]) => {
      const sorted = dayItems.sort((a, b) => a.order - b.order)
      const places: Place[] = sorted.map((item, idx) => ({
        name:          item.name,
        mapSearchName: item.name,
        time:          STOP_TIMES[idx] ?? '09:00',
        duration:      '1.5h',
        type:          'attraction',
        note:          item.description,
        coordinates:   item.coordinates,
        // Last stop of each day has no onward transport
        transportToNext: idx < sorted.length - 1 ? parseTransport(item.transport) : undefined,
      }))
      return { day, places }
    })

  return { status: 'itinerary_ready', message, destination, itinerary }
}

// ─── Exported responses ────────────────────────────────────────────────────────

export const mockStLouisResponse: GeminiResponse = {
  ...buildResponse(
    stLouisItems,
    'St. Louis, USA',
    "Here's your personalized 2-day St. Louis itinerary — from the iconic Gateway Arch to Forest Park. All spots are pinned on the map!",
  ),
  mockDestination: 'stlouis',
}

export const mockRome2DayResponse: GeminiResponse = {
  ...buildResponse(
    romeItems.filter((i) => i.day <= 2),
    'Rome, Italy',
    "Here's your 2-day Roman highlight reel — Ancient Rome on day one, the Historic Center on day two. Perfectly paced for a long weekend!",
  ),
  mockDestination: 'rome',
}

export const mockRome3DayResponse: GeminiResponse = {
  ...buildResponse(
    romeItems,
    'Rome, Italy',
    "Here's your full 3-day Roman adventure — Ancient Rome, the Historic Center, and Vatican City + Trastevere. Perfectly sequenced to minimize walking. Enjoy the Eternal City!",
  ),
  mockDestination: 'rome',
}

// Clarification prompts shown before building the itinerary

export const mockStLouisClarify: GeminiResponse = {
  status: 'need_clarification',
  message: "Great choice! St. Louis is underrated — the food scene alone is worth the trip. A couple quick questions to personalize your itinerary:",
  questions: [
    { type: 'slider', key: 'days', label: 'How many days do you have?', min: 1, max: 5, step: 1, unit: '' },
    { type: 'select', key: 'budget', label: 'Daily budget?', options: ['Budget (<$100)', 'Mid-range ($100–200)', 'Splurge ($200+)'] },
    { type: 'select', key: 'style', label: 'Travel vibe?', options: ['History & Culture', 'Food & Nightlife', 'Family-friendly', 'Mix of everything'] },
  ],
  mockDestination: 'stlouis',
}

export const mockRomeClarify: GeminiResponse = {
  status: 'need_clarification',
  message: "Roma! Excellent taste 🇮🇹 A few things so I can build the perfect trip for you:",
  questions: [
    { type: 'slider', key: 'days', label: 'How many days in Rome?', min: 1, max: 7, step: 1, unit: '' },
    { type: 'select', key: 'budget', label: 'Daily budget?', options: ['Budget (€60–120)', 'Mid-range (€120–250)', 'Luxury (€250+)'] },
    { type: 'select', key: 'interests', label: 'Top priority?', options: ['Ancient History', 'Art & Museums', 'Food & Wine', 'Hidden Gems'] },
  ],
  mockDestination: 'rome',
}
