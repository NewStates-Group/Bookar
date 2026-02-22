"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, HelpCircle, X, Menu, ArrowLeft, Award, FileDown } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { CourseWatchSidebar } from "@/components/course-sidebar";
import Link from "next/link";
import { BuildingBlocksLoader } from "@/components/ui/building-blocks-loader";
import { QuizView } from "@/components/quiz-view";

export interface Module {
    id: number;
    name: string;
    lessons: Lesson[];
    quiz_id?: number;
    last_quiz_score?: number;
    last_quiz_passed?: boolean;
}

export interface CourseData {
    id: number;
    title: string;
    thumb: string;
    desc: string;
    modules: Module[];
    is_fully_completed: boolean;
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
    const quizID = searchParams.get('id');
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
    const [nextQuiz, setNextQuiz] = useState<{ id: number, moduleId: number } | null>(null)
    const [showNameModal, setShowNameModal] = useState(false);
    const [fullName, setFullName] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);


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
        if (lessonID === "quiz") {
            setLesson({ title: "Quiz do Módulo", desc: "Complete o quiz para avançar" } as Lesson); // Dummy lesson for title
            setViewMode("quiz");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lessonID}`, {
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

    const downloadCertificate = async (name?: string) => {
        setIsDownloading(true);
        try {
            const queryParams = name ? `?full_name=${encodeURIComponent(name)}` : '';
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}/certificate${queryParams}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Certificado_${course?.title || 'Curso'}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success("Certificado baixado com sucesso!");
                setShowNameModal(false);
            } else {
                const error = await res.json();
                toast.error(error.message || "Erro ao baixar certificado");
            }
        } catch (e) {
            toast.error("Erro ao baixar certificado");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCertificateClick = () => {
        // @ts-ignore
        const sessionName = session?.user?.name || (session as any)?.user?.full_name;

        if (sessionName) {
            downloadCertificate(sessionName);
        } else {
            setShowNameModal(true);
        }
    };

    const fetchLessonStatus = async (id: number) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${id}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                return data as Lesson;
            }
        } catch (e) {
            console.error("Failed to fetch lesson status", e);
        }
        return null;
    };

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

    }, [session, params, lessonID, quizID]);

    useEffect(() => {
        if (!lesson?.delivered && played) {
            markDelivered()
        }

        if (!lesson?.watched && ended) {
            markWatched()
        }
    }, [played, ended])

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (lesson && (lesson.status === "PROCESSING" || lesson.status === "PENDING")) {
            interval = setInterval(async () => {
                const updatedLesson = await fetchLessonStatus(lesson.id);
                if (updatedLesson && updatedLesson.status !== lesson.status) {
                    setLesson(updatedLesson);
                    fetchCourse(); // Refresh sidebar/course data
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [lesson?.id, lesson?.status]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (nextLesson && (nextLesson.status === "PROCESSING" || nextLesson.status === "PENDING")) {
            interval = setInterval(async () => {
                const updatedNextLesson = await fetchLessonStatus(nextLesson.id);
                if (updatedNextLesson && updatedNextLesson.status !== nextLesson.status) {
                    setNextLesson(updatedNextLesson);
                    fetchCourse(); // Refresh sidebar/course data
                }
            }, 5000); // Polling next lesson a bit slower
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [nextLesson?.id, nextLesson?.status]);

    useEffect(() => {
        if (course) {
            const allLessons = course.modules.flatMap(m => m.lessons);

            if (lessonID === 'quiz' && quizID) {
                // For quiz view, find the module by its ID (quizID now contains module.id)
                const moduleWithQuiz = course.modules.find(m => m.id.toString() === quizID);
                if (moduleWithQuiz) {
                    const lastLessonOfModule = moduleWithQuiz.lessons[moduleWithQuiz.lessons.length - 1];
                    if (lastLessonOfModule) {
                        const currentIndex = allLessons.findIndex(l => l.id === lastLessonOfModule.id);
                        setPreviousLesson(allLessons[currentIndex] || null);
                        setNextLesson(allLessons[currentIndex + 1] || null);
                        setNextQuiz(null); // No quiz after a quiz
                    }
                }
            } else if (lesson && lesson.id) {
                // For regular lesson view
                const currentIndex = allLessons.findIndex(l => l.id === lesson.id);
                if (currentIndex !== -1) {
                    setPreviousLesson(allLessons[currentIndex - 1] || null);

                    // Check if this is the last lesson of a module with a quiz
                    const currentModule = course.modules.find(m =>
                        m.lessons.some(l => l.id === lesson.id)
                    );

                    if (currentModule) {
                        const isLastLessonOfModule = currentModule.lessons[currentModule.lessons.length - 1]?.id === lesson.id;

                        if (isLastLessonOfModule && currentModule.quiz_id) {
                            // Next item is the module quiz
                            setNextQuiz({ id: currentModule.id, moduleId: currentModule.id });
                            setNextLesson(null);
                        } else {
                            // Next item is a regular lesson
                            setNextLesson(allLessons[currentIndex + 1] || null);
                            setNextQuiz(null);
                        }
                    }
                }
            }
        }
    }, [course, lesson, lessonID, quizID]);

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
                <div className="h-16 grid grid-cols-6 border-b border-border">
                    <button
                        onClick={() => router.push(`/app/courses/${course?.id}`)}
                        className="flex gap-1 items-center justify-center border-r cursor-pointer hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 " />
                        <span className="hidden md:block">
                            Voltar
                        </span>
                    </button>
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
                        onClick={() => {
                            if (nextQuiz) {
                                router.push(`/app/courses/watch?l=quiz&id=${nextQuiz.id}&c=${courseID}`)
                            } else if (nextLesson) {
                                router.push(`/app/courses/watch?l=${nextLesson.id}&c=${courseID}`)
                            }
                        }}
                        disabled={(!nextLesson && !nextQuiz) || (nextLesson?.status !== "READY" && !nextQuiz)}
                        className={`border-r flex gap-2 items-center justify-center hover:bg-muted transition-colors ${((!nextLesson && !nextQuiz) || (nextLesson?.status !== "READY" && !nextQuiz)) ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
                        <span className="hidden md:block">
                            {nextQuiz ? "Próximo Quiz" : "Próxima Aula"}
                        </span>
                        {nextLesson && (nextLesson.status === "PROCESSING" || nextLesson.status === "PENDING") ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>

                    <button className="flex gap-2 items-center cursor-pointer justify-center border-r hover:bg-muted transition-colors" onClick={() => setShowQuestionsModal(true)}>
                        <HelpCircle className="w-5 h-5" />
                        <span className="hidden md:block">
                            Dúvidas
                        </span>
                    </button>

                    {course?.is_fully_completed && (
                        <button
                            className="flex gap-2 items-center cursor-pointer justify-center bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 transition-colors px-4"
                            onClick={handleCertificateClick}
                            disabled={isDownloading}
                        >
                            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                            <span className="hidden lg:block font-bold">
                                Certificado
                            </span>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {viewMode === "quiz" && quizID ? (
                        <QuizView
                            quizId={parseInt(quizID)}
                            courseId={courseID as string}
                            onComplete={() => {
                                fetchCourse();
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4">
                            <div className="w-full max-w-5xl pb-2 border-b mb-4">
                                <h1 className="text-wrap font-semibold text-xl md:text-2xl lg:text-3xl truncate text-foreground" title={lesson?.title}>{lesson?.title}</h1>
                                <p className="text-foreground/70 leading-relaxed text-base md:text-lg">
                                    {lesson?.desc}
                                </p>
                            </div>
                            {(lesson?.status === "PROCESSING" || lesson?.status === "PENDING") && (
                                <div className="text-center space-y-6 max-w-lg z-10 py-10">
                                    <div className="mb-8">
                                        <BuildingBlocksLoader />
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
                                        onContextMenu={(e) => e.preventDefault()}
                                        controlsList="nodownload noplaybackrate"
                                        disablePictureInPicture
                                        onEnded={() => { setEnded(true) }}
                                        onPlay={() => { setPlayed(true) }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showQuestionsModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[110]">
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

            {showNameModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl max-w-md w-full mx-4 p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-cyan-500/10 p-2 rounded-lg">
                                    <Award className="w-6 h-6 text-cyan-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-foreground">Certificado</h2>
                            </div>
                            <button
                                onClick={() => setShowNameModal(false)}
                                className="text-foreground/40 hover:text-foreground hover:bg-muted p-1 rounded-full transition-colors"
                                disabled={isDownloading}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-foreground/70 mb-6 leading-relaxed">
                            Parabéns! Para gerar seu certificado, precisamos que confirme o seu <strong>nome completo</strong>.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="full-name" className="text-sm font-medium text-foreground/60 ml-1">Nome Completo</label>
                                <input
                                    id="full-name"
                                    type="text"
                                    placeholder="Seu nome para o certificado"
                                    autoFocus
                                    className="w-full bg-muted border border-border rounded-xl p-4 text-foreground placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-all font-medium"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && fullName.trim() && !isDownloading) {
                                            downloadCertificate(fullName);
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowNameModal(false)}
                                    className="flex-1 py-6 rounded-xl border-border hover:bg-muted font-semibold"
                                    disabled={isDownloading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={() => downloadCertificate(fullName)}
                                    className="flex-1 py-6 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-500/20"
                                    disabled={!fullName.trim() || isDownloading}
                                >
                                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileDown className="w-5 h-5 mr-2" />}
                                    Download PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
