import { getSession } from "next-auth/react";
import type { Session } from "next-auth";
import { authDebug } from "@/lib/auth-debug";

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
    authDebug("Refresh já em curso, a aguardar…");
    return sessionRefreshPromise;
  }

  sessionRefreshPromise = (async () => {
    try {
      authDebug("Token expirado ou sessão desatualizada, refrescando…");
      const session = (await getSession()) as (Session & { error?: string }) | null;
      if (!isSessionPayload(session)) {
        authDebug("Refresh terminou sem sessão válida.");
        return null;
      }
      if (!session.accessToken || session.error === "RefreshAccessTokenError") {
        authDebug("Refresh falhou: sem access token ou refresh inválido.");
        return null;
      }
      authDebug("Sessão atualizada com novo access token.");
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
