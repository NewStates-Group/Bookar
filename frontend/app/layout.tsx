import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { AuthGuard } from '@/components/AuthGuard'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Bookar',
  description: 'Aprenda utilizando IA',

}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-PT">
      <body className={`font-sans antialiased`}>
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
