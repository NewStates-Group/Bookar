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
import { useWebSocket } from "@/context/WebSocketContext";
import useSWR from 'swr';
import { authenticatedFetcher, apiRequest } from "@/lib/api";

export interface Module {
    id: string;
    name: string;
    lessons: Lesson[];
    quiz_id?: string;
    last_quiz_score?: number;
    last_quiz_passed?: boolean;
}

export interface CourseData {
    id: string;
    title: string;
    thumb: string;
    desc: string;
    modules: Module[];
    is_fully_completed: boolean;
    certificate_status: "NOT_GENERATED" | "PROCESSING" | "READY";
}

export interface Lesson {
    id: string;
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showQuestionsModal, setShowQuestionsModal] = useState(false);
    const [previousLesson, setPreviousLesson] = useState<Lesson | null>(null)
    const [nextLesson, setNextLesson] = useState<Lesson | null>(null)
    const [nextQuiz, setNextQuiz] = useState<{ id: string, moduleId: string } | null>(null)

    const { addListener } = useWebSocket();

    // SWR for Course Data
    const { data: swrCourse, mutate: mutateCourse } = useSWR(
        // @ts-ignore
        session?.accessToken && courseID ? [`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}`, session.accessToken] : null,
        authenticatedFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    // SWR for Lesson Data
    const { data: swrLesson, error: swrLessonError, mutate: mutateLesson } = useSWR(
        // @ts-ignore
        session?.accessToken && lessonID && lessonID !== "quiz" && lessonID !== "undefined" && lessonID !== "null" ? [`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lessonID}`, session.accessToken] : null,
        authenticatedFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    useEffect(() => {
        if (swrCourse) {
            setCourse(swrCourse);
            setLoading(false);
        }
    }, [swrCourse]);

    useEffect(() => {
        if (lessonID === "quiz") {
            setLesson({ title: "Quiz do Módulo", desc: "Complete o quiz para avançar" } as Lesson);
            setViewMode("quiz");
            setLoading(false);
            setError(null);
        } else if (swrLesson) {
            setLesson(swrLesson);
            setViewMode("video");
            setLoading(false);
            setError(null);
        }
    }, [swrLesson, lessonID]);

    useEffect(() => {
        if (swrLessonError) {
            // @ts-ignore
            if (swrLessonError.status === 404) {
                setError("Esta aula ainda não existe ou não tens acesso.");
            } else {
                setError(swrLessonError.message || "Erro ao carregar aula");
            }
            setLoading(false);
        }
    }, [swrLessonError]);

    useEffect(() => {
        const removeListener = addListener((data) => {
            if (data.type === "lesson_update" && String(data.id) === String(lessonID)) {
                if (data.status !== lesson?.status) {
                    mutateLesson();
                    mutateCourse();
                }
            }
        });

        return () => removeListener();
    }, [addListener, lessonID, lesson?.status, mutateLesson, mutateCourse]);


    const markDelivered = async () => {
        if (!lesson || lesson.delivered) return;
        try {
            await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lesson.id}/mark-delivered`, {
                method: "PUT",
            });
            mutateLesson();
        } catch (e) {
            console.error("Error marking lesson as delivered", e);
        }
    }

    const markWatched = async () => {
        if (!lesson || lesson.watched) return;
        try {
            await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lesson.id}/mark-watched`, {
                method: "PUT",
            });
            mutateLesson();
            mutateCourse(); // refresh sidebar progress bar
        } catch (e) {
            console.error("Error marking lesson as watched", e);
        }
    }

    useEffect(() => {
        if (!lessonID || !courseID || lessonID === "undefined" || courseID === "undefined" || lessonID === "null" || courseID === "null") {
            if (status !== "loading") {
                router.push('/app/courses')
            }
            return
        }
    }, [session, params, lessonID, quizID, status]);

    useEffect(() => {
        setPlayed(false);
        setEnded(false);
    }, [lessonID]);

    useEffect(() => {
        if (!lesson?.delivered && played) {
            markDelivered()
        }

        if (!lesson?.watched && ended) {
            markWatched()
        }
    }, [played, ended, lessonID])


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
        return null;
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
            <div className={`fixed min-h-screen z-[100] md:static transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[25rem]" : "w-0"} bg-card border-r border-border `}>
                {sidebarOpen && <CourseWatchSidebar course={course} currentLessonId={lesson?.id} isEnded={ended} onClose={() => setSidebarOpen(!sidebarOpen)} />}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="h-16 grid grid-cols-5 border-b border-border">
                    <button
                        onClick={() => {
                            if (course?.id) {
                                router.push(`/app/courses/${course.id}`);
                            } else if (courseID) {
                                router.push(`/app/courses/${courseID}`);
                            } else {
                                router.push('/app/courses');
                            }
                        }}
                        className="flex gap-1 items-center justify-center border-r cursor-pointer hover:bg-muted transition-colors px-4"
                    >
                        <ArrowLeft className="w-5 h-5 " />
                        <span className="hidden md:block ml-1">
                            Voltar
                        </span>
                    </button>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex gap-1 items-center justify-center border-r cursor-pointer hover:bg-muted transition-colors"
                    >
                        {sidebarOpen ? (
                            <>
                                <X className="w-5 h-5 text-foreground/70" />
                                <span className="hidden md:block">
                                    Fechar Menu
                                </span>
                            </>
                        ) : (
                            <>
                                <Menu className="w-5 h-5 text-foreground/70" />
                                <span className="hidden md:block">
                                    Abrir Menu
                                </span>
                            </>
                        )
                        }

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
                        disabled={(() => {
                            if (!nextLesson && !nextQuiz) return true;
                            if (nextLesson && nextLesson.status !== "READY") return true;
                            if (nextQuiz) {
                                const moduleOfQuiz = course?.modules.find(m => m.id === nextQuiz.moduleId);
                                const allWatched = moduleOfQuiz?.lessons.every(l =>
                                    l.watched || (l.id === lesson?.id && ended)
                                ) ?? false;
                                return !allWatched;
                            }
                            return false;
                        })()}
                        className={`border-r flex gap-2 items-center justify-center hover:bg-muted transition-colors ${(() => {
                            if (!nextLesson && !nextQuiz) return true;
                            if (nextLesson && nextLesson.status !== "READY") return true;
                            if (nextQuiz) {
                                const moduleOfQuiz = course?.modules.find(m => m.id === nextQuiz.moduleId);
                                const allWatched = moduleOfQuiz?.lessons.every(l =>
                                    l.watched || (l.id === lesson?.id && ended)
                                ) ?? false;
                                return !allWatched;
                            }
                            return false;
                        })() ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
                        <span className="hidden md:block">
                            {nextQuiz ? "Hora do Quiz" : "Próxima Aula"}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    <button className="flex gap-2 items-center cursor-pointer justify-center border-r hover:bg-muted transition-colors" onClick={() => setShowQuestionsModal(true)}>
                        <HelpCircle className="w-5 h-5" />
                        <span className="hidden md:block">
                            Dúvidas
                        </span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col">
                    <div className="flex-1">
                        {viewMode === "quiz" && quizID ? (
                            <QuizView
                                quizId={quizID}
                                courseId={courseID as string}
                                onComplete={() => {
                                    mutateCourse();
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
                                    <div className="text-center max-w-lg z-10 py-10">
                                        <BuildingBlocksLoader />
                                        <h2 className="text-2xl font-bold text-foreground mb-2">Criando sua aula</h2>
                                        <p className="text-foreground/60">
                                            Isto pode levar alguns segundos.
                                        </p>
                                    </div>
                                )}

                                {lesson?.status === "READY" && viewMode === "video" && lesson?.lesson_file && (
                                    <div className="w-full max-w-5xl aspect-video bg-card rounded-xl overflow-hidden shadow-2xl relative group border border-border">
                                        <video
                                            src={lesson.lesson_file.startsWith('http') ? lesson.lesson_file : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/media/${lesson.lesson_file}`}
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

                    <div className="pb-8 pt-4 px-4 flex justify-center">
                        <p className="text-xs text-foreground/40 text-center max-w-2xl">
                            O Bookar pode cometer erros. Considere verificar as informações importantes.
                        </p>
                    </div>
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

        </div>
    );
}
