"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Quiz } from "@/components/Quiz";

interface Lesson {
    id: number;
    title: string;
    desc: string;
    lesson_file: string | null;
    delivered: boolean;
    watched: boolean;
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
    narration: string;
}

export default function LearnPage() {
    const { data: session, status } = useSession();
    const params = useParams();
    const searchParams = useSearchParams();
    const course = searchParams.get('c');
    const l = searchParams.get('l');
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"video" | "quiz">("video");
    const [played, setPlayed] = useState(false);
    const [ended, setEnded] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter()

    const markDelivered = async () => {
        if (!lesson) return;
        if (!lesson.delivered) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lesson.id}/mark-delivered`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            lesson.delivered = true
        }
    }

    const markWatched = async () => {
        if (!lesson) return;
        if (!lesson.watched) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lesson.id}/mark-watched`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            lesson.watched = true
        }
    }

    const getLesson = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${searchParams.get('l')}`, {
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

    const watchCourse = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course}/get-next-lesson?current_lesson=${lesson?.watched ? lesson.id : 0}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.id) {
                    router.push(`/watch?l=${data.id}&c=${course}`)
                } else {
                    router.push(`/courses/${course}`)
                }
            }
        } catch (error) {
            toast.error('Erro desconhecido, aguarde')
        }
    }

    useEffect(() => {
        if (!searchParams.get('l') || !course) {
            router.back()
            return
        }

        if (session?.accessToken) {
            getLesson();
        }

    }, [session, params]);

    useEffect(() => {
        if (!lesson?.delivered && played) {
            markDelivered()
        }

        if (!lesson?.watched && ended) {
            markWatched()
        }
    }, [played, ended])

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
                <Button variant="outline" onClick={() => {
                    if (course) {
                        router.push(`/courses/${c}`)
                    } else {
                        router.push(`/overview`)
                    }
                }}>Voltar</Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col" key={`${l}-${course}`}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 text-white">
                <div className="flex gap-1 items-center">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-transparent" onClick={() => { router.back() }}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        <span className="hidden md:block">
                            Voltar
                        </span>
                    </Button>
                    <span className="ml-4 font-medium text-lg truncate max-w-2xs sm:max-w-xl" title={lesson.title}>{lesson.title}</span>
                </div>
                <div className="flex md:gap-2 items-center">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-transparent" onClick={() => { toast.info("Em desenvolvimento...") }}>
                        <Sparkles className="w-5 h-5" />
                        <span className="hidden md:block">
                            Dúvidas sobre a aula?
                        </span>
                    </Button>
                    {((ended && lesson.watched) || lesson.watched) && (
                        <div className="flex gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="p-0 text-white/70 hover:text-white hover:bg-transparent"
                                onClick={watchCourse}>
                                <span className="hidden md:block">
                                    Próxima aula
                                </span>
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 relative">
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
                            onEnded={() => { setEnded(true) }}
                            onPlay={() => { setPlayed(true) }}
                        />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-600/5 pointer-events-none"></div>
            </div>

            <div className="bg-zinc-950 border-t border-white/10 flex items-start justify-between px-8 py-5 gap-2">
                <div className="text-white/50 text-base block">
                    {lesson.desc}
                </div>
            </div>
        </div>
    );
}
