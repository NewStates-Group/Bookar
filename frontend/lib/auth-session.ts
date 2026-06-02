import { getSession } from "next-auth/react";
import type { Session } from "next-auth";

/** Evita vários refresh em paralelo (race com rotação de refresh no backend). */
let sessionRefreshPromise: Promise<Session | null> | null = null;

function isSessionPayload(value: unknown): value is Session & { error?: string } {
  if (!value || typeof value !== "object") return false;
  return "user" in value || "accessToken" in value || "error" in value;
}

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
      const session = (await getSession()) as (Session & { error?: string }) | null;
      if (!isSessionPayload(session)) {
        return null;
      }
      if (!session.accessToken || session.error === "RefreshAccessTokenError") {
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
