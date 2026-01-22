"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, PlayCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

interface Lesson {
    id: number;
    title: string;
    duration: number;
    watched: boolean;
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
}

interface Module {
    id: number;
    name: string;
    lessons: Lesson[];
}

interface CourseData {
    id: number;
    title: string;
    modules: Module[];
}

export function CourseWatchSidebar() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get("c");
    const lessonId = searchParams.get("l");
    const [course, setCourse] = useState<CourseData | null>(null);
    const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(true);

    const toggleModule = (moduleId: number) => {
        setExpandedModules((prev) => ({
            ...prev,
            [moduleId]: !prev[moduleId],
        }));
    };

    const fetchCourse = async () => {
        if (!courseId || !session?.accessToken) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${courseId}`, {
                headers: {
                    Authorization: `Bearer ${(session as any)?.accessToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setCourse(data);
                // Expand the module containing the current lesson
                if (data.modules) {
                    data.modules.forEach((module: Module) => {
                        if (module.lessons.some((lesson) => lesson.id === parseInt(lessonId || ""))) {
                            setExpandedModules((prev) => ({
                                ...prev,
                                [module.id]: true,
                            }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch course", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourse();
    }, [courseId, session, lessonId]);

    return (
        <Sidebar className="border-r border-white/10 bg-black/50">
            <SidebarHeader className="border-b border-white/10 p-4">
                <h2 className="text-lg font-bold text-black truncate">{course?.title || "Carregando..."}</h2>
                <p className="text-xs text-black/50 mt-1">
                    {course?.modules.length || 0} módulos
                </p>
            </SidebarHeader>

            <SidebarContent className="p-0">
                <SidebarMenu className="gap-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-black/50" />
                        </div>
                    ) : course?.modules?.length === 0 ? (
                        <p className="text-black/50 text-sm p-4">Nenhum módulo disponível</p>
                    ) : (
                        course?.modules?.map((module) => (
                            <div key={module.id} className="border-b border-white/5">
                                <button
                                    onClick={() => toggleModule(module.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-black/70 hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-semibold text-sm">{module.name}</span>
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform ${expandedModules[module.id] ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>

                                {expandedModules[module.id] && (
                                    <div className="bg-white/2 border-t border-white/5">
                                        {module.lessons.map((lesson) => (
                                            <Link
                                                key={lesson.id}
                                                href={`/app/courses/watch?l=${lesson.id}&c=${courseId}`}
                                            >
                                                <button
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${parseInt(lessonId || "") === lesson.id
                                                            ? "bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-500"
                                                            : "text-black/60 hover:bg-white/5 hover:text-black/80"
                                                        }`}
                                                >
                                                    {lesson.status === "READY" ? (
                                                        <PlayCircle className="w-4 h-4 flex-shrink-0" />
                                                    ) : lesson.status === "PROCESSING" ? (
                                                        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 text-left">
                                                        <p className="truncate">{lesson.title}</p>
                                                        <p className="text-xs text-black/40">
                                                            {Math.floor(lesson.duration / 60)} min
                                                        </p>
                                                    </div>
                                                    {lesson.watched && (
                                                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                                    )}
                                                </button>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
}
