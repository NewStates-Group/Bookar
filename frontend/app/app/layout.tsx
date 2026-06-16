"use client";

import React, { useState, useEffect } from "react";
import { PlatformSidebar } from "@/components/platform-sidebar";
import { usePathname } from "next/navigation";
import { PanelLeft, Menu } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppFloatingMenu } from "@/components/AppFloatingMenu";

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

  // Load preferences from localStorage on mount and listen to navigation events
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("bookar-sidebar-open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }

    const handleOpenMobile = () => setIsMobileOpen(true);
    const handleToggleDesktop = () => {
      setIsSidebarOpen((prev) => {
        const nextState = !prev;
        localStorage.setItem("bookar-sidebar-open", String(nextState));
        return nextState;
      });
    };

    window.addEventListener("open-mobile-sidebar", handleOpenMobile);
    window.addEventListener("toggle-desktop-sidebar", handleToggleDesktop);
    return () => {
      window.removeEventListener("open-mobile-sidebar", handleOpenMobile);
      window.removeEventListener("toggle-desktop-sidebar", handleToggleDesktop);
    };
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem("bookar-sidebar-open", String(nextState));
  };

  const isExplicadorRoom = pathname.startsWith("/app/explicador/") && pathname !== "/app/explicador";
  const isWatchPage = pathname.startsWith("/app/courses/watch");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 text-slate-800 dark:text-neutral-100 antialiased">
      {/* Side Navigation Component */}
      <PlatformSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        isMobileOpen={isMobileOpen}
        closeMobile={() => setIsMobileOpen(false)}
      />

      {/* Mobile Sticky Navigation Header (Left-aligned Hamburger, Logo & Name) */}
      {!isExplicadorRoom && !isWatchPage && (
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 w-full h-14 px-4 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-neutral-800 shadow-sm select-none">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Logo" width={24} height={24} className="dark:invert"/>
            <span className="font-bold text-lg text-slate-800 dark:text-neutral-100 tracking-tight">Bookar</span>
          </div>
        </header>
      )}

      {/* Main Content Workspace Layout */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExplicadorRoom ? "h-screen overflow-hidden" : "min-h-screen"
        } ${
          mounted && isSidebarOpen ? "md:pl-[260px]" : "md:pl-[68px]"
        }`}
      >
        <main className={`w-full ${isExplicadorRoom ? "h-full py-0" : "py-4 md:py-6"}`}>
          {children}
        </main>
      </div>

      <AppFloatingMenu />
    </div>
  );
}
