"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isExplicadorRoomPath, savePendingExplicadorRoom } from "@/lib/pending-explicador-room";
import { ensureFreshSession } from "@/lib/auth-session";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sessionCheckDone, setSessionCheckDone] = useState(false);
  const refreshAttempted = useRef(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAppRoute = pathname.startsWith("/app");

  useEffect(() => {
    if (!isAppRoute) {
      setSessionCheckDone(true);
      return;
    }

    let cancelled = false;

    (async () => {
      if (!refreshAttempted.current) {
        refreshAttempted.current = true;
        await ensureFreshSession();
        await update();
      }
      if (!cancelled) {
        setSessionCheckDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAppRoute, update]);

  useEffect(() => {
    if (!sessionCheckDone || status === "loading") return;

    if (status === "unauthenticated" || session?.error === "RefreshAccessTokenError") {
      if (isAppRoute) {
        if (typeof window !== "undefined" && isExplicadorRoomPath(pathname)) {
          const pendingPath = pathname + window.location.search;
          savePendingExplicadorRoom(pendingPath);
        }
        router.replace("/login");
      }
    } else if (status === "authenticated" && session?.user) {
      const user = session.user as { first_name?: string; last_name?: string };
      const isProfileIncomplete = !user.first_name || !user.last_name;

      if (isProfileIncomplete && isAppRoute && pathname !== "/app/profile") {
        router.replace("/app/profile");
      }
    }
  }, [status, session, pathname, router, isAppRoute, sessionCheckDone]);

  const showLoader =
    isAppRoute &&
    (!sessionCheckDone || (status === "loading" && !session?.accessToken));

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-medium">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (
    sessionCheckDone &&
    (status === "unauthenticated" || session?.error === "RefreshAccessTokenError") &&
    isAppRoute
  ) {
    return null;
  }

  return <>{children}</>;
}
