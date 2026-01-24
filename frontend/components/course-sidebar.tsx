"use client";

import { useSearchParams } from "next/navigation";
import { ChevronDown, PlayCircle, Loader2, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseData, Module } from "@/app/app/courses/watch/page";

export function CourseWatchSidebar({ course, onClose }: { course: CourseData | null, onClose: () => void }) {
    if (!course) return

    const searchParams = useSearchParams();
    const lessonId = searchParams.get("l");
    const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(true);

    const toggleModule = (moduleId: number) => {
        setExpandedModules((prev) => ({
            ...prev,
            [moduleId]: !prev[moduleId],
        }));
    };

    useEffect(() => {
        if (course.modules) {
            course.modules.forEach((module: Module) => {
                if (module.lessons.some((lesson) => lesson.id === parseInt(lessonId || ""))) {
                    setExpandedModules((prev) => ({
                        ...prev,
                        [module.id]: true,
                    }));
                }
            });
        }
        setLoading(false)
    }, [course])


    const totalLessons = course?.modules.reduce((sum, m) => sum + m.lessons.length, 0) || 0;
    const watchedLessons = course?.modules.reduce(
        (sum, m) => sum + m.lessons.filter((l) => l.watched).length,
        0
    ) || 0;
    const progressPercentage = totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0;

    return (
        <div className="h-full flex flex-col bg-card">
            <div className="border-b border-border p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-wrap text-lg font-bold text-foreground truncate">{course?.title || "Carregando..."}</h2>
                    <button
                        className="md:hidden"
                        onClick={() => onClose()}
                    >
                        <X className="cursor-pointer w-5 h-5" />
                    </button>
                </div>
                <p className="text-xs text-foreground/50 mt-1">
                    {course?.modules.length || 0} módulos • {watchedLessons} de {totalLessons} visto
                </p>
                <div className="mt-3 bg-muted rounded-full h-2 overflow-hidden border border-border">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <p className="text-xs text-foreground/40 mt-1">{progressPercentage}% completo</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-foreground/50" />
                    </div>
                ) : course?.modules?.length === 0 ? (
                    <p className="text-foreground/50 text-sm p-4">Nenhum módulo disponível</p>
                ) : (
                    <div className="space-y-1">
                        {course?.modules?.map((module, moduleIndex) => (
                            <div key={module.id}>
                                <button
                                    onClick={() => toggleModule(module.id)}
                                    className="w-full flex items-center justify-between px-3 py-3 text-foreground/70 hover:bg-muted transition-colors rounded-lg"
                                >
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <span className="text-xs font-semibold text-foreground/50 flex-shrink-0 border rounded-full w-5 h-5">
                                            {moduleIndex + 1}
                                        </span>
                                        <span className="text-left font-semibold text-sm text-wrap truncate">{module.name}</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform flex-shrink-0 ${expandedModules[module.id] ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>

                                {expandedModules[module.id] && (
                                    <div className="pl-2 space-y-1 my-1">
                                        {module.lessons.map((lesson) => {
                                            const isActive = parseInt(lessonId || "") === lesson.id;
                                            return (
                                                <Link
                                                    key={lesson.id}
                                                    href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}
                                                >
                                                    <button
                                                        className={`cursor-pointer w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all ${isActive
                                                            ? "bg-cyan-300/10 text-primary border-l-2 border-cyan-600"
                                                            : "text-foreground/60 hover:bg-muted hover:text-foreground/80"
                                                            }`}
                                                    >
                                                        {lesson.status === "READY" ? (
                                                            <PlayCircle className="w-4 h-4 flex-shrink-0" />
                                                        ) : lesson.status === "PROCESSING" ? (
                                                            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                                                        ) : lesson.status === "ERROR" ? (
                                                            <div className="w-4 h-4 rounded-full bg-destructive/50 flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                                                        )}
                                                        <div className="flex-1 text-left min-w-0">
                                                            <p className="truncate text-xs">{lesson.title}</p>
                                                            <p className="text-xs text-foreground/40">
                                                                {Math.floor(lesson.duration / 60)} min
                                                            </p>
                                                        </div>
                                                        {lesson.watched && (
                                                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
