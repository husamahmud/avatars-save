"use server"

import { cache } from "react"

interface AvatarResult {
  avatarUrl?: string
  error?: string
}

export const fetchAvatar = cache(async (platform: string, username: string): Promise<AvatarResult> => {
  try {
    switch (platform) {
      case "facebook":
        return await fetchFacebookAvatar(username)
      case "instagram":
        return await fetchInstagramAvatar(username)
      case "twitter":
        return await fetchTwitterAvatar(username)
      default:
        return { error: "Unsupported platform" }
    }
  } catch (error) {
    console.error("Error fetching avatar:", error)
    return { error: "Failed to fetch avatar. Please try again." }
  }
})

async function fetchFacebookAvatar(username: string): Promise<AvatarResult> {
  try {
    console.log(`Attempting to fetch Facebook avatar for: ${username}`)

    // TECHNIQUE 1: Try Facebook's public CDN with specific parameters
    try {
      console.log("Technique 1: Public CDN with specialized parameters")
      const timestamp = Date.now()
      const urls = [
        `https://graph.facebook.com/${username}/picture?height=800&width=800&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        `https://graph.facebook.com/${username}/picture?type=large&redirect=false&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        `https://graph.facebook.com/${username}/picture?width=1000&redirect=true&_rdt=1&_rdr=1`
      ]
      
      for (const url of urls) {
        console.log(`Trying URL: ${url}`)
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*, */*',
            'Cache-Control': 'no-cache',
          }
        })
        
        if (response.ok) {
          // For redirect=false endpoints check JSON
          if (url.includes('redirect=false')) {
            try {
              const data = await response.json()
              if (data?.data?.url && !data.data.is_silhouette) {
                console.log(`Found Facebook avatar via Technique 1 (JSON): ${data.data.url}`)
                return { avatarUrl: data.data.url }
              }
            } catch (e) {
              // Not JSON, continue with URL check
            }
          } else {
            // For direct image URLs
            const finalUrl = response.url
            if (!isDefaultImage(finalUrl)) {
              console.log(`Found Facebook avatar via Technique 1 (redirect): ${finalUrl}`)
              return { avatarUrl: finalUrl }
            }
          }
        } else {
          console.log(`URL response status: ${response.status}`)
        }
      }
    } catch (e) {
      console.error("Technique 1 failed:", e)
    }

    // TECHNIQUE 2: Try browser-like scraping with proper headers
    try {
      console.log("Technique 2: Enhanced browser-like scraping")
      const response = await fetch(`https://www.facebook.com/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Advanced pattern matching for profile images
        const patterns = [
          /<meta property="og:image" content="([^"]+)"/i,
          /"profilePicture"[^}]+"uri":"([^"]+)"/,
          /"profile_picture_for_sticky_bar"[^}]+"uri":"([^"]+)"/,
          /"profile_picture"[^}]+"uri":"([^"]+)"/,
          /"profilePhoto":"([^"]+)"/,
          /\\"profilePhoto\\":\\"([^\\]+)\\"/,
          /https:\/\/scontent[^"']+?\/(?:v|p|s)[^"']+?\.(?:jpg|jpeg|png|gif)/i
        ]
        
        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            let avatarUrl = match[1].replace(/\\/g, '').replace(/&amp;/g, '&')
            if (!isDefaultImage(avatarUrl)) {
              console.log(`Found Facebook avatar via Technique 2: ${avatarUrl}`)
              
              // Fix incomplete URLs
              if (avatarUrl.startsWith('//')) {
                avatarUrl = 'https:' + avatarUrl
              }
              
              return { avatarUrl }
            }
          }
        }
      }
    } catch (e) {
      console.error("Technique 2 failed:", e)
    }

    // TECHNIQUE 3: Try accessing mobile Facebook which sometimes has different access rules
    try {
      console.log("Technique 3: Mobile Facebook access")
      const response = await fetch(`https://m.facebook.com/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Look for profile image in mobile HTML
        const patterns = [
          /<img[^>]+?(?:profile_pic|profilephoto)[^>]+?src="([^"]+)"/i,
          /"profilePhoto":"([^"]+)"/,
          /<meta property="og:image" content="([^"]+)"/i
        ]
        
        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            const avatarUrl = match[1].replace(/&amp;/g, '&')
            if (!isDefaultImage(avatarUrl)) {
              console.log(`Found Facebook avatar via Technique 3: ${avatarUrl}`)
              return { avatarUrl }
            }
          }
        }
      }
    } catch (e) {
      console.error("Technique 3 failed:", e)
    }

    // TECHNIQUE 4: Try using numeric ID if username might contain one
    try {
      console.log("Technique 4: Extracting and using numeric ID if available")
      
      // Check if username has a numeric component that could be an ID
      const numericMatch = username.match(/(\d+)/)
      if (numericMatch) {
        const numericId = numericMatch[1]
        console.log(`Found possible numeric ID: ${numericId}`)
        
        const url = `https://graph.facebook.com/${numericId}/picture?type=large&redirect=false`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          try {
            const data = await response.json()
            if (data?.data?.url && !data.data.is_silhouette) {
              console.log(`Found Facebook avatar via Technique 4: ${data.data.url}`)
              return { avatarUrl: data.data.url }
            }
          } catch (e) {
            console.log("Not valid JSON response")
          }
        }
      }
    } catch (e) {
      console.error("Technique 4 failed:", e)
    }

    // As a last resort, try some third-party services
    try {
      console.log("Technique 5: Third-party services")
      const services = [
        `https://unavatar.io/facebook/${username}?fallback=false`,
        `https://avatars.dicebear.com/api/avataaars/${username}.svg`
      ]
      
      for (const service of services) {
        const response = await fetch(service, { method: 'HEAD' })
        if (response.ok && !response.url.includes('fallback')) {
          console.log(`Found avatar via third-party service: ${service}`)
          return { avatarUrl: service }
        }
      }
    } catch (e) {
      console.error("Technique 5 failed:", e)
    }

    // If all attempts fail, generate a more distinctive avatar
    console.log("Using a custom generated avatar")
    
    // Create a more unique and personalized avatar
    // Extract name components from username for a better avatar
    let displayName = username
      .replace(/\.\d+$/, '') // Remove numeric suffixes like .123
      .replace(/\./g, ' ')   // Replace dots with spaces
      .trim()
    
    // If the name is still just one word, try to make it two by splitting
    if (!displayName.includes(' ') && displayName.length > 2) {
      displayName = `${displayName.substring(0, 1)} ${displayName.substring(1)}`
    }
    
    // Generate a unique hash from the username for consistent colors
    const hashCode = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0 // Convert to 32bit integer
      }
      return Math.abs(hash)
    }
    
    // Generate a unique background color based on the username
    const hash = hashCode(username)
    const hue = hash % 360
    const saturation = 70 + (hash % 30) // 70-100%
    const lightness = 45 + (hash % 15)  // 45-60%
    
    // Convert HSL to hex for the URL
    const hslToHex = (h: number, s: number, l: number) => {
      s /= 100
      l /= 100
      const a = s * Math.min(l, 1 - l)
      const f = (n: number) => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
      }
      return `${f(0)}${f(8)}${f(4)}`
    }
    
    const bgHex = hslToHex(hue, saturation, lightness)
    
    // Determine if we need light or dark text
    const textColor = lightness > 50 ? '333333' : 'ffffff'
    
    // Create the avatar URL with multiple parameters for uniqueness
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${bgHex}&color=${textColor}&size=256&bold=true&format=png&length=2`
    
    console.log(`Generated avatar with color #${bgHex} for ${username}`)
    
    return {
      avatarUrl,
      error: "Could not retrieve Facebook profile picture. Using a generated avatar.",
    }
  } catch (error) {
    console.error("Facebook avatar fetching failed completely:", error)
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4267B2&color=fff&size=256&bold=true&length=2`,
      error: "Failed to fetch Facebook avatar. Using a generated placeholder.",
    }
  }
}

// Helper function to check if a URL is a default/silhouette image
function isDefaultImage(url: string): boolean {
  const result = url.includes('facebook.com/rsrc.php') || 
          url.includes('/t1.30497-1/') ||
          url.includes('silhouette') ||
          url.includes('s230x230') ||
          url.includes('p64x64') ||
          url.includes('cp0_dst-jpg_s64x64') ||
          url.includes('_q.jpg') ||
          url.includes('_s.jpg')
  
  if (result) {
    console.log('Detected default/silhouette image:', url)
  }
  return result
}

async function fetchInstagramAvatar(username: string): Promise<AvatarResult> {
  try {
    console.log(`Attempting to fetch Instagram avatar for: ${username}`)

    // TECHNIQUE 1: Try using third-party services
    try {
      console.log("Technique 1: Using reliable third-party services")
      const services = [
        `https://unavatar.io/instagram/${username}?fallback=false&cache=no-store`,
        `https://avatar.vercel.sh/instagram:${username}?size=1024`,
        `https://ui-avatars.com/api/?name=${username}&color=fff&background=E1306C&size=512&bold=true`
      ]
      
      for (const service of services) {
        try {
          console.log(`Trying service: ${service}`)
          const response = await fetch(service, { 
            method: "HEAD",
            headers: {
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            },
            next: { revalidate: 0 }
          })
          
          if (response.ok && !service.includes('ui-avatars') && !response.url.includes('fallback')) {
            console.log(`Found Instagram avatar via third-party service: ${service}`)
            return { avatarUrl: service }
          }
        } catch (err) {
          console.log(`Service ${service} failed: ${err}`)
          // Continue to next service
        }
      }
    } catch (e) {
      console.error("Technique 1 failed:", e)
    }

    // TECHNIQUE 2: Try our server-side proxy to Instagram web
    try {
      console.log("Technique 2: Using server-side proxy to Instagram")
      
      // Create a serverless function to make this request if doesn't exist yet
      const response = await fetch(`/api/instagram-profile?username=${encodeURIComponent(username)}`, {
        headers: {
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
        next: { revalidate: 0 }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.avatarUrl) {
          console.log(`Found Instagram avatar via server proxy: ${data.avatarUrl}`)
          return { avatarUrl: data.avatarUrl }
        }
      }
    } catch (e) {
      console.error("Technique 2 failed:", e)
    }

    // TECHNIQUE 3: Try direct fetch with improved headers
    try {
      console.log("Technique 3: Direct fetch with improved headers")
      
      const response = await fetch(`https://www.instagram.com/${username}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "https://www.instagram.com/",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin"
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // First try to extract the JSON data that Instagram loads
        const jsonDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/)
        if (jsonDataMatch && jsonDataMatch[1]) {
          try {
            const data = JSON.parse(jsonDataMatch[1])
            const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user
            
            if (user?.profile_pic_url_hd) {
              console.log(`Found Instagram HD avatar via JSON data: ${user.profile_pic_url_hd}`)
              return { avatarUrl: user.profile_pic_url_hd }
            } else if (user?.profile_pic_url) {
              console.log(`Found Instagram standard avatar via JSON data: ${user.profile_pic_url}`)
              return { avatarUrl: user.profile_pic_url }
            }
          } catch (e) {
            console.error("JSON parsing failed:", e)
          }
        }
        
        // If JSON method fails, try regex patterns
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
              .replace(/\\u0026/g, "&")
              .replace(/\\\//g, "/")
              .replace(/\\/g, "")
            console.log(`Found Instagram avatar via regex pattern: ${avatarUrl}`)
            return { avatarUrl }
          }
        }
      }
    } catch (e) {
      console.error("Technique 3 failed:", e)
    }

    // TECHNIQUE 4: Generate a distinctive avatar for this username
    console.log("All Instagram avatar techniques failed, generating unique avatar")
    
    // Generate a unique hash for the username
    const hashCode = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0 // Convert to 32bit integer
      }
      return Math.abs(hash)
    }
    
    // Instagram colors with slight variations based on username
    const hash = hashCode(username)
    const hue = 330 + (hash % 30) // Pink to purple range (Instagram colors)
    const saturation = 80 + (hash % 20)
    const lightness = 50 + (hash % 15)
    
    // Convert HSL to hex
    const hslToHex = (h: number, s: number, l: number) => {
      s /= 100
      l /= 100
      const a = s * Math.min(l, 1 - l)
      const f = (n: number) => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
      }
      return `${f(0)}${f(8)}${f(4)}`
    }
    
    const bgHex = hslToHex(hue, saturation, lightness)
    
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${bgHex}&color=ffffff&size=256&bold=true&length=2`
    
    console.log(`Generated unique Instagram-themed avatar: ${avatarUrl}`)
    return {
      avatarUrl,
      error: "Could not fetch Instagram avatar. Using generated placeholder.",
    }
  } catch (error) {
    console.error("Instagram avatar fetching failed completely:", error)
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=E1306C&color=fff&size=256&bold=true&length=2`,
      error: "Failed to fetch Instagram avatar. Using generated placeholder.",
    }
  }
}

async function fetchTwitterAvatar(username: string): Promise<AvatarResult> {
  try {
    console.log(`Attempting to fetch Twitter avatar for: ${username}`)

    // Method 1: Try using a reliable third-party service
    try {
      console.log("Trying Method 1: Twitter avatar service (unavatar)")
      const avatarUrl = `https://unavatar.io/twitter/${username}`

      // Verify the URL returns a valid image
      const response = await fetch(avatarUrl, { method: "HEAD" })

      if (response.ok) {
        console.log(`Found Twitter avatar via Method 1: ${avatarUrl}`)
        return { avatarUrl }
      } else {
        console.log(`Twitter avatar service failed: ${response.status}`)
      }
    } catch (e) {
      console.error("Method 1 failed:", e)
    }

    // Method 2: Try another third-party service
    try {
      console.log("Trying Method 2: Alternative Twitter avatar service")
      const avatarUrl = `https://avatar.vercel.sh/twitter:${username}`

      // This service always returns an image, so we don't need to check status
      console.log(`Using Twitter avatar via Method 2: ${avatarUrl}`)
      return { avatarUrl }
    } catch (e) {
      console.error("Method 2 failed:", e)
    }

    // Method 3: Try direct scraping of Twitter profile page
    try {
      console.log("Trying Method 3: Direct Twitter profile page")
      const response = await fetch(`https://twitter.com/${username}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        next: { revalidate: 0 }, // Don't cache to avoid stale responses
      })

      if (!response.ok) {
        console.log(`Twitter profile page not accessible: ${response.status}`)
        throw new Error(`Twitter profile page returned status: ${response.status}`)
      }

      const html = await response.text()

      // Look for profile image in the HTML
      const profileImageMatch = html.match(/https:\/\/pbs\.twimg\.com\/profile_images\/[^"'\s]+/)

      if (profileImageMatch) {
        // Get the URL and replace _normal with _400x400 for higher resolution
        const avatarUrl = profileImageMatch[0].replace(/_normal\./, "_400x400.")
        console.log(`Found Twitter avatar via Method 3: ${avatarUrl}`)
        return { avatarUrl }
      } else {
        console.log("No profile image match found in Twitter HTML")
      }
    } catch (e) {
      console.error("Method 3 failed:", e)
    }

    // Method 4: Try the syndication API
    try {
      console.log("Trying Method 4: Twitter syndication API")
      const response = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        next: { revalidate: 0 }, // Don't cache to avoid stale responses
      })

      if (!response.ok) {
        console.log(`Twitter syndication API failed: ${response.status}`)
        throw new Error(`Twitter syndication API returned status: ${response.status}`)
      }

      const html = await response.text()

      // Extract the profile image URL using regex
      const profileImageMatch = html.match(/"profile_image_url_https":"([^"]+)"/)

      if (profileImageMatch && profileImageMatch[1]) {
        // Replace the normal size with the original size
        let avatarUrl = profileImageMatch[1].replace(/normal/g, "400x400")
        // Unescape the URL
        avatarUrl = avatarUrl.replace(/\\u002F/g, "/")
        console.log(`Found Twitter avatar via Method 4: ${avatarUrl}`)
        return { avatarUrl }
      } else {
        console.log("No profile image match found in syndication API response")
      }
    } catch (e) {
      console.error("Method 4 failed:", e)
    }

    // Fallback to generated avatar with Twitter-like styling
    console.log("All Twitter avatar methods failed, using generated placeholder")
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=1DA1F2&color=fff&size=256&bold=true`,
      error: "Could not fetch Twitter avatar. Using generated placeholder.",
    }
  } catch (error) {
    console.error("Twitter avatar fetching failed completely:", error)
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=1DA1F2&color=fff&size=256&bold=true`,
      error: "Failed to fetch Twitter avatar. Using generated placeholder.",
    }
  }
}
