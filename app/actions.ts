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
    // For Facebook, we'll use the public Graph API endpoint for profile pictures
    // This works without authentication for many public profiles
    const avatarUrl = `https://graph.facebook.com/${username}/picture?type=large&redirect=true`

    // Verify the URL returns a valid image by checking headers
    const response = await fetch(avatarUrl, { method: "HEAD" })

    if (!response.ok) {
      return {
        avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=random&size=256`,
        error: "Could not fetch Facebook avatar. Using generated placeholder.",
      }
    }

    // Check if it's a default silhouette image by checking content length
    // Facebook default silhouette images tend to be smaller than real avatars
    const contentLength = response.headers.get("content-length")
    if (contentLength && Number.parseInt(contentLength) < 3000) {
      return {
        avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=random&size=256`,
        error: "Found default Facebook avatar. Using generated placeholder instead.",
      }
    }

    return { avatarUrl }
  } catch (error) {
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=random&size=256`,
      error: "Failed to fetch Facebook avatar. Using generated placeholder.",
    }
  }
}

async function fetchInstagramAvatar(username: string): Promise<AvatarResult> {
  try {
    console.log(`Attempting to fetch Instagram avatar for: ${username}`)

    // Method 1: Try the updated Instagram avatar service from unavatar.io
    try {
      console.log("Trying Method 1: Updated Instagram avatar service (unavatar)")
      // Use the latest endpoint with forced refresh parameter
      const avatarUrl = `https://unavatar.io/instagram/${username}?fallback=false&cache=no-store`

      // Verify the URL returns a valid image
      const response = await fetch(avatarUrl, { 
        method: "HEAD",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        next: { revalidate: 0 } // Ensure no Next.js caching
      })

      if (response.ok) {
        console.log(`Found Instagram avatar via Method 1: ${avatarUrl}`)
        return { avatarUrl }
      } else {
        console.log(`Instagram avatar service failed: ${response.status}`)
      }
    } catch (e) {
      console.error("Method 1 failed:", e)
    }

    // Method 2: Try using Proxied Instagram GraphQL API
    try {
      console.log("Trying Method 2: Proxied Instagram GraphQL API")
      
      // Use a specialized endpoint for Instagram profile data
      const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.9999.999 Safari/537.36",
          "Accept": "application/json",
          "X-IG-App-ID": "936619743392459", // Public Instagram Web App ID
          "X-Requested-With": "XMLHttpRequest",
          "Sec-Fetch-Site": "same-site",
          "Sec-Fetch-Mode": "cors",
          "Referer": "https://www.instagram.com/",
          "Origin": "https://www.instagram.com"
        },
        next: { revalidate: 0 }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data?.data?.user?.profile_pic_url_hd) {
          const avatarUrl = data.data.user.profile_pic_url_hd;
          console.log(`Found Instagram avatar via Method 2: ${avatarUrl}`);
          return { avatarUrl };
        } else if (data?.data?.user?.profile_pic_url) {
          const avatarUrl = data.data.user.profile_pic_url;
          console.log(`Found Instagram avatar via Method 2 (standard res): ${avatarUrl}`);
          return { avatarUrl };
        }
      } else {
        console.log(`Instagram GraphQL API failed: ${response.status}`);
      }
    } catch (e) {
      console.error("Method 2 failed:", e);
    }
    
    // Method 3: Use avatar.vercel.sh (always returns an image)
    try {
      console.log("Trying Method 3: Reliable avatar generator service")
      // This service always returns an image
      const avatarUrl = `https://avatar.vercel.sh/instagram:${username}`
      console.log(`Using Instagram avatar via Method 3: ${avatarUrl}`)
      return { avatarUrl }
    } catch (e) {
      console.error("Method 3 failed:", e)
    }

    // Method 4: Try improved HTML parsing with more accurate selector targeting
    try {
      console.log("Trying Method 4: Enhanced Instagram profile HTML parsing")
      const response = await fetch(`https://www.instagram.com/${username}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        next: { revalidate: 0 }
      })

      if (!response.ok) {
        console.log(`Instagram profile not accessible: ${response.status}`)
        throw new Error("Instagram profile not accessible")
      }

      const html = await response.text()

      // More comprehensive regex patterns to find profile images
      const patterns = [
        /"profile_pic_url_hd":"([^"]+)"/,
        /"profile_pic_url":"([^"]+)"/,
        /profilePicture[^}]+"uri":"([^"]+)"/,
        /profile_pic_url\\?":\\?"([^"\\]+)/
      ]
      
      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match && match[1]) {
          const avatarUrl = match[1]
            .replace(/\\u0026/g, "&")
            .replace(/\\\//g, "/")
            .replace(/\\/g, "")
          console.log(`Found Instagram avatar via Method 4 with pattern: ${pattern}`)
          return { avatarUrl }
        }
      }
      
      console.log("No profile image match found in Instagram HTML")
    } catch (e) {
      console.error("Method 4 failed:", e)
    }

    // Fallback to a more sophisticated generated avatar
    console.log("All Instagram avatar methods failed, using improved generated placeholder")
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=e9f75a&color=333&size=256&bold=true&length=2`,
      error: "Could not fetch Instagram avatar. Using generated placeholder.",
    }
  } catch (error) {
    console.error("Instagram avatar fetching failed completely:", error)
    return {
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=e9f75a&color=333&size=256&bold=true&length=2`,
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
