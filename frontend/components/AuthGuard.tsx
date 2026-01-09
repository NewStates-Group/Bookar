"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            signOut({ callbackUrl: "/login" });
        }
    }, [session]);

    if (status === "loading") return null;

    return <>{children}</>;
}
