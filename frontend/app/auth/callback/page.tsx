"use client";

import { useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function AuthCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const code = searchParams.get("code");
        const access = searchParams.get("access");
        const refresh = searchParams.get("refresh");

        const handleCallback = async () => {
            if (code) {
                try {
                    // 1. Exchange code for tokens via our backend
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google/callback`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id_token: code }), // We send 'code' in the 'id_token' field as per our Schema
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.detail || "Falha na troca do código Google");
                    }

                    const tokens = await res.json();

                    // 2. Sign in with the received tokens
                    const result = await signIn("credentials", {
                        username: "google-user", // Dummy, backend ignores it if tokens are present or we use a custom authorize
                        password: "google-password", // Dummy
                        accessToken: tokens.access,
                        refreshToken: tokens.refresh,
                        redirect: false,
                    });

                    if (result?.error) {
                        throw new Error(result.error);
                    }

                    router.push("/app/courses");
                } catch (error: any) {
                    console.error("Google Auth Error:", error);
                    toast.error(error.message || "Erro ao processar login com Google");
                    router.push("/login?error=GoogleAuthFailed");
                }
            } else if (access && refresh) {
                // Compatibility with old flow just in case
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
                router.push("/login?error=MissingParams");
            }
        };

        handleCallback();
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
