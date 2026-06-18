import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { AuthGuard } from '@/components/AuthGuard'
import NextTopLoader from 'nextjs-toploader';
import { GoogleAnalytics } from '@next/third-parties/google'
import { ThemeProvider } from '@/components/theme-provider'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Bookar',
  description: 'Aprenda mais rápido utilizando IA',
  icons: {
    icon: [
      {
        "url": "/logo-white.png",
        "media": "(prefers-color-scheme: light)"
      },
      {
        "url": "/logo.png",
        "media": "(prefers-color-scheme: dark)"
      }
    ],
  },
  openGraph: {
    title: 'Bookar',
    description: 'Aprenda mais rápido utilizando IA',
    url: 'https://bookar.study',
    siteName: 'Bookar',
    images: [
      {
        url: 'https://bookar.study/logo-white.png',
        width: 800,
        height: 600,
      },
      {
        url: 'https://bookar.study/logo.png',
        width: 800,
        height: 600,
      },
    ],
    locale: 'pt-PT',
    type: 'website',
  }
  
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <AuthGuard>
              {children}
            </AuthGuard>
          </Providers>
        </ThemeProvider>
        <Toaster position='top-right' />
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID ?? ""} />
    </html>
  )
}
