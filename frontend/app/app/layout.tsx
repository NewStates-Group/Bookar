"use client";

import React, { useState, useEffect } from "react";
import { PlatformSidebar } from "@/components/platform-sidebar";
import { usePathname } from "next/navigation";
import { PanelLeft, Menu } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("bookar-sidebar-open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem("bookar-sidebar-open", String(nextState));
  };

  // If the path is watch mode, render immersive full screen without navigation
  if (pathname === "/app/courses/watch") {
    return (
      <main className="min-h-screen bg-slate-50">
        {children}
      </main>
    );
  }

  const isExplicadorRoom = pathname.startsWith("/app/explicador/") && pathname !== "/app/explicador";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-800 antialiased">
      {/* Side Navigation Component */}
      <PlatformSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
      />

      {/* Mobile Sticky Navigation Header (Left-aligned Hamburger, Logo & Name) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 w-full h-14 px-4 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-sm select-none">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold text-lg text-slate-800 tracking-tight">Bookar</span>
        </div>
      </header>

      {/* Main Content Workspace Layout */}
      <div
        className={`transition-all duration-300 ease-in-out min-h-screen ${
          mounted && isSidebarOpen ? "md:pl-[260px]" : "md:pl-[68px]"
        }`}
      >
        <main className={`w-full ${isExplicadorRoom ? "py-0" : "py-4 md:py-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
