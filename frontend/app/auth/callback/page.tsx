"use client";

import { useEffect, Suspense, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clearPendingExplicadorRoom, getPendingExplicadorRoom } from "@/lib/pending-explicador-room";

function AuthCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const called = useRef(false);

    useEffect(() => {
        const code = searchParams.get("code");

        if (called.current) return;

        const handleCallback = async () => {
            if (code) {
                called.current = true;
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

                    const pendingRoom = getPendingExplicadorRoom();
                    const path = pendingRoom?.path || "/app/courses";

                    const result = await signIn("credentials", {
                        accessToken: tokens.access,
                        refreshToken: tokens.refresh,
                        redirect: false,
                    });

                    if (result?.ok) {
                        if (pendingRoom) {
                            clearPendingExplicadorRoom();
                        }
                        router.replace(path);
                    } else {
                        router.replace(`/login?error=${result?.error}`);
                    }
                } catch (error: any) {
                    toast.error(error.message || "Erro ao processar login com Google");
                    router.replace("/login?error=GoogleAuthFailed");
                }
            } else {
                router.replace("/login?error=MissingParams");
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
