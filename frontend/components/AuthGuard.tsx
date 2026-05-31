"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isExplicadorRoomPath, savePendingExplicadorRoom } from "@/lib/pending-explicador-room";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAppRoute = pathname.startsWith("/app");

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated" || session?.error === "RefreshAccessTokenError") {
            if (isAppRoute) {
                if (typeof window !== "undefined" && isExplicadorRoomPath(pathname)) {
                    const pendingPath = pathname + window.location.search;
                    savePendingExplicadorRoom(pendingPath);
                }
                router.replace("/login");
            }
        } else if (status === "authenticated" && session?.user) {
            const user = session.user as any;
            const isProfileIncomplete = !user.first_name || !user.last_name;

            if (isProfileIncomplete && isAppRoute && pathname !== "/app/profile") {
                // console.log("[AuthGuard] Profile incomplete, redirecting to /app/profile");
                router.replace("/app/profile");
            }
        }
    }, [status, session, pathname, router, isAppRoute]);

    if (status === "loading" && isAppRoute && !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-medium">Verificando acesso...</p>
                </div>
            </div>
        );
    }

    // Don't render children for protected routes if unauthenticated to prevent flash
    if (status === "unauthenticated" && isAppRoute) {
        return null;
    }

    return <>{children}</>;
}
