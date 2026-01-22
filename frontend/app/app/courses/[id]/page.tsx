"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, ArrowLeft, Plus, ImageOff, PlayCircle, Trash } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Course {
  id: number;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: string;
  created_at: string;
}

interface Lesson {
  id: number;
  title: string;
  desc: string;
  duration: number;
  watched: boolean;
  status: string;
}

interface Module {
  id: number;
  name: string;
  lessons: Lesson[];
}

interface CourseDetail extends Course {
  modules: Module[];
}

export default function CoursePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isGeneratingModule, setIsGeneratingModule] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleGenerateModule = async () => {
    setIsGeneratingModule(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/generate-module`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(session as any)?.accessToken}` }
      });
      toast.success("Gerando novo módulo em segundo plano...");
      fetchCourse();
    } catch (e) {
      toast.error("Erro ao solicitar módulo");
    } finally {
      setIsGeneratingModule(false);
    }
  }

  const checkFinishment = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/courses/${params?.id}/get-next-lesson`,
        {
          headers: {
            Authorization: `Bearer ${(session as any)?.accessToken}`,
          },
        });
      const data = await res.json();
      if (res.ok) {
        if (data.finished) {
          setFinished(true)
        }
      }
    } catch (error) {
      toast.error('Erro desconhecido, aguarde.')
    }
  }

  const fetchCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${params?.id}`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCourse(data);

      } else {
        setIsLoading(false);
        router.push("/app");
      }
    } catch (error) {
      console.error("Failed to fetch course", error);
    } finally {
      setIsLoading(false);
    }
  };

  const watchCourse = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/get-next-lesson`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/app/courses/watch?l=${data.id}&c=${course?.id}`)
      }
    } catch (error) {
      toast.error('Erro desconhecido, aguarde ' + error)
    }
  }

  const handleDeleteCourse = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      if (res.ok) {
        router.push('/app')
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  useEffect(() => {
    if ((session as any)?.accessToken && params?.id) {
      let i;
      if (course?.modules.find(module => {
        module.lessons.some(lesson => lesson.status === "PROCESSING")
      })) {
        i = setInterval(() => {
          fetchCourse();
        }, 5000)

      } else {
        clearInterval(i)
        fetchCourse();
      }
      checkFinishment()
    }
  }, [session, params]);

  if (status === "loading" || isLoading) return null
  if (!course) return null;

  return (
    <div className="relative min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/overview" className="hidden lg:absolute top-0 left-0 p-4 z-50">
          <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </Link>

        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
          {course.thumb ? (
            <img src={"http://localhost:8000/media/" + course.thumb} alt={course.title} className="object-cover w-full h-full" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full border rounded-lg">
              <ImageOff className="w-12 h-12 text-slate-400" />
              <span className="text-gray-500">
                Capa Indisponível
              </span>
            </div>
          )}
          <div className="md:absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white ">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-4xl font-bold mb-2 capitalize">{course.title}</h1>
              <span className="bg-primary px-3 py-1 rounded-full text-sm font-bold text-primary-foreground">
                {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
              </span>
            </div>
            <p className="text-white/80 l">{course.desc}</p>
          </div>
        </div>
        <div className="md:hidden">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-4xl font-bold mb-2 capitalize">{course.title}</h1>
            <span className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-primary-foreground">
              {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
            </span>
          </div>
          <p className="text-black/80 l">{course.desc}</p>
          <div className="w-full border mt-2"></div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Conteúdo do Curso</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="lg" className="rounded-full px-8" onClick={handleDeleteCourse}>
                <Trash className="w-4 h-4 text-red-500" />
                <span className="text-red-500 hidden md:block">
                  Eliminar Curso
                </span>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-8" onClick={handleGenerateModule} disabled={isGeneratingModule}>
                {isGeneratingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="hidden md:block">
                  Novo Módulo
                </span>
              </Button>
              <Button size="lg" className="rounded-full px-8 bg-cyan-500 hover:bg-cyan-600" onClick={watchCourse} hidden={finished}>
                <Play className="w-4 h-4 mr-2" />
                {
                  course.modules.find((module) => {
                    module.lessons.some((lesson) => lesson.watched)
                  }) ? "Continuar Assistindo" : "Assistir Curso"
                }
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {course.modules.length === 0 && (
              <p className="text-muted-foreground">Nenhum módulo encontrado.</p>
            )}
            {course.modules.map((module, i) => (
              <Card key={module.id} className="p-0 gap-0 overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <h3 className="font-semibold text-lg flex items-center">
                    <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">
                      {i + 1}
                    </span>
                    {module.name}
                  </h3>
                </div>
                <div className="divide-y">
                  {module.lessons.map((lesson, j) => (
                    <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${lesson.watched ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="font-medium text-sm">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(lesson.duration / 60)} min</p>
                        </div>
                      </div>
                      <div className="text-xs">
                        {lesson.status === 'READY' ? (
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <PlayCircle className="w-5 h-5 text-gray-600" />
                          </Link>
                        ) : lesson.status === 'PROCESSING' ? (
                          <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Gerando
                          </span>
                        ) : (
                          <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Aguardando</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
