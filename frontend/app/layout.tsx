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
  description: 'Aprenda utilizando IA',
  icons: {
    icon: "/logo-white.png",
  },
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
        <link rel="shortcut icon" href="/logo.png" type="image/x-icon" />
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
        <Toaster position='top-right' />
      </body>
    </html>
  )
}
