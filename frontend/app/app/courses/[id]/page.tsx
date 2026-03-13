"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, ArrowLeft, Plus, ImageOff, PlayCircle, Trash } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, FileDown, X } from "lucide-react";

interface Course {
  id: number;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: string;
  created_at: string;
  max_modules?: number;
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
  last_quiz_score?: number;
  last_quiz_passed?: boolean;
}

interface CourseDetail extends Course {
  modules: Module[];
  is_fully_completed: boolean;
}

export default function CoursePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isGeneratingModule, setIsGeneratingModule] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

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
        router.push("/app/courses");
      }
    } catch (error) {
      console.error("Failed to fetch course", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCertificateClick = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/certificate`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "READY" && data.certificate_url) {
          window.open(data.certificate_url.startsWith('http') ? data.certificate_url : data.certificate_url, '_blank');
        } else {
          toast.success(data.message || "Solicitação iniciada!");
          fetchCourse(); // Refresh to update status
        }
      } else {
        const error = await res.json();
        toast.error(error.message || "Erro ao processar certificado");
      }
    } catch (e) {
      toast.error("Erro ao processar certificado");
    } finally {
      setIsDownloading(false);
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
      fetchCourse();
      checkFinishment();
    }
  }, [session, params]);

  useEffect(() => {
    if ((session as any)?.accessToken && params?.id && course) {
      // Check if we need to poll
      const isCourseProcessing = course.status === 'PROCESSING';
      const isAnyLessonProcessing = course.modules.some(module =>
        module.lessons.some(lesson => lesson.status === 'PROCESSING')
      );

      let intervalId: NodeJS.Timeout;

      if (isCourseProcessing || isAnyLessonProcessing) {
        intervalId = setInterval(() => {
          fetchCourse();
        }, 5000);
      }

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [session, params, course]);

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
            <img src={course.thumb} alt={course.title} className="object-cover w-full h-full" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full border rounded-lg">
              <ImageOff className="w-12 h-12 text-slate-400" />
              <span className="text-gray-500">
                Capa Indisponível
              </span>
            </div>
          )}
          <div className="md:absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white ">
            <h1 className="text-4xl font-bold mb-2 capitalize">{course.title}</h1>
            <p className="text-white/80 l">{course.desc}</p>
            <div className="mt-1">
              <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-sm font-semibold text-cyan-400 inset-ring inset-ring-cyan-300/30">
                {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
              </span>
            </div>
          </div>
        </div>
        <div className="md:hidden">
          <h1 className="text-2xl font-bold mb-2 capitalize">{course.title}</h1>
          <p className="text-black/80 text-base">{course.desc}</p>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-sm font-medium text-cyan-600 inset-ring inset-ring-cyan-300/30">
              {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
            </span>
          </div>
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
              {(!course.max_modules || course.modules.length < course.max_modules) && (
                <Button variant="outline" size="lg" className="rounded-full px-8" onClick={handleGenerateModule} disabled={isGeneratingModule}>
                  {isGeneratingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="hidden md:block">
                    Novo Módulo
                  </span>
                </Button>
              )}
              <Button size="lg" className="rounded-full px-8 bg-cyan-500 hover:bg-cyan-600" onClick={watchCourse} hidden={finished}>
                <Play className="w-4 h-4" />
                <span className="ml-2 hidden md:block">
                  {
                    course.modules.find((module) =>
                      module.lessons.some((lesson) => lesson.watched)
                    ) ? "Continuar Assistindo" : "Assistir Curso"
                  }
                </span>
              </Button>
              {course?.is_fully_completed && (
                <Button
                  onClick={handleCertificateClick}
                  variant="outline"
                  size="lg"
                  disabled={isDownloading || course?.certificate_status === "PROCESSING"}
                  className="px-8 rounded-full border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-white"
                >
                  {isDownloading || course?.certificate_status === "PROCESSING" ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : course?.certificate_status === "READY" ? (
                    <FileDown className="w-5 h-5 mr-2" />
                  ) : (
                    <Award className="w-5 h-5 mr-2" />
                  )}
                  {course?.certificate_status === "READY" ? "Ver Certificado" :
                    course?.certificate_status === "PROCESSING" ? "Gerando..." : "Emitir Certificado"}
                </Button>
              )}
            </div>
          </div>
          {course.max_modules && (
            <p className="text-sm text-muted-foreground">
              {course.modules.length} / {course.max_modules} módulos
            </p>
          )}
          <div className="space-y-4">
            {course.modules.length === 0 && (
              <p className="text-muted-foreground">Nenhum módulo encontrado.</p>
            )}
            {course.modules.map((module, i) => (
              <Card key={module.id} className="p-0 gap-0 overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <h3 className="font-semibold text-lg flex items-center justify-between w-full pr-4">
                    <div className="flex items-center">
                      <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">
                        {i + 1}
                      </span>
                      {module.name}
                    </div>
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
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Gerando
                            </span>
                          </Link>
                        ) : (
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded-full cursor-pointer">Aguardando</span>
                          </Link>
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
