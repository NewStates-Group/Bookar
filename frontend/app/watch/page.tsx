"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Quiz } from "@/components/Quiz";

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
    const searchParams = useSearchParams();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"video" | "quiz">("video");
    const [played, setPlayed] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter()

    const generateNextLesson = async () => {
        if (!lesson) return;
        setLoading(true);
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/mark-watched/${lesson.id}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
        } catch (e) {
            toast.error("Erro ao avançar");
            setLoading(false);
        }
    }

    const getLesson = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/get-lesson-data/${searchParams.get('l')}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setLesson(data);
                setLoading(false);
                setViewMode("video");
            } else {
                const errorData = await res.json();
                setError(errorData.message || "Erro ao carregar aula");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setError("Erro de conexão");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchParams.get('l')) {
            router.back()
            return
        }

        if (session?.accessToken) {
            getLesson();
        }
    }, [session, params]);

    // const stopPolling = () => {
    //     if (pollingRef.current) {
    //         clearInterval(pollingRef.current);
    //         pollingRef.current = null;
    //     }
    // };

    // const startPolling = () => {
    //     stopPolling();
    //     pollingRef.current = setInterval(fetchNextLesson, 5000); // Poll every 5s
    // };

    // const fetchNextLesson = async () => {
    //     try {
    //         const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/get-lesson/${params?.id}`, {
    //             headers: {
    //                 Authorization: `Bearer ${(session as any)?.accessToken}`,
    //             },
    //         });

    //         if (res.ok) {
    //             const data = await res.json();
    //             setLesson(data);
    //             setLoading(false);
    //             setViewMode("video"); // Reset to video for new lesson

    //             // If processing, polling!
    //             if (data.status === "PROCESSING" || data.status === "PENDING") {
    //                 if (!pollingRef.current) startPolling();
    //             } else {
    //                 stopPolling();
    //             }
    //         } else {
    //             const errorData = await res.json();
    //             // If 400 and message says "No more lessons", it's finished?
    //             // backend says: "Não há mais lições no curso"
    //             if (errorData.message?.includes("Não há mais")) {
    //                 setError("FINISHED");
    //                 setLoading(false);
    //                 stopPolling();
    //             } else {
    //                 setError(errorData.message || "Erro ao carregar aula");
    //                 setLoading(false);
    //             }
    //         }
    //     } catch (e) {
    //         console.error(e);
    //         setError("Erro de conexão");
    //         setLoading(false);
    //     }
    // };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-white/60 animate-pulse">Carregando sua aula...</p>
            </div>
        );
    }

    if (error || !lesson) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <p className="text-destructive mb-4">{error || "Aula não encontrada"}</p>
                <Button variant="outline" onClick={() => { router.back() }}>Voltar</Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            <div className="h-16 flex items-center px-4 border-b border-white/10 text-white">
                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-transparent" onClick={() => { router.back() }}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
                <span className="ml-4 font-medium text-lg truncate">{lesson.title}</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                {(lesson.status === "PROCESSING" || lesson.status === "PENDING") && (
                    <div className="text-center space-y-6 max-w-lg z-10">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-primary/30 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Criando sua aula com...</h2>
                            <p className="text-white/60">
                                Nossa IA está gerando o roteiro, a narração e as animações para este tópico.
                                Isso leva cerca de 2-3 minutos.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" className="bg-transparent border-white/20 text-white/60">
                            Verificar estado
                        </Button>
                    </div>
                )}

                {lesson.status === "READY" && viewMode === "video" && lesson.lesson_file && (
                    <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group">
                        <video
                            src={`http://localhost:8000/media/${lesson.lesson_file}`}
                            controls
                            className="w-full h-full"
                            onEnded={() => { }}
                            onPlay={() => { setPlayed(true) }}
                        />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-600/5 pointer-events-none"></div>
            </div>

            <div className="h-24 bg-zinc-950 border-t border-white/10 flex items-center justify-between px-8">
                <div className="text-white/50 text-sm hidden md:block">
                    {lesson.desc}
                </div>
                {/* {nextLesson === true && (
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => setViewMode("video")}>
                            Voltar ao Vídeo
                        </Button>
                    </div>
                )} */}
            </div>
        </div>
    );
}
