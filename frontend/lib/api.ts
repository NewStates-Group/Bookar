import { getSession, signOut } from "next-auth/react";
import { ensureFreshSession } from "@/lib/auth-session";
import { authDebug } from "@/lib/auth-debug";

/**
 * Enhanced fetcher for SWR that handles intermittent 401 errors
 */
export const authenticatedFetcher = async (args: [string, string]) => {
  const [url, token] = args;
  return apiRequest(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

/**
 * Generic authenticated request helper with built-in 401 retry + auto-refresh
 */
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  let session = await getSession();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  } as Record<string, string>;

  if (session?.accessToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    authDebug("API 401: token expirado, refrescando…", { url });
    const refreshedSession = await ensureFreshSession();

    if (refreshedSession?.accessToken) {
      authDebug("Pedido API a repetir com token renovado.", { url });
      res = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          Authorization: `Bearer ${refreshedSession.accessToken}`,
        },
      });
    }

    if (res.status === 401) {
      authDebug("Refresh não resolveu o 401, a terminar sessão.");
      await signOut({ callbackUrl: "/login" });
      throw new Error("Sessão expirada. Por favor, faça login novamente.");
    }
  }

  if (!res.ok) {
    const error = new Error("Erro na requisição");
    // @ts-ignore
    error.status = res.status;
    try {
      const data = await res.json();
      // @ts-ignore
      error.message = data.message || data.detail || error.message;
    } catch {
      /* ignore */
    }
    throw error;
  }

  return res.json();
};
