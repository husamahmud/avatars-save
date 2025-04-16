"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Download, Search, User } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import Image from "next/image"
import { fetchAvatar } from "@/app/actions"

interface PlatformPattern {
  id: string
  name: string
  urlPattern: RegExp
  extractUsername: (url: string) => string | null
}

const platformPatterns: PlatformPattern[] = [
  {
    id: "facebook",
    name: "Facebook",
    urlPattern: /(?:https?:\/\/)?(?:www\.)?(facebook\.com|fb\.com)\/([^/?]+)/i,
    extractUsername: (url: string) => {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?(facebook\.com|fb\.com)\/([^/?]+)/i)
      return match ? match[2] : null
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    urlPattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?]+)/i,
    extractUsername: (url: string) => {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?]+)/i)
      return match ? match[1] : null
    },
  },
  {
    id: "twitter",
    name: "Twitter",
    urlPattern: /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([^/?]+)/i,
    extractUsername: (url: string) => {
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/([^/?]+)/i)
      return match ? match[2] : null
    },
  },
]

export default function AvatarDownloaderPage() {
  const [profileUrl, setProfileUrl] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [extractedUsername, setExtractedUsername] = useState<string | null>(null)

  const handleExtractAndFetch = async () => {
    if (!profileUrl.trim()) {
      toast({
        title: "Input required",
        description: "Please enter a social media profile link",
        variant: "destructive",
      })
      return
    }

    // Detect platform and extract username
    let detectedPattern: PlatformPattern | undefined
    let username: string | null = null

    for (const pattern of platformPatterns) {
      if (pattern.urlPattern.test(profileUrl)) {
        detectedPattern = pattern
        username = pattern.extractUsername(profileUrl)
        break
      }
    }

    if (!detectedPattern || !username) {
      toast({
        title: "Unsupported link",
        description: "Please enter a valid Facebook, Instagram, or Twitter profile link",
        variant: "destructive",
      })
      return
    }

    setDetectedPlatform(detectedPattern.name)
    setExtractedUsername(username)
    setLoading(true)
    setError(null)

    try {
      console.log(`Fetching avatar for platform: ${detectedPattern.id}, username: ${username}`)
      const result = await fetchAvatar(detectedPattern.id, username)

      if (result.error && !result.avatarUrl) {
        // Complete error - no avatar found
        setError(result.error)
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        setAvatarUrl(null)
      } else if (result.avatarUrl) {
        // We have an avatar URL
        setAvatarUrl(result.avatarUrl)

        if (result.error) {
          // We have an avatar but also an error/warning
          setError(result.error)
          toast({
            title: "Partial Success",
            description: result.error,
          })
        } else {
          // Complete success
          toast({
            title: "Success",
            description: `Found ${detectedPattern.name} avatar for ${username}`,
          })
        }
      }
    } catch (err) {
      console.error("Avatar fetching error:", err)
      setError("Failed to fetch avatar. Please try again.")
      toast({
        title: "Error",
        description: "Failed to fetch avatar. Please try again.",
        variant: "destructive",
      })
      setAvatarUrl(null)
    } finally {
      setLoading(false)
    }
  }

  const downloadAvatar = async () => {
    if (!avatarUrl) return

    setLoading(true)

    try {
      console.log(`Attempting to download avatar from: ${avatarUrl}`)

      // For generated avatars from ui-avatars.com or avatar.vercel.sh, download directly
      if (avatarUrl.includes("ui-avatars.com") || avatarUrl.includes("avatar.vercel.sh")) {
        console.log("Using direct download for avatar service")
        await downloadImageDirectly(avatarUrl)
        return
      }

      // For social media avatars, use server-side proxy
      console.log("Using server-side download for social media avatar")
      const result = await fetch("/api/download-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: avatarUrl }),
      })

      if (!result.ok) {
        // Check if we got a redirect response
        if (result.redirected) {
          console.log("Received redirect to:", result.url)
          await downloadImageDirectly(result.url)
          return
        }

        // Try to get error details
        let errorDetails = "Unknown error"
        try {
          const errorData = await result.json()
          errorDetails = errorData.message || errorData.error || "Server download failed"

          // If we have a fallback URL, use it
          if (errorData.fallbackUrl) {
            console.log("Using fallback URL:", errorData.fallbackUrl)
            await downloadImageDirectly(errorData.fallbackUrl)
            return
          }
        } catch (e) {
          console.error("Failed to parse error response:", e)
        }

        throw new Error(`Server download failed: ${errorDetails}`)
      }

      // Process successful response
      const blob = await result.blob()
      await saveBlob(blob)
    } catch (err) {
      console.error("Download error:", err)

      // Fallback to direct download
      try {
        console.log("Attempting direct download as fallback")
        await downloadImageDirectly(avatarUrl)
      } catch (directErr) {
        console.error("Direct download failed:", directErr)

        // Final fallback: Open image in new tab for manual download
        try {
          console.log("Attempting to open in new tab for manual download")
          window.open(avatarUrl, "_blank")

          toast({
            title: "Manual download required",
            description:
              "We couldn't download automatically. Right-click the image in the new tab and select 'Save image as...'",
          })
        } catch (fallbackErr) {
          console.error("Fallback download failed:", fallbackErr)

          toast({
            title: "Download failed",
            description:
              "Failed to download the avatar. Please try again or right-click the image and save it manually.",
            variant: "destructive",
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Helper function to download an image directly
  const downloadImageDirectly = async (url: string) => {
    console.log("Downloading directly from:", url)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Direct image fetch failed with status: ${response.status}`)
    }

    const blob = await response.blob()
    await saveBlob(blob)
  }

  // Helper function to save a blob as a file
  const saveBlob = async (blob: Blob) => {
    const url = window.URL.createObjectURL(blob)

    // Create download link
    const a = document.createElement("a")
    a.style.display = "none"
    a.href = url

    // Extract filename from URL or use default
    const username = extractedUsername || "user"
    const platform = detectedPlatform?.toLowerCase() || "social"
    const fileExtension = getFileExtensionFromMimeType(blob.type) || "png"
    const filename = `${platform}-${username}-avatar.${fileExtension}`

    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast({
      title: "Success",
      description: "Avatar downloaded successfully",
    })
  }

  // Helper function to get file extension from MIME type
  const getFileExtensionFromMimeType = (mimeType: string): string => {
    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
      "image/tiff": "tiff",
    }

    return mimeToExt[mimeType] || "png"
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Social Media Avatar Downloader</CardTitle>
          <CardDescription>
            Enter any Facebook, Instagram, or Twitter profile link to download the avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://instagram.com/username or https://twitter.com/username"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleExtractAndFetch}
                disabled={loading}
                className="shrink-0"
                aria-label="Search for avatar"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {detectedPlatform && extractedUsername && (
              <p className="text-sm text-muted-foreground mt-1">
                Detected: <span className="font-medium">{detectedPlatform}</span> profile for{" "}
                <span className="font-medium">{extractedUsername}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col items-center justify-center pt-4">
            {loading ? (
              <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : avatarUrl ? (
              <div className="relative h-32 w-32">
                <Image
                  src={avatarUrl || "/placeholder.svg"}
                  alt="User avatar"
                  fill
                  className="rounded-full object-cover"
                />
              </div>
            ) : (
              <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-12 w-12 text-gray-400" />
              </div>
            )}

            {error && <p className="text-destructive text-sm mt-2">{error}</p>}
          </div>
        </CardContent>

        <CardFooter>
          <Button className="w-full" onClick={downloadAvatar} disabled={!avatarUrl || loading}>
            <Download className="mr-2 h-4 w-4" /> Download Avatar
          </Button>
        </CardFooter>
      </Card>
      <Toaster />
    </div>
  )
}
