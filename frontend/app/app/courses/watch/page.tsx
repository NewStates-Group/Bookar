"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight, HelpCircle, X, Menu, ArrowLeft, Award, FileDown, FileText, ExternalLink, BookOpen, GripVertical } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { ExplicadorPromptDialog } from "@/components/ExplicadorPromptDialog";
import { buildExplicadorCourseContext } from "@/lib/explicador-course-context";
import { toast } from "sonner";
import { CourseWatchSidebar } from "@/components/course-sidebar";
import Link from "next/link";
import { BuildingBlocksLoader } from "@/components/ui/building-blocks-loader";
import { QuizView } from "@/components/quiz-view";
import { useWebSocket } from "@/context/WebSocketContext";
import useSWR from 'swr';
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

export interface Module {
    id: string;
    name: string;
    lessons: Lesson[];
    quiz_id?: string;
    last_quiz_score?: number;
    last_quiz_passed?: boolean;
    material_status?: string;
    material_pdf_url?: string;
    material_content?: string;
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

// Helper to match rehype-slug / github-slugger behavior
function slugify(text: string) {
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD') // handle accents
        .replace(/[\u0300-\u036f]/g, '') // remove accent marks
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
    const [explicadorOpen, setExplicadorOpen] = useState(false);
    const [previousLesson, setPreviousLesson] = useState<Lesson | null>(null)
    const [nextLesson, setNextLesson] = useState<Lesson | null>(null)
    const [nextQuiz, setNextQuiz] = useState<{ id: string, moduleId: string } | null>(null)
    const [materialSidebarOpen, setMaterialSidebarOpen] = useState(false);
    const [activeMaterialContent, setActiveMaterialContent] = useState<string | null>(null);

    // Sidebar Resizing State
    const [sidebarWidth, setSidebarWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const materialContentRef = useRef<HTMLDivElement>(null);

    const { addListener } = useWebSocket();

    // SWR for Course Data
    const { data: swrCourse, mutate: mutateCourse, isLoading: isLoadingCourse } = useSWR(
        // @ts-ignore
        session?.accessToken && courseID ? [`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseID}`, session.accessToken] : null,
        authenticatedFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
            errorRetryCount: 3
        }
    );

    // SWR for Lesson Data
    const { data: swrLesson, error: swrLessonError, mutate: mutateLesson, isLoading: isLoadingLesson } = useSWR(
        // @ts-ignore
        session?.accessToken && lessonID && lessonID !== "quiz" && lessonID !== "undefined" && lessonID !== "null" ? [`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lessonID}`, session.accessToken] : null,
        authenticatedFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
            errorRetryCount: 3
        }
    );

    useEffect(() => {
        if (swrCourse) {
            setCourse(swrCourse);
        }
    }, [swrCourse]);

    useEffect(() => {
        if (lessonID === "quiz") {
            setLesson({ title: "Quiz do Módulo", desc: "Complete o quiz para avançar" } as Lesson);
            setViewMode("quiz");
            setError(null);
        } else if (swrLesson) {
            setLesson(swrLesson);
            setViewMode("video");
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
        }
    }, [swrLessonError]);

    useEffect(() => {
        const removeListener = addListener((data) => {
            if (data.type === "lesson_update" || data.type === "material_update") {
                // Refresh course data for ANY lesson or material update
                mutateCourse();
                if (data.type === "lesson_update" && String(data.id) === String(lessonID)) {
                    mutateLesson();
                }
            }
        });

        return () => removeListener();
    }, [addListener, lessonID, mutateLesson, mutateCourse]);


