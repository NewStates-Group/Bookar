import { getSession } from "next-auth/react";
import type { Session } from "next-auth";

let sessionRefreshPromise: Promise<Session | null> | null = null;

function isSessionPayload(
  value: unknown
): value is Session & { error?: string } {
  if (!value || typeof value !== "object") return false;
  return "accessToken" in value || "error" in value;
}

export async function ensureFreshSession(): Promise<Session | null> {
  if (sessionRefreshPromise) {
    return sessionRefreshPromise;
  }

  sessionRefreshPromise = (async () => {
    try {
      const session = (await getSession()) as
        | (Session & { error?: string })
        | null;

      if (!isSessionPayload(session)) {
        return null;
      }

      if (!session.accessToken) {
        return null;
      }

      if (session.error === "RefreshAccessTokenError") {
        return null;
      }

      return session;
    } catch (err) {

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
  const now = Date.now();

  const expired =
    !accessTokenExpires || now >= accessTokenExpires - skewMs;

  return expired;
}