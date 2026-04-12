import { RedditPost } from '@/types/itinerary'

// City-to-subreddit mapping for better results
const CITY_SUBREDDITS: Record<string, string[]> = {
  tokyo: ['JapanTravel', 'tokyo', 'japanlife'],
  kyoto: ['JapanTravel', 'kyoto'],
  osaka: ['JapanTravel', 'osaka'],
  paris: ['ParisTravelGuide', 'france', 'travel'],
  london: ['london', 'travel', 'unitedkingdom'],
  'new york': ['nyc', 'AskNYC', 'travel'],
  bali: ['bali', 'indonesia', 'travel'],
  bangkok: ['ThailandTourism', 'bangkok', 'travel'],
  default: ['travel', 'solotravel', 'backpacking'],
}

function getSubreddits(destination: string): string[] {
  const lower = destination.toLowerCase()
  for (const [city, subs] of Object.entries(CITY_SUBREDDITS)) {
    if (lower.includes(city)) return subs
  }
  return CITY_SUBREDDITS.default
}

export async function searchRedditPosts(
  placeName: string,
  destination: string
): Promise<RedditPost[]> {
  const subreddits = getSubreddits(destination)
  const query = encodeURIComponent(`${placeName}`)
  const subredditStr = subreddits.join('+')

  try {
    const url = `https://www.reddit.com/r/${subredditStr}/search.json?q=${query}&sort=relevance&limit=3&restrict_sr=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelMapApp/1.0' },
    })
    const data = await res.json()

    if (!data.data?.children) return []

    return data.data.children
      .filter((c: any) => c.data.score > 10)
      .slice(0, 3)
      .map((c: any) => ({
        title: c.data.title,
        url: `https://reddit.com${c.data.permalink}`,
        score: c.data.score,
        subreddit: c.data.subreddit,
      }))
  } catch (err) {
    console.error('Reddit search error for', placeName, err)
    return []
  }
}
