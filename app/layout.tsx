import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Social Media Avatar Downloader',
  authors: [{ name: 'Hüsam', url: 'https://www.husam.ninja' }],
  creator: 'Hüsam',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
