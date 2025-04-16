import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { url } = body

    if (!url) {
      console.error("URL is required but was not provided")
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    console.log(`Server-side downloading avatar from: ${url}`)

    // Validate URL format
    let validatedUrl: URL
    try {
      validatedUrl = new URL(url)
    } catch (e) {
      console.error(`Invalid URL format: ${url}`, e)
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // For generated avatars from ui-avatars.com or avatar.vercel.sh, return them directly
    // as they don't have CORS restrictions
    if (url.includes("ui-avatars.com") || url.includes("avatar.vercel.sh")) {
      console.log("Using direct redirect for avatar service")
      return NextResponse.redirect(url)
    }

    // Fetch with timeout and retry logic
    let response = null
    let retries = 3

    while (retries > 0 && !response) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: validatedUrl.origin,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          console.error(`Failed to fetch image: ${response.status} ${response.statusText}`)
          response = null
          throw new Error(`HTTP error! status: ${response.status}`)
        }
      } catch (error) {
        console.error(`Fetch attempt ${4 - retries} failed:`, error)
        retries--

        if (retries === 0) {
          // If all retries fail, try a fallback approach
          console.log("All fetch attempts failed, trying fallback approach")
          return handleFallback(url)
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (!response) {
      console.error("Failed to fetch image after all retries")
      return NextResponse.json({ error: "Failed to fetch image after multiple attempts" }, { status: 500 })
    }

    // Get the image data and content type
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/png"

    // Return the image with the correct content type
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error) {
    console.error("Error in download-avatar API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Fallback handler for when direct fetch fails
async function handleFallback(url: string) {
  console.log("Using fallback approach for:", url)

  // For social media avatars, try to generate a placeholder instead
  if (url.includes("instagram") || url.includes("cdninstagram")) {
    const username = extractUsernameFromUrl(url, "instagram")
    const fallbackUrl = `https://ui-avatars.com/api/?name=${username}&background=e9f75a&color=333&size=256&bold=true`
    return NextResponse.redirect(fallbackUrl)
  }

  if (url.includes("twitter") || url.includes("twimg")) {
    const username = extractUsernameFromUrl(url, "twitter")
    const fallbackUrl = `https://ui-avatars.com/api/?name=${username}&background=1DA1F2&color=fff&size=256&bold=true`
    return NextResponse.redirect(fallbackUrl)
  }

  if (url.includes("facebook") || url.includes("fbcdn")) {
    const username = extractUsernameFromUrl(url, "facebook")
    const fallbackUrl = `https://ui-avatars.com/api/?name=${username}&background=3b5998&color=fff&size=256&bold=true`
    return NextResponse.redirect(fallbackUrl)
  }

  // Generic fallback for other URLs
  return NextResponse.json(
    {
      error: "Failed to fetch image",
      fallbackUrl: "https://ui-avatars.com/api/?name=User&background=random&size=256",
    },
    { status: 500 },
  )
}

// Helper function to extract username from URL
function extractUsernameFromUrl(url: string, platform: string): string {
  try {
    // Try to extract username from URL patterns
    if (platform === "instagram") {
      const match = url.match(/instagram\.com\/([^/?]+)/i)
      if (match && match[1]) return match[1]
    }

    if (platform === "twitter") {
      const match = url.match(/twitter\.com\/([^/?]+)/i)
      if (match && match[1]) return match[1]
    }

    if (platform === "facebook") {
      const match = url.match(/facebook\.com\/([^/?]+)/i)
      if (match && match[1]) return match[1]
    }

    // If no match found, use first two letters of the platform
    return platform.substring(0, 2).toUpperCase()
  } catch (e) {
    return "User"
  }
}
