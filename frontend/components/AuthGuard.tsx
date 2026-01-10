"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (session?.error === "RefreshAccessTokenError") {
            signIn();
        }
    }, [session]);

    if (status === "loading") return null;

    return <>{children}</>;
}
