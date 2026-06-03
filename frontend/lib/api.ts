import { signOut } from "next-auth/react";
import { ensureFreshSession } from "@/lib/auth-session";
import { authDebug } from "@/lib/auth-debug";

export const authenticatedFetcher = async ([url]: [string, string?]) => {
  return apiRequest(url);
};


export const apiRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  let session = await ensureFreshSession();

  if (!session?.accessToken) {
    authDebug("No valid session → signing out");
    await signOut({ callbackUrl: "/login" });
    throw new Error("Not authenticated");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${session.accessToken}`,
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    authDebug("401 received → forcing refresh + retry", { url });

    const refreshed = await ensureFreshSession();

    if (!refreshed?.accessToken) {
      authDebug("Refresh failed → logout");
      await signOut({ callbackUrl: "/login" });
      throw new Error("Session expired");
    }

    res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${refreshed.accessToken}`,
      },
    });
  }

  if (!res.ok) {
    const error = new Error("API Error") as Error & {
      status?: number;
      data?: any;
    };

    error.status = res.status;

    try {
      error.data = await res.json();
    } catch { }

    throw error;
  }

  return res.json();
};