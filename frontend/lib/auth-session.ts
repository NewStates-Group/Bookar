import type { Session } from "next-auth";

/** Evita vários refresh em paralelo (race com rotação de refresh no backend). */
let sessionRefreshPromise: Promise<Session | null> | null = null;

/**
 * Obtém a sessão via NextAuth, disparando o callback JWT no servidor
 * (renova access token se expirado e ainda houver refresh válido).
 */
export async function ensureFreshSession(): Promise<Session | null> {
  if (sessionRefreshPromise) {
    return sessionRefreshPromise;
  }

  sessionRefreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      const session = (await res.json()) as Session & { error?: string };
      if (!session?.accessToken || session.error === "RefreshAccessTokenError") {
        return null;
      }
      return session;
    } catch {
      return null;
    } finally {
      sessionRefreshPromise = null;
    }
  })();

  return sessionRefreshPromise;
}

export function isAccessTokenExpired(
  accessTokenExpires?: number | null,
  skewMs = 2 * 60 * 1000
): boolean {
  if (!accessTokenExpires) return true;
  return Date.now() >= accessTokenExpires - skewMs;
}
