"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, HelpCircle, X, Menu } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { CourseWatchSidebar } from "@/components/course-sidebar";

export interface Module {
    id: number;
    name: string;
    lessons: Lesson[];
}

export interface CourseData {
    id: number;
    title: string;
    modules: Module[];
}

export interface Lesson {
    id: number;
    title: string;
    desc: string;
    lesson_file: string | null;
    delivered: boolean;
    watched: boolean;
    duration: number;
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
    narration: string;
}

export default function WatchPage() {
    const { data: session, status } = useSession();
    const router = useRouter()
    const params = useParams();
    const searchParams = useSearchParams();
    const courseID = searchParams.get('c');
    const lessonID = searchParams.get('l');
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [course, setCourse] = useState<CourseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"video" | "quiz">("video");
    const [played, setPlayed] = useState(false);
    const [ended, setEnded] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showQuestionsModal, setShowQuestionsModal] = useState(false);
    const [previousLesson, setPreviousLesson] = useState<Lesson | null>(null)
    const [nextLesson, setNextLesson] = useState<Lesson | null>(null)


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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lessonID}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.status === "READY") {
                    setLesson(data);
                    setLoading(false);
                    setViewMode("video");
                } else {
                    toast.info(
                        data.status === "PROCESSING" ? "Esta aula está a ser gerada" : "Esta aula ainda não foi gerada"
                    )
                    router.push('/app/courses/' + courseID)
                    return
                }
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}/get-next-lesson?current_lesson=${lesson?.watched ? lesson.id : 0}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.id) {
                    router.push(`/app/courses/watch?l=${data.id}&c=${courseID}`)
                } else {
                    router.push(`/app/courses/${courseID}`)
                }
            }
        } catch (error) {
            toast.error('Erro desconhecido, aguarde')
        }
    }

    const fetchCourse = async () => {
        // @ts-ignore
        if (!courseID || !session?.accessToken) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setCourse(data);

            }
        } catch (error) {
            console.error("Failed to fetch course", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!lessonID || !courseID) {
            router.back()
            return
        }
        // @ts-ignore
        if (session?.accessToken) {
            fetchCourse();
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

    useEffect(() => {
        if (!lesson) return
        const lessons: Lesson[] = []
        course?.modules.forEach(module => {
            module.lessons.forEach(lesson => {
                lessons.push(lesson)
            })
        });
        const index = lessons?.findIndex(l => l.id === lesson.id)

        setPreviousLesson(lessons[index - 1] ?? null)
        setNextLesson(lessons[index + 1] ?? null)
    }, [lesson])

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
                    if (courseID) {
                        router.push(`/app/courses/${courseID}`)
                    } else {
                        router.push(`/app`)
                    }
                }}>Voltar</Button>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <div className={`fixed min-h-screen z-[100] md:static transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-90" : "w-0"} bg-card border-r border-border `}>
                {sidebarOpen && <CourseWatchSidebar course={course} onClose={() => setSidebarOpen(!sidebarOpen)} />}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="h-16 grid grid-cols-4 border-b border-border">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex gap-1 items-center justify-center border-r cursor-pointer hover:bg-muted transition-colors"
                    >
                        {sidebarOpen ? <X className="w-5 h-5 text-foreground/70" /> : <Menu className="w-5 h-5 text-foreground/70" />}
                        <span className="hidden md:block">
                            Abrir Menu
                        </span>
                    </button>
                    <button
                        onClick={() => router.push(`/app/courses/watch?l=${previousLesson?.id}&c=${courseID}`)}

                        disabled={!previousLesson}
                        className={`border-r flex gap-2  items-center justify-center hover:bg-muted transition-colors ${!previousLesson ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden md:block">
                            Aula Anterior
                        </span>
                    </button>
                    <button
                        onClick={() => router.push(`/app/courses/watch?l=${nextLesson?.id}&c=${courseID}`)}
                        disabled={!nextLesson}
                        className={`border-r flex gap-2 items-center justify-center hover:bg-muted transition-colors ${!nextLesson ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
                        <span className="hidden md:block">
                            Próxima Aula
                        </span>
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="flex gap-2 items-center cursor-pointer justify-center hover:bg-muted transition-colors">
                        <Button variant="ghost" size="sm" className="text-foreground/70 hover:text-foreground hover:bg-muted" onClick={() => setShowQuestionsModal(true)}>
                            <HelpCircle className="w-5 h-5" />
                            <span className="hidden md:block">
                                Dúvidas
                            </span>
                        </Button>
                        {((ended && lesson?.watched) || lesson?.watched) && (
                            <Button
                                size="sm"
                                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={watchCourse}>
                                <span className="hidden md:block">
                                    Avançar
                                </span>
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="w-full max-w-5xl pb-2 border-b mb-4">
                            <span className="text-wrap font-semibold text-xl md:text-2xl lg:text-3xl truncate  text-foreground" title={lesson?.title}>{lesson?.title}</span>
                            <p className="text-foreground/70 leading-relaxed text-base md:text-lg">
                                {lesson?.desc}
                            </p>
                        </div>
                        {(lesson?.status === "PROCESSING" || lesson?.status === "PENDING") && (
                            <div className="text-center space-y-6 max-w-lg z-10">
                                <div className="relative w-24 h-24 mx-auto">
                                    <div className="absolute inset-0 border-4 border-primary/30 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-2">Criando sua aula com IA...</h2>
                                    <p className="text-foreground/60">
                                        Nossa IA está gerando o roteiro, a narração e as animações para este tópico.
                                        Isso leva cerca de 2-3 minutos.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" className="bg-transparent border-border text-foreground/60">
                                    Verificar estado
                                </Button>
                            </div>
                        )}

                        {lesson?.status === "READY" && viewMode === "video" && lesson?.lesson_file && (
                            <div className="w-full max-w-5xl aspect-video bg-card rounded-xl overflow-hidden shadow-2xl relative group border border-border">
                                <video
                                    src={`http://localhost:8000/media/${lesson.lesson_file}`}
                                    controls
                                    className="w-full h-full"
                                    onEnded={() => { setEnded(true) }}
                                    onPlay={() => { setPlayed(true) }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showQuestionsModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg max-w-md w-full mx-4 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Dúvidas sobre a aula?</h2>
                            <button onClick={() => setShowQuestionsModal(false)} className="text-foreground/50 hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-foreground/60 mb-4">
                            Descreva sua dúvida e nossos instrutores responderão em breve.
                        </p>
                        <textarea
                            placeholder="Digite sua dúvida aqui..."
                            className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-foreground/40 focus:outline-none focus:border-primary focus:bg-muted/80 mb-4 resize-none"
                            rows={4}
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowQuestionsModal(false)} className="flex-1">
                                Cancelar
                            </Button>
                            <Button onClick={() => { setShowQuestionsModal(false); toast.success("Dúvida enviada com sucesso!"); }} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                                Enviar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
