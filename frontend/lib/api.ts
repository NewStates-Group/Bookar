import { getSession, signOut } from "next-auth/react";

/**
 * Enhanced fetcher for SWR that handles intermittent 401 errors
 */
export const authenticatedFetcher = async (args: [string, string]) => {
    const [url, token] = args;
    return apiRequest(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
};

/**
 * Force NextAuth to re-evaluate the JWT callback (which triggers refresh if expired).
 * Returns the refreshed session or null.
 */
async function forceSessionRefresh() {
    try {
        // This hits the server-side session endpoint which triggers the jwt callback
        const res = await fetch("/api/auth/session");
        if (res.ok) {
            const session = await res.json();
            if (session?.accessToken && !session?.error) {
                return session;
            }
        }
    } catch (e) {
        console.warn("[API] Force session refresh failed", e);
    }
    return null;
}

/**
 * Generic authenticated request helper with built-in 401 retry + auto-refresh
 */
export const apiRequest = async (url: string, options: RequestInit = {}) => {
    let session = await getSession();
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    } as any;

    if (session?.accessToken && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
    }

    let res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        // Force a real server-side token refresh
        const refreshedSession = await forceSessionRefresh();

        if (refreshedSession?.accessToken) {
            res = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    Authorization: `Bearer ${refreshedSession.accessToken}`,
                },
            });
        }

        // If still 401, the refresh token is dead — sign out
        if (res.status === 401) {
            await signOut({ callbackUrl: "/login" });
            throw new Error("Sessão expirada. Por favor, faça login novamente.");
        }
    }

    if (!res.ok) {
        const error = new Error('Erro na requisição');
        // @ts-ignore
        error.status = res.status;
        try {
            const data = await res.json();
            // @ts-ignore
            error.message = data.message || data.detail || error.message;
        } catch (e) { /* ignore */ }
        throw error;
    }

    return res.json();
};
