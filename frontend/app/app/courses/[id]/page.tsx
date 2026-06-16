"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, ArrowLeft, Plus, ImageOff, PlayCircle, Trash, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Award, FileDown, X, HelpCircle, CheckCircle2, XCircle, Lock, Share2, Users } from "lucide-react";
import { ShareCourseModal } from "@/components/ShareCourseModal";
import { DeleteCourseDialog } from "@/components/DeleteCourseDialog";
import { useWebSocket } from "@/context/WebSocketContext";
import useSWR from 'swr';
import { authenticatedFetcher, apiRequest } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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
  is_owner?: boolean;
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
  const [fullName, setFullName] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const { addListener } = useWebSocket();

  // SWR for Course Detail
  const { data: swrCourse, mutate: mutateCourse, error: errorCourse, isLoading: isLoadingCourse } = useSWR(
    // @ts-ignore
    session?.accessToken && params?.id ? [`${process.env.NEXT_PUBLIC_API_URL}/courses/${params.id}`, session.accessToken] : null,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      errorRetryCount: 3
    }
  );

  // SWR for Claims
  const { data: swrClaims, mutate: mutateClaims } = useSWR(
    // @ts-ignore
    session?.accessToken && params?.id ? [`${process.env.NEXT_PUBLIC_API_URL}/courses/${params.id}/claims`, session.accessToken] : null,
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
    if (swrClaims) setClaims(swrClaims);
  }, [swrCourse, swrClaims]);

  useEffect(() => {
    const removeListener = addListener((data) => {
      if (data.type === "course_update" && String(data.id) === String(params?.id)) {
        mutateCourse();
      }
      if (data.type === "module_update" && String(data.course_id) === String(params?.id)) {
        mutateCourse();
      }
      // Also refresh if a lesson within this course is updated
      if (data.type === "lesson_update") {
        mutateCourse();
        checkFinishment();
      }
      // Handle certificate update
      if (data.type === "certificate_update" && String(data.course_id) === String(params?.id)) {
        mutateCourse();
      }
    });

    return () => removeListener();
  }, [addListener, params?.id, mutateCourse]);

  const handleCancel = async () => {
    if (!window.confirm("Tem certeza que deseja cancelar a geração deste curso?")) return;
    setIsCancelling(true);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/cancel`, {
        method: "POST",
      });
      toast.success("Geração cancelada.");
      mutateCourse();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar geração.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGenerateModule = async () => {
    setIsGeneratingModule(true);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/generate-module`, {
        method: "POST",
      });
      mutateCourse();
    } catch (e: any) {
      toast.error(e.message || "Erro ao solicitar módulo");
    } finally {
      setIsGeneratingModule(false);
    }
  }

  const checkFinishment = async () => {
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${params?.id}/get-next-lesson`);
      if (data.finished) {
        setFinished(true)
      }
    } catch (error) {
      // Sielently fail or handle progress check error
    }
  }


  const handleShare = async () => {
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/share`, {
        method: "POST",
      });
      setShareToken(data.token);
      setIsShareModalOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar link de partilha.");
    }
  };

  const handleCertificateClick = async () => {
    setIsDownloading(true);
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/certificate`);

      if (data.status === "READY" && data.certificate_url) {
        window.open(data.certificate_url.startsWith('http') ? data.certificate_url : data.certificate_url, '_blank');
      } else {
        toast.success(data.message || "Solicitação iniciada!");
        mutateCourse();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar certificado");
    } finally {
      setIsDownloading(false);
    }
  };

  const watchCourse = async () => {
    try {
      const data = await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course?.id}/get-next-lesson`);
      if (data.finished) {
        toast.success("Curso finalizado! Podes gerar novos módulos ou rever aulas anteriores.");
        return;
      }

      if (data.id) {
        router.push(`/app/courses/watch?l=${data.id}&c=${course?.id}`)
      } else {
        toast.error("Não foi possível encontrar a próxima aula.");
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro de conexão, aguarde.')
    }
  }

  const confirmDeleteCourse = async () => {
    if (!course?.id) return;
    setIsDeletingCourse(true);
    try {
      await apiRequest(`${process.env.NEXT_PUBLIC_API_URL}/courses/${course.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      router.replace("/app/courses");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao eliminar curso";
      toast.error(message);
    } finally {
      setIsDeletingCourse(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken && params?.id) {
      checkFinishment();
    }
  }, [session, params]);


  if (status === "loading" || isLoadingCourse) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground font-medium">Carregando as informações do curso...</p>
      </div>
    </div>
  )
  if (!course) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground font-medium">Não foi possível encontrar o curso.</p>
        <Button asChild className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-8" variant="default" size="lg">
          <Link href="/app/courses">Meus Cursos</Link>
        </Button>
      </div>
    </div>
  );

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
            <div className="flex flex-col items-center justify-center h-full border rounded-lg dark:border-neutral-700">
              <ImageOff className="w-12 h-12 text-slate-400 dark:text-neutral-500" />
              <span className="text-gray-500 dark:text-neutral-400">
                Capa Indisponível
              </span>
            </div>
          )}
          <div className="md:absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
            <h1 className="text-4xl font-bold mb-2 capitalize">{course.title}</h1>
            <p className="text-white/80">{course.desc}</p>
          </div>
        </div>

        <div className="md:hidden space-y-2">
          <h1 className="text-2xl font-bold capitalize">{course.title}</h1>
          <p className="text-black/80 dark:text-white/80 text-base">{course.desc}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-sm font-semibold text-cyan-600 dark:text-cyan-400 inset-ring inset-ring-cyan-300/30">
              {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
            </span>
            {course.max_modules && (
              <span className="text-sm text-muted-foreground">
                {course.modules.length} / {course.max_modules} módulos
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-cyan-300/10 px-2 py-1 text-sm font-semibold text-cyan-600 dark:text-cyan-400 inset-ring inset-ring-cyan-300/30">
            {course.level === 'B' ? 'Iniciante' : course.level === 'IT' ? 'Intermediário' : 'Avançado'}
          </span>
          {course.max_modules && (
            <span className="text-sm text-muted-foreground">
              {course.modules.length} / {course.max_modules} módulos
            </span>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Conteúdo do Curso</h2>
            <div className="flex items-center gap-2">
              {/* Mobile: dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden rounded-full w-10 h-10">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="w-4 h-4 text-cyan-500 mr-2" />
                    Partilhar
                    {course?.is_owner && claims.length > 0 && (
                      <span className="ml-auto bg-cyan-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                        {claims.length}
                      </span>
                    )}
                  </DropdownMenuItem>
                  {(!course.max_modules || course.modules.length < course.max_modules) && (
                    <DropdownMenuItem onClick={handleGenerateModule} disabled={isGeneratingModule}>
                      {isGeneratingModule ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Novo Módulo
                    </DropdownMenuItem>
                  )}
                  {course.status === 'PROCESSING' && (
                    <DropdownMenuItem onClick={handleCancel} disabled={isCancelling}>
                      {isCancelling ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500 mr-2" />
                      ) : (
                        <X className="w-4 h-4 text-red-500 mr-2" />
                      )}
                      <span className="text-red-500">Cancelar Geração</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} disabled={isDeletingCourse}>
                    {isDeletingCourse ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-500 mr-2" />
                    ) : (
                      <Trash className="w-4 h-4 text-red-500 mr-2" />
                    )}
                    <span className="text-red-500">Eliminar Curso</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Desktop: visible buttons */}
              <Button variant="outline" size="lg" className="rounded-full px-8 relative hidden md:inline-flex" onClick={handleShare}>
                <Share2 className="w-4 h-4 text-cyan-500" />
                <span className="text-cyan-500 ml-2">
                  Partilhar
                </span>
                {course?.is_owner && claims.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-cyan-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-background font-bold">
                    {claims.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8 border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 hidden md:inline-flex"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isDeletingCourse}
              >
                {isDeletingCourse ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                ) : (
                  <Trash className="w-4 h-4 text-red-500" />
                )}
                <span className="text-red-500 ml-2">Eliminar Curso</span>
              </Button>
              {(!course.max_modules || course.modules.length < course.max_modules) && (
                <Button variant="outline" size="lg" className="rounded-full px-8 hidden md:inline-flex" onClick={handleGenerateModule} disabled={isGeneratingModule}>
                  {isGeneratingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-2">
                    Novo Módulo
                  </span>
                </Button>
              )}
              {course.status === 'PROCESSING' && (
                <Button variant="outline" size="lg" className="rounded-full px-8 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 hidden md:inline-flex" onClick={handleCancel} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <X className="w-4 h-4 text-red-500" />}
                  <span className="text-red-500 ml-2">
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
                  <span className="ml-2">
                    {course?.certificate_status === "READY" ? "Ver Certificado" :
                      course?.certificate_status === "PROCESSING" ? "Gerando..." : "Emitir Certificado"}
                  </span>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {course.modules.length === 0 && (
              <p className="text-muted-foreground">Nenhum módulo encontrado.</p>
            )}
            {course.modules.map((module, i) => (
              <Card key={module.id} className="p-0 gap-0 overflow-hidden">
                <div className="bg-muted/50 p-4 border-b dark:border-neutral-700">
                  <h3 className="font-semibold text-lg flex items-center justify-between w-full pr-4">
                    <div className="flex items-center">
                      <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">
                        {i + 1}
                      </span>
                      {module.name}
                    </div>
                  </h3>
                </div>
                <div className="divide-y dark:divide-neutral-700">
                  {module.lessons.map((lesson, j) => (
                    <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${lesson.watched ? 'bg-green-500' : 'bg-gray-300 dark:bg-neutral-600'}`}></div>
                        <div>
                          <p className="font-medium text-sm">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">{Math.floor(lesson.duration / 60)} min</p>
                        </div>
                      </div>
                      <div className="text-xs">
                        {lesson.status === 'READY' ? (
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <PlayCircle className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                          </Link>
                        ) : lesson.status === 'PROCESSING' ? (
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-1 rounded-full flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Gerando
                            </span>
                          </Link>
                        ) : (
                          <Link href={`/app/courses/watch?l=${lesson.id}&c=${course.id}`}>
                            <span className="text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-full cursor-pointer">Aguardando</span>
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
                              <span className={`${allWatched ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-neutral-500'} flex items-center gap-1 font-medium`}><PlayCircle className="w-4 h-4" /> Iniciar</span>
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

          {course?.is_owner && (
            <div className="mt-12 pt-8 border-t border-dashed dark:border-neutral-700">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black flex items-center gap-2">
                    <Users className="w-6 h-6 text-cyan-500" />
                    Comunidade
                  </h3>
                  <p className="text-sm text-muted-foreground">Pessoas que estão a aprender com o seu link</p>
                </div>
                {claims.length > 0 && (
                  <div className="bg-cyan-500/10 text-cyan-600 px-4 py-2 rounded-2xl font-bold border border-cyan-500/20">
                    {claims.length} {claims.length === 1 ? 'Pessoa' : 'Pessoas'}
                  </div>
                )}
              </div>

              {claims.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claims.map((claim, idx) => (
                    <Card key={idx} className="p-4 border-2 border-transparent hover:border-cyan-500/10 transition-all bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                            {claim.recipient_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{claim.recipient_name}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 p-12 rounded-2xl border-2 border-dotted border-muted/50 text-center grayscale flex flex-col items-center justify-center">
                  <Users className="w-12 h-12 mb-4 text-muted-foreground opacity-20" />
                  <p className="font-bold text-muted-foreground/50">Ainda sem alunos pelo seu link.</p>
                  <p className="text-xs text-muted-foreground/40 mt-1 max-w-[200px]">Partilhe o curso com os seus amigos para começar a construir a sua comunidade!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ShareCourseModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareUrl={`${window.location.origin}/share/${shareToken}`}
      />

      <DeleteCourseDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !isDeletingCourse && setDeleteDialogOpen(open)}
        courseTitle={course?.title}
        isDeleting={isDeletingCourse}
        onConfirm={confirmDeleteCourse}
      />
    </div>
  );
}
