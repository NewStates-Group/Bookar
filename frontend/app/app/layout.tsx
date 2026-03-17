"use client";
import React from "react";

import { FloatingNavbar } from "@/components/floating-navbar"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useSession } from "next-auth/react"


export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log("[AppLayout] session status:", status, "pathname:", pathname);

    if (status === "unauthenticated" || session?.error === "RefreshAccessTokenError") {
      console.log("[AppLayout] Unauthenticated or RefreshError, redirecting to /login");
      router.push("/login");
    } else if (status === "authenticated" && session?.user) {
      const user = session.user as any;
      const isProfileIncomplete = !user.first_name || !user.last_name;
      console.log("[AppLayout] Authenticated. User:", user.email, "Incomplete profile:", isProfileIncomplete);

      if (isProfileIncomplete && pathname !== "/app/profile") {
        console.log("[AppLayout] Profile incomplete, redirecting to /app/profile");
        router.push("/app/profile");
      }
    }
  }, [session, status, pathname, router]);

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
