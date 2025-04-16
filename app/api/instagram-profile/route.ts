import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // Get the username from query params
    const username = request.nextUrl.searchParams.get('username')
    
    if (!username) {
      return NextResponse.json(
        { error: 'Missing username parameter' },
        { status: 400 }
      )
    }

    console.log(`Fetching Instagram profile for ${username} via server-side proxy`)
    
    // Try to fetch the profile page with enhanced headers
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-store'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Instagram profile: ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    
    // First try to extract the JSON data
    const jsonDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/)
    if (jsonDataMatch && jsonDataMatch[1]) {
      try {
        const data = JSON.parse(jsonDataMatch[1])
        const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user
        
        if (user?.profile_pic_url_hd) {
          return NextResponse.json({ avatarUrl: user.profile_pic_url_hd })
        } else if (user?.profile_pic_url) {
          return NextResponse.json({ avatarUrl: user.profile_pic_url })
        }
      } catch (e) {
        console.error('JSON parsing failed:', e)
      }
    }
    
    // If JSON extraction fails, try regex patterns
    const patterns = [
      /"profile_pic_url_hd":"([^"]+)"/,
      /"profile_pic_url":"([^"]+)"/,
      /profilePicture[^}]+"uri":"([^"]+)"/,
      /<meta property="og:image" content="([^"]+)"/i,
      /profile_pic_url\\?":\\?"([^"\\]+)/
    ]
    
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        const avatarUrl = match[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\\//g, '/')
          .replace(/\\/g, '')
        
        return NextResponse.json({ avatarUrl })
      }
    }
    
    // Try alternate API call as a fallback
    try {
      const alternateResponse = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com'
        }
      })
      
      if (alternateResponse.ok) {
        const data = await alternateResponse.json()
        if (data?.data?.user?.profile_pic_url_hd) {
          return NextResponse.json({ avatarUrl: data.data.user.profile_pic_url_hd })
        } else if (data?.data?.user?.profile_pic_url) {
          return NextResponse.json({ avatarUrl: data.data.user.profile_pic_url })
        }
      }
    } catch (e) {
      console.error('Alternate API call failed:', e)
    }
    
    // No avatar found
    return NextResponse.json(
      { error: 'Could not find Instagram avatar' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Instagram profile proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 