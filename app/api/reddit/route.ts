import { NextRequest, NextResponse } from 'next/server'
import { searchRedditPosts } from '@/lib/reddit'

export async function POST(req: NextRequest) {
  try {
    const { placeName, destination }: { placeName: string; destination: string } = await req.json()

    if (!placeName || !destination) {
      return NextResponse.json({ error: 'placeName and destination required' }, { status: 400 })
    }

    const posts = await searchRedditPosts(placeName, destination)
    return NextResponse.json({ posts })
  } catch (err) {
    console.error('Reddit API error:', err)
    return NextResponse.json({ posts: [] })
  }
}