    const markDelivered = async () => {
        if (!lesson || lesson.delivered) return;
        try {
            await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/lessons/${lesson.id}/mark-delivered`, {
                method: "PUT",
            });
            mutateLesson();
        } catch (e) {
            // console.error("Error marking lesson as delivered", e);
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
            // console.error("Error marking lesson as watched", e);
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

    const explicadorCourseContext = useMemo(() => {
        if (!course || !courseID) return null;

        if (lessonID === "quiz" && quizID) {
            const moduleWithQuiz = course.modules.find((m) => m.id.toString() === quizID);
            if (!moduleWithQuiz) return null;
            return buildExplicadorCourseContext({
                courseId: courseID,
                courseTitle: course.title,
                moduleName: moduleWithQuiz.name,
                lessonTitle: `Quiz: ${moduleWithQuiz.name}`,
            });
        }

        if (!lesson?.id) return null;
        const currentModule = course.modules.find((m) =>
            m.lessons.some((l) => l.id === lesson.id)
        );
        return buildExplicadorCourseContext({
            courseId: courseID,
            courseTitle: course.title,
            moduleName: currentModule?.name,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonDescription: lesson.desc,
            narration: lesson.narration,
        });
    }, [course, courseID, lesson, lessonID, quizID]);

    // Resizing Logic
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - e.clientX;
            // Constraints: Min 300px, Max 80% of window
            if (newWidth >= 300 && newWidth <= window.innerWidth * 0.8) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'default';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Automatic Scrolling Logic
    useEffect(() => {
        if (materialSidebarOpen && lesson?.title && activeMaterialContent) {
            // Wait slightly longer for Markdown to fully render and IDs to be available
            const timer = setTimeout(() => {
                const targetId = slugify(lesson.title);
                const element = document.getElementById(targetId);

                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    // Try a fallback: search for h2 that contains the title
                    const headings = document.querySelectorAll('h2');
                    for (const h of Array.from(headings)) {
                        if (h.textContent?.toLowerCase().includes(lesson.title.toLowerCase())) {
                            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            break;
                        }
                    }
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [materialSidebarOpen, lesson?.title, activeMaterialContent]);

    const canGoNext = (() => {
        if (nextQuiz) return true; // backend controla
        if (nextLesson) return lesson?.watched;
        return false;
    })();

    if (status === "loading" || isLoadingCourse || isLoadingLesson) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-medium">Carregando as informações da aula...</p>
                </div>
            </div>
        );
    }

    if (!course) return null;
    if (!lesson && lessonID !== "quiz") return null;

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <p className="text-destructive mb-4">{error || "Aula não encontrada"}</p>
                <Button asChild className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-8" variant="default" size="lg">
                    <Link href={`/app/courses/${courseID}`}>Retornar ao Curso</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            <div className={`fixed min-h-screen z-[100] md:static transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[25rem]" : "w-0"} bg-card border-r border-border `}>
                {sidebarOpen && <CourseWatchSidebar course={course} currentLessonId={lesson?.id} isEnded={ended} onClose={() => setSidebarOpen(!sidebarOpen)} />}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="h-16 grid grid-cols-5 border-b border-border">
                    <Link
                        href={`/app/courses/${courseID}`}
                        className="flex gap-1 items-center justify-center border-r cursor-pointer hover:bg-muted transition-colors px-4"
                    >
                        <ArrowLeft className="w-5 h-5 " />
                        <span className="hidden md:block ml-1">
                            Voltar
                        </span>
                    </Link>
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
                        disabled={!previousLesson}
                        className={`border-r flex gap-2 items-center justify-center hover:bg-muted transition-colors ${!previousLesson ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {previousLesson ? (
                            <Link className="flex items-center justify-center gap-2" href={`/app/courses/watch?l=${previousLesson.id}&c=${courseID}`}>
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden md:block">
                                    Aula Anterior
                                </span>
                            </Link>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-foreground/50">
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden md:block">
                                    Aula Anterior
                                </span>
                            </div>
                        )}
                    </button>
                    <button
                        disabled={!canGoNext}
                        className={`border-r flex gap-2 items-center justify-center transition-colors ${!canGoNext ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}
                    >
                        {(() => {
                            if (!canGoNext) {
                                return (
                                    <div className="flex items-center justify-center gap-2 text-foreground/50">
                                        <span className="hidden md:block">
                                            {nextQuiz ? "Hora do Quiz" : "Próxima Aula"}
                                        </span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                );
                            }

                            return (
                                <Link className="flex items-center justify-center gap-2" href={`/app/courses/watch?l=${nextQuiz ? "quiz&id=" + nextQuiz.id : nextLesson?.id}&c=${courseID}`}>
                                    <span className="hidden md:block">
                                        {nextQuiz ? "Hora do Quiz" : "Próxima Aula"}
                                    </span>
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            );
                        })()}
                    </button>

                    <button className="flex gap-2 items-center cursor-pointer justify-center border-r hover:bg-muted transition-colors" onClick={() => setExplicadorOpen(true)}>
                        <HelpCircle className="w-5 h-5" />
                        <span className="hidden md:block">
                            Dúvidas
                        </span>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
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

                                    {/* Materials Section */}
                                    {viewMode === "video" && (() => {
                                        const currentModule = course?.modules.find(m =>
                                            m.lessons.some(l => l.id === lesson?.id)
                                        );
                                        if (!currentModule) return null;
                                        return (
                                            <div className="w-full max-w-5xl mt-6">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <BookOpen className="w-5 h-5 text-primary" />
                                                    <h3 className="text-base font-semibold text-foreground">Material de Estudo</h3>
                                                </div>
                                                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <BookOpen className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-foreground text-sm truncate">{currentModule.name}</p>
                                                        <p className="text-xs text-foreground/50 mt-0.5">
                                                            {currentModule.material_status === "READY" ? "Guia completo de estudo disponível" :
                                                                currentModule.material_status === "PROCESSING" ? "A gerar material detalhado..." :
                                                                    currentModule.material_status === "FAILED" ? "Erro ao gerar material" :
                                                                        "A preparar material..."}
                                                        </p>
                                                    </div>
                                                    {currentModule.material_status === "READY" && currentModule.material_content ? (
                                                        <button
                                                            onClick={() => {
                                                                setActiveMaterialContent(currentModule.material_content!);
                                                                setMaterialSidebarOpen(true);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
                                                        >
                                                            <BookOpen className="w-3.5 h-3.5" />
                                                            Estudar Agora
                                                        </button>
                                                    ) : currentModule.material_status === "PROCESSING" || !currentModule.material_status ? (
                                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground/50 text-xs font-medium flex-shrink-0">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            A gerar
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="pb-8 pt-4 px-4 flex justify-center">
                            <p className="text-sm text-foreground/40 text-center max-w-2xl">
                                O Bookar pode cometer erros. Considere verificar as informações importantes.
                            </p>
                        </div>
                    </div>

                    {/* Markdown Material Panel (Side-by-side) */}
                    {materialSidebarOpen && activeMaterialContent && (
                        <div
                            ref={sidebarRef}
                            style={{ width: sidebarWidth }}
                            className="hidden lg:flex h-full bg-card border-l border-border flex-col shadow-xl animate-in slide-in-from-right duration-300 relative"
                        >
                            {/* Resizer Handle */}
                            <div
                                onMouseDown={startResizing}
                                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-20 group"
                            >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4 text-primary" />
                                </div>
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                    <span className="font-bold text-foreground">Guia de Estudo</span>
                                </div>
                                <button
                                    onClick={() => setMaterialSidebarOpen(false)}
                                    className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground/60 hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Markdown Content */}
                            <div
                                ref={materialContentRef}
                                className="flex-1 overflow-y-auto px-8 py-6 bg-card custom-scrollbar"
                            >
                                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeSlug]}
                                    >
                                        {activeMaterialContent}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {materialSidebarOpen && activeMaterialContent && (
                <div className="lg:hidden fixed inset-0 z-[120] flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setMaterialSidebarOpen(false)}
                    />
                    {/* Panel */}
                    <div className="relative ml-auto w-full max-w-md h-full bg-card flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                <span className="font-bold text-foreground">Guia de Estudo</span>
                            </div>
                            <button
                                onClick={() => setMaterialSidebarOpen(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground/60"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        {/* Markdown Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 bg-card">
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/80">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeSlug]}
                                >
                                    {activeMaterialContent}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ExplicadorPromptDialog
                open={explicadorOpen}
                onOpenChange={setExplicadorOpen}
                courseContext={explicadorCourseContext}
                title="Dúvidas sobre a aula"
                placeholder="O que não percebeste nesta aula?"
            />
        </div>
    );
}
