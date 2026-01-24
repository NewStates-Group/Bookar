"use client";

import { FloatingNavbar } from "@/components/floating-navbar"
import { usePathname } from "next/navigation"


export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {
        !(pathname === "/app/courses/watch") ? (
        <FloatingNavbar />
        ) : ("")
      }
      {children}
    </main>
  )
}
