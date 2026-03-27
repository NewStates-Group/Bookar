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
 * Generic authenticated request helper with built-in 401 retry logic
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

    let res = await fetch(url, { ...options, headers, credentials: "include" });

    if (res.status === 401) {
        console.warn(`[API] 401 detected for ${url}. Attempting session refresh and retry...`);

        // Force a session refresh
        session = await getSession();

        if (session?.accessToken) {
            console.log(`[API] Retrying with new token...`);
            res = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    Authorization: `Bearer ${session.accessToken}`,
                },
                credentials: "include",
            });
        }

        if (res.status === 401) {
            console.error("[API] Persistent 401. User might need to login again.");
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
