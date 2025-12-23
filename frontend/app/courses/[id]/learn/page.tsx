"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

interface Lesson {
    id: number;
    title: string;
    desc: string;
    lesson_file: string | null;
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
    narration: string;
}

export default function LearnPage() {
    const { data: session, status } = useSession();
    const params = useParams();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (session?.accessToken && params?.id) {
            fetchNextLesson();
        }
        return () => stopPolling();
    }, [session, params]);

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const startPolling = () => {
        stopPolling();
        pollingRef.current = setInterval(fetchNextLesson, 5000); // Poll every 5s
    };

    const fetchNextLesson = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/get_lesson?course_id=${params?.id}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setLesson(data);
                setLoading(false);

                // If processing, polling!
                if (data.status === "PROCESSING" || data.status === "PENDING") {
                    if (!pollingRef.current) startPolling();
                } else {
                    stopPolling();
                }
            } else {
                const errorData = await res.json();
                // If 400 and message says "No more lessons", it's finished?
                // backend says: "Não há mais lições no curso"
                if (errorData.message?.includes("Não há mais")) {
                    setError("FINISHED");
                    setLoading(false);
                    stopPolling();
                } else {
                    setError(errorData.message || "Erro ao carregar aula");
                    setLoading(false);
                }
            }
        } catch (e) {
            console.error(e);
            setError("Erro de conexão");
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (!lesson) return;
        setLoading(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/mark_watched?lesson_id=${lesson.id}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            // Fetch next
            await fetchNextLesson();
        } catch (e) {
            toast.error("Erro ao avançar");
            setLoading(false);
        }
    }

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-white/60 animate-pulse">Carregando sua aula...</p>
            </div>
        );
    }

    if (error === "FINISHED") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                    <MonitorPlay className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Parabéns!</h1>
                <p className="text-muted-foreground max-w-md mb-8">
                    Você completou todas as aulas disponíveis neste curso.
                </p>
                <Link href="/dashboard">
                    <Button size="lg">Voltar para Dashboard</Button>
                </Link>
            </div>
        )
    }

    if (error || !lesson) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <p className="text-destructive mb-4">{error || "Aula não encontrada"}</p>
                <Link href="/dashboard"><Button variant="outline">Voltar</Button></Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="h-16 flex items-center px-4 border-b border-white/10 text-white">
                <Link href={`/courses/${params?.id}`}>
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                </Link>
                <span className="ml-4 font-medium text-lg truncate">{lesson.title}</span>
            </div>

            {/* Main Player Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative">

                {/* PROCESSING STATE */}
                {(lesson.status === "PROCESSING" || lesson.status === "PENDING") && (
                    <div className="text-center space-y-6 max-w-lg z-10">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-primary/30 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-white opacity-50" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Criando sua aula com IA...</h2>
                            <p className="text-white/60">
                                Nossa IA está gerando o roteiro, a narração e as animações para este tópico.
                                Isso leva cerca de 2-3 minutos.
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 text-sm text-white/50">
                            Status: <span className="text-primary font-mono uppercase">{lesson.status}</span>
                        </div>
                        {/* Fallback button if stuck */}
                        <Button variant="outline" size="sm" onClick={() => fetchNextLesson()} className="bg-transparent border-white/20 text-white/60">
                            Atualizar Status
                        </Button>
                    </div>
                )}

                {/* READY STATE */}
                {lesson.status === "READY" && lesson.lesson_file && (
                    <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group">
                        <video
                            src={`https://d4uonx-ip-154-71-152-134.tunnelmole.net/media/${lesson.lesson_file}`}
                            controls
                            className="w-full h-full"
                            autoPlay
                        />
                    </div>
                )}

                {/* Background Ambience */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-600/5 pointer-events-none"></div>
            </div>

            {/* Footer / Controls */}
            <div className="h-24 bg-zinc-950 border-t border-white/10 flex items-center justify-between px-8">
                <div className="text-white/50 text-sm hidden md:block">
                    {lesson.desc.substring(0, 100)}...
                </div>
                {lesson.status === "READY" && (
                    <div className="flex gap-4">
                        <Button size="lg" className="rounded-full px-8" onClick={handleNext}>
                            Próxima Aula <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
