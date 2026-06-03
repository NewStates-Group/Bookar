"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { BookarLoader } from "./BookarLoader";
import {
  isExplicadorRoomPath,
  savePendingExplicadorRoom,
  getPendingExplicadorRoom,
  clearPendingExplicadorRoom,
} from "@/lib/pending-explicador-room";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

/**
 * Module-level flag: once the session is authenticated, we never unmount
 * children again just because status briefly goes back to "loading" during
 * a session update() call. This ref persists across component re-renders
 * and even across hot-reloads in dev.
 */
let hasEverBeenAuthenticated = false;

export function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();

  const pathname = usePathname();
  const router = useRouter();

  const refreshAttempted = useRef(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isAppRoute = pathname.startsWith("/app");

  // Track when the session has been authenticated for the first time.
  if (status === "authenticated") {
    hasEverBeenAuthenticated = true;
  }

  /**
   * Fetch fresh session data once when entering a protected area.
   */
  useEffect(() => {
    if (!isAppRoute) return;
    if (!refreshAttempted.current) {
      refreshAttempted.current = true;
      update().catch(() => { /* non-critical */ });
    }
  }, [isAppRoute, update]);

  /**
   * Navigation rules
   */
  useEffect(() => {
    if (status === "loading") return;

    if (session?.error === "RefreshAccessTokenError") {
      if (typeof window !== "undefined" && isExplicadorRoomPath(pathname)) {
        savePendingExplicadorRoom(pathname + window.location.search);
      }
      signOut({ redirect: false });
      router.replace("/login");
      return;
    }

    if (isAppRoute && status === "unauthenticated") {
      if (typeof window !== "undefined" && isExplicadorRoomPath(pathname)) {
        savePendingExplicadorRoom(pathname + window.location.search);
      }
      router.replace("/login");
      return;
    }

    if (isPublicRoute && status === "authenticated") {
      const pending = getPendingExplicadorRoom();
      if (pending) {
        clearPendingExplicadorRoom();
        router.replace(pending.path);
      } else {
        router.replace("/app/courses");
      }
      return;
    }
  }, [pathname, router, session, status, isAppRoute, isPublicRoute]);

  /**
   * Show loader ONLY on the very first load before the session is known.
   * Once authenticated, never unmount children for intermediate loading states
   * (e.g. triggered by update() calls from child pages).
   */
  if (status === "loading" && !hasEverBeenAuthenticated) {
    return <BookarLoader />;
  }

  /**
   * Block render while redirecting unauthenticated users or on hard errors.
   */
  if (
    (isPublicRoute && status === "authenticated") ||
    (isAppRoute && status === "unauthenticated") ||
    (isAppRoute && session?.error === "RefreshAccessTokenError")
  ) {
    return <BookarLoader />;
  }

  return <>{children}</>;
}