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
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google/callback`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id_token: code }),
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.detail || "Falha na troca do código Google");
                    }

                    const tokens = await res.json();

                    // Notify opener and close
                    if (window.opener) {
                        window.opener.postMessage({
                            type: "AUTH_SUCCESS",
                            access: tokens.access,
                            refresh: tokens.refresh
                        }, window.location.origin);
                        window.close();
                    } else {
                        // Fallback if not in a popup
                        await signIn("credentials", {
                            accessToken: tokens.access,
                            refreshToken: tokens.refresh,
                            callbackUrl: "/app/courses",
                        });
                    }
                } catch (error: any) {
                    console.error("Google Auth Error:", error);
                    if (window.opener) {
                        window.opener.postMessage({
                            type: "AUTH_ERROR",
                            message: error.message
                        }, window.location.origin);
                        window.close();
                    } else {
                        toast.error(error.message || "Erro ao processar login com Google");
                        router.push("/login?error=GoogleAuthFailed");
                    }
                }
            } else {
                if (window.opener) {
                    window.opener.postMessage({
                        type: "AUTH_ERROR",
                        message: "Código de autenticação ausente"
                    }, window.location.origin);
                    window.close();
                } else {
                    router.push("/login?error=MissingParams");
                }
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
