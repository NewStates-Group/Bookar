"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, ArrowLeft, Plus, ImageOff, PlayCircle, Trash } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Award, FileDown, X, HelpCircle, CheckCircle2, XCircle, Lock, Share2, Users } from "lucide-react";
import { ShareCourseModal } from "@/components/ShareCourseModal";
import { useWebSocket } from "@/context/WebSocketContext";

interface Course {
  id: string;
  title: string;
  desc: string;
  level: string;
  thumb: string;
  status: string;
  created_at: string;
  max_modules?: number;
  certificate_url?: string;
  certificate_status?: string;
}

interface Lesson {
  id: string;
  title: string;
  desc: string;
  duration: number;
  watched: boolean;
  status: string;
}

interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
  last_quiz_score?: number;
  last_quiz_passed?: boolean;
  quiz_id?: number;
}

interface CourseDetail extends Course {
  modules: Module[];
  is_fully_completed: boolean;
}

interface Claim {
  recipient_name: string;
  claimed_at: string;
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
  const [isCancelling, setIsCancelling] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);

  const { addListener } = useWebSocket();

  useEffect(() => {
    const removeListener = addListener((data) => {
      // Refresh on ANY relevant update for this course
      if (data.type === "course_update" && String(data.id) === String(params?.id)) {
        fetchCourse();
      }
      if (data.type === "module_update" && String(data.course_id) === String(params?.id)) {
        fetchCourse();
      }
      // Also refresh if a lesson within this course is updated
      if (data.type === "lesson_update") {
        fetchCourse();
        checkFinishment();
      }
      // Handle certificate update
      if (data.type === "certificate_update" && String(data.course_id) === String(params?.id)) {
        fetchCourse();
      }
    });

    return () => removeListener();
  }, [addListener, params?.id]);

  const handleCancel = async () => {
    if (!window.confirm("Tem certeza que deseja cancelar a geração deste curso?")) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(session as any)?.accessToken}` }
      });
      if (res.ok) {
        toast.success("Geração cancelada.");
        fetchCourse();
      } else {
        toast.error("Erro ao cancelar geração.");
      }
    } catch (e) {
      toast.error("Erro de conexão.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGenerateModule = async () => {
    setIsGeneratingModule(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/generate-module`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(session as any)?.accessToken}` }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || error.message || "Erro ao solicitar módulo");
      }

      fetchCourse();
    } catch (e: any) {
      toast.error(e.message || "Erro ao solicitar módulo");
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

  const fetchClaims = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${params?.id}/claims`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setClaims(data);
      }
    } catch (error) {
      console.error("Failed to fetch claims", error);
    }
  };

  const handleShare = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token);
        setIsShareModalOpen(true);
      } else {
        toast.error("Erro ao gerar link de partilha.");
      }
    } catch (e) {
      toast.error("Erro de conexão.");
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
        if (data.finished) {
          toast.success("Curso finalizado! Podes gerar novos módulos ou rever aulas anteriores.");
          return;
        }

        if (data.id) {
          router.push(`/app/courses/watch?l=${data.id}&c=${course?.id}`)
        } else {
          toast.error("Não foi possível encontrar a próxima aula.");
        }
      }
    } catch (error) {
      toast.error('Erro de conexão, aguarde.')
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
        router.replace('/app/courses')
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  useEffect(() => {
    if ((session as any)?.accessToken && params?.id) {
      fetchCourse();
      checkFinishment();
      fetchClaims();
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
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="lg" className="rounded-full px-8" onClick={handleShare}>
                <Share2 className="w-4 h-4 text-cyan-500" />
                <span className="text-cyan-500 hidden md:block">
                  Partilhar
                </span>
              </Button>
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
              {course.status === 'PROCESSING' && (
                <Button variant="outline" size="lg" className="rounded-full px-8 border-red-200 hover:bg-red-50" onClick={handleCancel} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span className="text-red-500 hidden md:block ml-2">
                    Cancelar Geração
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
                  onClick={course?.certificate_status === "READY" && course?.certificate_url ?
                    () => window.open(course.certificate_url, '_blank') :
                    handleCertificateClick}
                  variant="outline"
                  size="lg"
                  disabled={isDownloading || course?.certificate_status === "PROCESSING"}
                  className="px-8 rounded-full border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-white"
                >
                  {isDownloading || course?.certificate_status === "PROCESSING" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : course?.certificate_status === "READY" ? (
                    <FileDown className="w-5 h-5" />
                  ) : (
                    <Award className="w-5 h-5" />
                  )}
                  <span className="ml-2 hidden md:block">
                    {course?.certificate_status === "READY" ? "Ver Certificado" :
                      course?.certificate_status === "PROCESSING" ? "Gerando..." : "Emitir Certificado"}
                  </span>
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
                {module.quiz_id && (() => {
                  const allWatched = module.lessons.every(l => l.watched);
                  return (
                    <div className="p-4 bg-muted/20 flex items-center justify-between border-t border-dashed">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-cyan-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">Quiz do Módulo</p>
                            {!allWatched && (
                              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold tracking-wider"><Lock className="w-2.5 h-2.5" /> Bloqueado</span>
                            )}
                          </div>
                          {module.last_quiz_score !== undefined && module.last_quiz_score !== null && (
                            <p className="text-xs text-muted-foreground">
                              Última pontuação: {module.last_quiz_score.toFixed(1)} / 10.0
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs">
                        <Link
                          href={allWatched ? `/app/courses/watch?l=quiz&id=${module.id}&c=${course.id}` : "#"}
                          onClick={(e) => {
                            if (!allWatched) {
                              e.preventDefault();
                              toast.info("Você precisa assistir a todas as aulas antes de iniciar o quiz.");
                            }
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 gap-1 ${!allWatched ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {module.last_quiz_passed ? (
                              <span className="text-green-600 flex items-center gap-1 font-medium"><CheckCircle2 className="w-4 h-4" /> Passou</span>
                            ) : module.last_quiz_score !== undefined && module.last_quiz_score !== null && allWatched ? (
                              <span className="text-red-600 flex items-center gap-1 font-medium"><XCircle className="w-4 h-4" /> Repetir</span>
                            ) : (
                              <span className={`${allWatched ? 'text-cyan-600' : 'text-gray-400'} flex items-center gap-1 font-medium`}><PlayCircle className="w-4 h-4" /> Iniciar</span>
                            )}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>

          {claims.length > 0 && (
            <div className="mt-12 space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                Alunos que entraram pelo seu link
              </h3>
              <Card className="divide-y overflow-hidden">
                {claims.map((claim, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xs">
                        {claim.recipient_name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{claim.recipient_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground italic">
                      {new Date(claim.claimed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
      <ShareCourseModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={`${window.location.origin}/share/${shareToken}`}
      />
    </div>
  );
}
