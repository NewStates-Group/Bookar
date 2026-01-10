"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    if (status === "loading") return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
            <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Carregando...</p>
            </div>
        </div>
    );

    return <>{children}</>;
}
