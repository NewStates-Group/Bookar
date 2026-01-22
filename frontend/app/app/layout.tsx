import { FloatingNavbar } from "@/components/floating-navbar"


export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <FloatingNavbar />
      {children}
    </main>
  )
}
