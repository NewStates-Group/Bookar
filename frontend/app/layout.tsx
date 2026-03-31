import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { AuthGuard } from '@/components/AuthGuard'
import NextTopLoader from 'nextjs-toploader';

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Bookar',
  description: 'Aprenda utilizando IA e impulsione sua carreira',
  icons: {
    icon: "/logo-white.png",
  },
  openGraph: {
    title: 'Bookar',
    description: 'Aprenda utilizando IA e impulsione sua carreira',
    url: 'https://bookar.study',
    siteName: 'Bookar',
    images: [
      {
        url: 'https://bookar.study/logo-white.png',
        width: 800,
        height: 600,
      },
    ],
    locale: 'pt-PT',
    type: 'website',
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Bookar',
  //   description: 'Aprenda utilizando IA e impulsione sua carreira',
  //   images: ['https://bookar.study/logo.png'],
  // },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-PT">
      <body className={`font-sans antialiased`}>
        <NextTopLoader
          color="linear-gradient(to right, #2563eb, #06b6d4)"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #2563eb,0 0 5px #06b6d4"
        />
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
        <Toaster position='top-right' />
        {/* <script defer src='https://static.cloudflareinsights.com/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516' integrity='sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==' crossOrigin='anonymous'></script> */}
      </body>
    </html>
  )
}
