"use client";

import { useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function AuthCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const access = searchParams.get("access");
        const refresh = searchParams.get("refresh");

        if (access && refresh) {
            // Use the credentials provider to complete the session with backend tokens
            signIn("credentials", {
                accessToken: access,
                refreshToken: refresh,
                redirect: false,
            }).then((result) => {
                if (result?.error) {
                    router.push(`/login?error=${encodeURIComponent(result.error)}`);
                } else {
                    router.push("/app/courses");
                }
            });
        } else {
            router.push("/login?error=MissingTokens");
        }
    }, [searchParams, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            <p className="text-muted-foreground animate-pulse">Autenticando...</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                <p className="text-muted-foreground">Carregando...</p>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
