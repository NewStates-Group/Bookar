"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Share2, LogIn } from "lucide-react";
import { toast } from "sonner";
import React from "react";

interface ShareInfo {
    token: string;
    course_id: string;
    course_title: string;
    sharer_name: string;
}

export default function ShareLandingPage() {
    const { token } = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated" && token) {
            localStorage.setItem("pending_share_token", token as string);
        }
    }, [status, token]);

    useEffect(() => {
        const fetchShareInfo = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/share/${token}`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    setShareInfo(data);
                } else {
                    toast.error("Link de partilha inválido ou expirado.");
                    router.push("/");
                }
            } catch (error) {
                console.error("Error fetching share info:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (token) {
            fetchShareInfo();
        }
    }, [token, router]);

    useEffect(() => {
        const claimCourse = async () => {
            if (status === "authenticated" && shareInfo && !isClaiming) {
                setIsClaiming(true);
                try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/share/${token}/claim`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${(session as any)?.accessToken}`,
                        },
                        credentials: "include",
                    });

                    if (res.ok) {
                        const data = await res.json();
                        toast.success(data.message || "Curso importado com sucesso!");
                        router.push(`/app/courses/${data.course_id}`);
                    } else {
                        const err = await res.json();
                        toast.error(err.message || "Erro ao importar curso.");
                        router.push("/app/courses");
                    }
                } catch (error) {
                    toast.error("Erro de conexão ao importar curso.");
                } finally {
                    setIsClaiming(false);
                }
            }
        };

        if (status === "authenticated" && shareInfo) {
            claimCourse();
        }
    }, [status, shareInfo, token, session, router, isClaiming]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-4" />
                <p className="text-muted-foreground">Carregando informações do curso...</p>
            </div>
        );
    }

    if (!shareInfo) return null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="p-4 bg-cyan-500 rounded-2xl shadow-lg animate-bounce">
                        <Share2 className="w-12 h-12 text-white" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">Convite Especial</h1>
                    <p className="text-muted-foreground">
                        <span className="font-bold text-foreground">{shareInfo.sharer_name}</span> partilhou um curso contigo!
                    </p>
                </div>

                <Card className="border-2 border-cyan-500/20 shadow-xl overflow-hidden">
                    <CardHeader className="bg-cyan-500/5 pb-8">
                        <CardTitle className="text-2xl capitalize">{shareInfo.course_title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-8">
                        {status === "authenticated" ? (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                                <p className="font-medium">Importando curso para a sua conta...</p>
                            </div>
                        ) : (
                            <p className="text-sm text-balance">
                                Cria uma conta ou faz login para importar este curso automaticamente e começar a aprender agora mesmo.
                            </p>
                        )}
                    </CardContent>
                    {status !== "authenticated" && (
                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                className="w-full bg-cyan-500 hover:bg-cyan-600 rounded-full h-12 text-lg font-bold"
                                onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
                            >
                                <LogIn className="w-5 h-5 mr-2" />
                                Login para Importar
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
